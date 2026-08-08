/* ────────────────────────  IMAGE PREPARATION  ────────────────────────
   Raw phone photos base64'd ten at a time produce a request in the tens of
   megabytes. Everything is downscaled in the browser before it goes anywhere.

   EXIF orientation is honoured FIRST, before the canvas round-trip strips it.
   Skip that and an iOS portrait shot lands sideways, which silently makes
   every corner label wrong — the top-left macro gets graded as the top-right. */

export const PREP = {
  macro: { longEdge: 1568, quality: 0.85 }, // detail is the whole point here
  full: { longEdge: 1200, quality: 0.85 }, // centering and gross defects only
};

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* Older Safari rejects the options bag. Fall through to the <img> path,
         which applies EXIF orientation by spec default. */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImage(file, kind) {
  const { longEdge, quality } = PREP[kind] || PREP.full;
  const src = await decode(file);
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  if (!w || !h) throw new Error('Could not read the dimensions of that image.');

  const scale = Math.min(1, longEdge / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * scale));
  cv.height = Math.max(1, Math.round(h * scale));
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  if (typeof src.close === 'function') src.close();
  return cv.toDataURL('image/jpeg', quality);
}

export function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Could not read that image file.'));
    r.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not decode that image.'));
    i.src = src;
  });
}

/* Best-effort card + border detection using row/column luminance profiles.
   Returns normalised rects; the user adjusts from here. */
export function detectFrames(img) {
  const W = 480;
  const H = Math.round((img.naturalHeight / img.naturalWidth) * W);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;

  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++)
    lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];

  const colMean = new Float32Array(W), rowMean = new Float32Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    colMean[x] += lum[y * W + x] / H;
    rowMean[y] += lum[y * W + x] / W;
  }

  const findStep = (arr, n, from, dir, base, thresh) => {
    for (let k = 0; k < n * 0.42; k++) {
      const i = from + dir * k;
      if (i < 0 || i >= n) break;
      if (Math.abs(arr[i] - base) > thresh) return i / n;
    }
    return dir > 0 ? 0.04 : 0.96;
  };

  const bgL = (colMean[1] + colMean[2] + colMean[W - 2] + colMean[W - 3]) / 4;
  const bgT = (rowMean[1] + rowMean[2] + rowMean[H - 2] + rowMean[H - 3]) / 4;

  const x0 = findStep(colMean, W, 1, +1, bgL, 26);
  const x1 = findStep(colMean, W, W - 2, -1, bgL, 26);
  const y0 = findStep(rowMean, H, 1, +1, bgT, 26);
  const y1 = findStep(rowMean, H, H - 2, -1, bgT, 26);

  const outer = { x: x0, y: y0, w: Math.max(0.2, x1 - x0), h: Math.max(0.2, y1 - y0) };

  // Inner design frame: step inward from the card edge until luminance shifts again.
  const px0 = Math.round(outer.x * W), px1 = Math.round((outer.x + outer.w) * W);
  const py0 = Math.round(outer.y * H), py1 = Math.round((outer.y + outer.h) * H);
  const borderL = colMean[Math.min(W - 1, px0 + 3)];
  const borderT = rowMean[Math.min(H - 1, py0 + 3)];

  const ix0 = findStep(colMean, W, px0 + 4, +1, borderL, 22);
  const ix1 = findStep(colMean, W, px1 - 4, -1, borderL, 22);
  const iy0 = findStep(rowMean, H, py0 + 4, +1, borderT, 22);
  const iy1 = findStep(rowMean, H, py1 - 4, -1, borderT, 22);

  let inner = { x: ix0, y: iy0, w: ix1 - ix0, h: iy1 - iy0 };
  const sane = inner.w > outer.w * 0.4 && inner.h > outer.h * 0.4 &&
               inner.x > outer.x && inner.y > outer.y &&
               inner.x + inner.w < outer.x + outer.w &&
               inner.y + inner.h < outer.y + outer.h;
  if (!sane) {
    inner = {
      x: outer.x + outer.w * 0.07, y: outer.y + outer.h * 0.07,
      w: outer.w * 0.86, h: outer.h * 0.86,
    };
  }
  return { outer, inner };
}

/* Still used, but only to trim a full-card shot down to the seated caliper
   frame before it is sent — the corner macros are photographed now, not
   cropped out of the front shot. */
export function cropDataURL(img, rect, out = 900) {
  const sx = rect.x * img.naturalWidth, sy = rect.y * img.naturalHeight;
  const sw = rect.w * img.naturalWidth, sh = rect.h * img.naturalHeight;
  const cv = document.createElement('canvas');
  const ar = sh / sw;
  cv.width = out; cv.height = Math.max(48, Math.round(out * ar));
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.9);
}

export function thumbDataURL(img, w = 300) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = Math.round((img.naturalHeight / img.naturalWidth) * w);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.7);
}

export function ratios(outer, inner) {
  const l = inner.x - outer.x;
  const r = outer.x + outer.w - (inner.x + inner.w);
  const t = inner.y - outer.y;
  const b = outer.y + outer.h - (inner.y + inner.h);
  const axis = (a, z) => (a + z <= 0 ? 50 : (Math.max(a, z) / (a + z)) * 100);
  const lr = axis(l, r), tb = axis(t, b);
  const fmt = (v) => `${Math.round(v)}/${100 - Math.round(v)}`;
  return {
    lr, tb, worst: Math.max(lr, tb),
    lrText: fmt(lr), tbText: fmt(tb),
    lrBias: l > r ? 'shifted right' : l < r ? 'shifted left' : 'even',
    tbBias: t > b ? 'shifted down' : t < b ? 'shifted up' : 'even',
  };
}
