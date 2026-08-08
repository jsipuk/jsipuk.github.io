import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Ruler, ScrollText, Archive, Loader2, RotateCcw, Check,
  AlertTriangle, CircleSlash, Sparkles, Upload, Info, Trash2, ChevronRight,
  ShieldCheck, Minus, MoveDiagonal
} from 'lucide-react';

/* ─────────────────────────────  TOKENS  ───────────────────────────── */

const C = {
  bench:   '#0F1419',
  panel:   '#171F27',
  panel2:  '#1E2830',
  rule:    '#2C3A46',
  ink:     '#E9EDF1',
  muted:   '#8298AC',
  faint:   '#5A6E80',
  amber:   '#F0B429',
  steel:   '#5AA0F2',
  paper:   '#F4F2EC',
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap');
`;

const sans = "'Archivo', system-ui, sans-serif";
const serif = "'Instrument Serif', Georgia, serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

/* ───────────────────────  VENDOR RULEBOOKS  ───────────────────────
   Centering tolerance tables. Entry = [worst-axis ratio ceiling, subgrade].
   PSA front/back published for 10 and 9; lower rungs are the widely
   cited community figures. BGS/CGC tolerances are community-derived —
   Beckett has never published the formula.
──────────────────────────────────────────────────────────────────── */

const PSA_FRONT = [[55,10],[60,9],[65,8],[70,7],[75,6],[80,5],[85,4],[90,3],[95,2],[100,1]];
const PSA_BACK  = [[75,10],[90,9],[93,8],[96,7],[98,6],[100,5]];
const BGS_FRONT = [[50.6,10],[55,9.5],[60,9],[65,8.5],[70,8],[75,7.5],[80,7],[85,6.5],[90,6],[100,5]];
const BGS_BACK  = [[55,10],[60,9.5],[70,9],[80,8.5],[85,8],[90,7.5],[95,7],[100,6.5]];

const lookup = (table, ratio) => {
  for (const [ceil, grade] of table) if (ratio <= ceil + 0.001) return grade;
  return 1;
};

const half = (n) => Math.max(1, Math.min(10, Math.round(n * 2) / 2));

function centeringSub(table, frontWorst, backWorst) {
  const f = lookup(table[0], frontWorst);
  const b = backWorst == null ? 10 : lookup(table[1], backWorst);
  // Front is weighted more heavily; back can only pull the sub down by 1.
  return half(Math.min(f, Math.max(b, f - 1)));
}

/* BGS final-grade engine.
   Half-point rule → double-low anchor → point-bump exception → second-lowest cap. */
function bgsFinal(subs) {
  const entries = Object.entries(subs);
  if (entries.every(([, v]) => v === 10))
    return { grade: 10, rule: 'All four subgrades are 10 — Pristine, Black Label.' };

  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const low = sorted[0][1];
  const second = sorted[1][1];
  const lowKeys = entries.filter(([, v]) => v === low).map(([k]) => k);

  let g, rule;
  if (lowKeys.length >= 2) {
    g = low;
    rule = `Double-low anchor: ${lowKeys.join(' and ')} are tied at ${low}, so the final grade sits on that number.`;
  } else {
    const agg = entries.filter(([k]) => k !== lowKeys[0])
                       .reduce((s, [, v]) => s + (v - low), 0);
    const bumpable = lowKeys[0] === 'edges' || lowKeys[0] === 'surface';
    if (bumpable && agg > 4 && second - low >= 2) {
      g = low + 1;
      rule = `Point-bump exception: ${lowKeys[0]} is drastically low (${low}) and the other three exceed it by ${agg} in aggregate, so a full point is allowed.`;
    } else {
      g = low + 0.5;
      rule = `Half-point rule: ${lowKeys[0]} is the single lowest subgrade at ${low}, so the final grade caps 0.5 above it.`;
    }
  }
  if (g > second) {
    g = second;
    rule += ` Capped at the second-lowest subgrade (${second}).`;
  }
  return { grade: Math.min(10, g), rule };
}

/* PSA engine. PSA runs looser than BGS on corners/edges/surface and much
   looser on back centering, so BGS-scale subs get a half-point of headroom,
   then the lowest anchors a whole-number grade. */
function psaFinal(bgsSubs, psaCentering) {
  const subs = {
    centering: psaCentering,
    corners: half(Math.min(10, bgsSubs.corners + 0.5)),
    edges: half(Math.min(10, bgsSubs.edges + 0.5)),
    surface: half(Math.min(10, bgsSubs.surface + 0.5)),
  };
  const vals = Object.values(subs).sort((a, b) => a - b);
  const min = vals[0];
  const limiter = Object.entries(subs).sort((a, b) => a[1] - b[1])[0][0];
  const grade = Math.max(1, Math.min(10, Math.floor(min)));
  return { grade, subs, limiter };
}

const BGS_LABEL = { 10: 'Pristine', 9.5: 'Gem Mint', 9: 'Mint', 8.5: 'NM-MT+', 8: 'NM-MT', 7.5: 'NM+', 7: 'Near Mint', 6.5: 'EX-MT+', 6: 'EX-MT' };
const PSA_LABEL = { 10: 'Gem Mint', 9: 'Mint', 8: 'NM-MT', 7: 'Near Mint', 6: 'EX-MT', 5: 'Excellent', 4: 'VG-EX', 3: 'Very Good', 2: 'Good', 1: 'Poor' };

/* ────────────────  RESPONSE NORMALISATION  ────────────────
   The model occasionally drops a key or returns a string where an array
   was asked for. Normalising here keeps a bad response from blanking
   the whole report screen. */

const CORNER_KEYS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const EDGE_KEYS = ['top', 'right', 'bottom', 'left'];

const cell = (v) => ({
  s: typeof v?.s === 'number' && isFinite(v.s) ? half(v.s) : 9,
  f: typeof v?.f === 'string' ? v.f : '',
});

function normalise(p) {
  const surfaceFlaws = Array.isArray(p?.surface?.f)
    ? p.surface.f.filter((x) => typeof x === 'string' && x.trim())
    : (typeof p?.surface?.f === 'string' && p.surface.f.trim() ? [p.surface.f] : []);
  return {
    corners: Object.fromEntries(CORNER_KEYS.map((k) => [k, cell(p?.corners?.[k])])),
    edges: Object.fromEntries(EDGE_KEYS.map((k) => [k, cell(p?.edges?.[k])])),
    surface: {
      s: typeof p?.surface?.s === 'number' && isFinite(p.surface.s) ? half(p.surface.s) : 9,
      f: surfaceFlaws,
    },
    imageQuality: ['good', 'fair', 'poor'].includes(p?.imageQuality) ? p.imageQuality : 'unknown',
    confidence: typeof p?.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : 0.5,
    summary: typeof p?.summary === 'string' ? p.summary : '',
  };
}

/* Pull the JSON object out of a response that may carry a preamble or fences. */
function extractJSON(text) {
  const stripped = text.replace(/```json|```/g, '').trim();
  const a = stripped.indexOf('{');
  const b = stripped.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) throw new Error('No JSON object found.');
  return JSON.parse(stripped.slice(a, b + 1));
}

/* ────────────────────────  IMAGE UTILITIES  ──────────────────────── */

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Could not read that image file.'));
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not decode that image.'));
    i.src = src;
  });
}

/* Best-effort card + border detection using row/column luminance profiles.
   Returns normalised rects; the user adjusts from here. */
function detectFrames(img) {
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

function cropDataURL(img, rect, out = 448) {
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

function thumbDataURL(img, w = 180) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = Math.round((img.naturalHeight / img.naturalWidth) * w);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.7);
}

function ratios(outer, inner) {
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

/* ────────────────────────────  UI ATOMS  ─────────────────────────── */

const Panel = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.rule}`, borderRadius: 4, ...style }}>
    {children}
  </div>
);

const Eyebrow = ({ children, icon: Icon }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7, fontFamily: mono, fontSize: 10,
    letterSpacing: '0.18em', textTransform: 'uppercase', color: C.faint, marginBottom: 10,
  }}>
    {Icon && <Icon size={12} strokeWidth={2} />}
    {children}
  </div>
);

/* Severity is always icon + word, never colour on its own. */
function severityOf(score) {
  if (score >= 9.5) return { icon: Check, word: 'Clean', tone: C.steel };
  if (score >= 9) return { icon: Minus, word: 'Minor', tone: C.muted };
  if (score >= 8) return { icon: AlertTriangle, word: 'Notable', tone: C.amber };
  return { icon: CircleSlash, word: 'Heavy', tone: '#E8825A' };
}

const ScoreRow = ({ label, score, note, sub }) => {
  const s = severityOf(score);
  const Icon = s.icon;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderTop: `1px solid ${C.rule}` }}>
      <div style={{
        width: 26, height: 26, borderRadius: 3, flexShrink: 0, display: 'grid',
        placeItems: 'center', border: `1px solid ${s.tone}44`, background: `${s.tone}14`, color: s.tone,
      }}>
        <Icon size={13} strokeWidth={2.4} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</span>
          <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: C.ink }}>
            {score.toFixed(1)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 1, fontFamily: mono, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {s.word}{sub ? ` · ${sub}` : ''}
        </div>
        {note && <div style={{ fontSize: 13, color: C.muted, marginTop: 5, lineHeight: 1.45 }}>{note}</div>}
      </div>
    </div>
  );
};

/* ────────────────────  SIGNATURE: THE CALIPER  ────────────────────
   Two draggable frames over the card, with a loupe that follows the
   handle so you can seat the line on the actual print edge.
──────────────────────────────────────────────────────────────────── */

function Caliper({ src, frames, onChange }) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [loupe, setLoupe] = useState(null);

  const corners = ['tl', 'tr', 'br', 'bl'];

  const cornerPos = (r, c) => ({
    x: c === 'tl' || c === 'bl' ? r.x : r.x + r.w,
    y: c === 'tl' || c === 'tr' ? r.y : r.y + r.h,
  });

  const applyCorner = (r, c, nx, ny) => {
    const min = 0.06;
    let { x, y, w, h } = r;
    if (c === 'tl' || c === 'bl') { const rx = x + w; x = Math.min(nx, rx - min); w = rx - x; }
    else { w = Math.max(min, nx - x); }
    if (c === 'tl' || c === 'tr') { const by = y + h; y = Math.min(ny, by - min); h = by - y; }
    else { h = Math.max(min, ny - y); }
    return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(1 - Math.max(0, x), w), h: Math.min(1 - Math.max(0, y), h) };
  };

  const move = useCallback((e) => {
    if (!drag || !wrapRef.current) return;
    const b = wrapRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
    onChange({ ...frames, [drag.rect]: applyCorner(frames[drag.rect], drag.corner, nx, ny) });
    setLoupe({ x: nx, y: ny, top: ny > 0.42 });
  }, [drag, frames, onChange]);

  useEffect(() => {
    if (!drag) return;
    const up = () => { setDrag(null); setLoupe(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, move]);

  const frame = (key, colour, dashed) => {
    const r = frames[key];
    return (
      <React.Fragment key={key}>
        <div style={{
          position: 'absolute', pointerEvents: 'none',
          left: `${r.x * 100}%`, top: `${r.y * 100}%`,
          width: `${r.w * 100}%`, height: `${r.h * 100}%`,
          border: `1.5px ${dashed ? 'dashed' : 'solid'} ${colour}`,
          boxShadow: `0 0 0 1px #00000055`,
        }} />
        {corners.map((c) => {
          const p = cornerPos(r, c);
          const active = drag && drag.rect === key && drag.corner === c;
          return (
            <div
              key={c}
              onPointerDown={(e) => { e.preventDefault(); setDrag({ rect: key, corner: c }); }}
              style={{
                position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                width: 34, height: 34, marginLeft: -17, marginTop: -17,
                display: 'grid', placeItems: 'center', cursor: 'grab', touchAction: 'none',
              }}
            >
              <div style={{
                width: active ? 17 : 13, height: active ? 17 : 13, borderRadius: '50%',
                background: colour, border: `2px solid ${C.bench}`, transition: 'width .1s, height .1s',
              }} />
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <div ref={wrapRef} style={{ position: 'relative', userSelect: 'none', touchAction: 'none', background: '#000', borderRadius: 3, overflow: 'hidden' }}>
        <img src={src} alt="Card being measured" draggable={false} style={{ width: '100%', display: 'block' }} />
        {frame('outer', C.amber, false)}
        {frame('inner', C.steel, true)}
      </div>

      {loupe && (
        <div style={{
          position: 'absolute', right: 8, [loupe.top ? 'top' : 'bottom']: 8,
          width: 116, height: 116, borderRadius: '50%', overflow: 'hidden',
          border: `2px solid ${C.amber}`, boxShadow: '0 6px 22px #000A', pointerEvents: 'none',
          background: `#000 url(${src}) no-repeat`,
          backgroundSize: `${(wrapRef.current?.clientWidth || 300) * 4}px auto`,
          backgroundPosition: `${58 - loupe.x * (wrapRef.current?.clientWidth || 300) * 4}px ${58 - loupe.y * (wrapRef.current?.clientHeight || 400) * 4}px`,
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 57, height: 1, background: `${C.amber}CC` }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 57, width: 1, background: `${C.amber}CC` }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 0, borderTop: `2px solid ${C.amber}` }} /> Solid line — card edge
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 0, borderTop: `2px dashed ${C.steel}` }} /> Dashed line — print border
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────  THE SLAB LABEL  ───────────────────────── */

function SlabLabel({ vendor, grade, label, subs, title, limiter }) {
  const isBGS = vendor !== 'PSA';
  return (
    <div style={{
      background: C.paper, borderRadius: 3, padding: '14px 16px', color: '#14181C',
      boxShadow: 'inset 0 0 0 1px #0002, 0 10px 30px #0006',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        borderBottom: '1.5px solid #14181C', paddingBottom: 6,
      }}>
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em' }}>{vendor}</span>
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.14em', color: '#5B6470' }}>PREDICTED · NOT CERTIFIED</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0 8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title || 'Untitled card'}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5B6470', marginTop: 3 }}>
            {label}
          </div>
        </div>
        <div style={{ fontFamily: serif, fontSize: 52, lineHeight: 0.8, fontWeight: 400 }}>
          {Number.isInteger(grade) ? grade : grade.toFixed(1)}
        </div>
      </div>

      {isBGS && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1.5px solid #14181C', paddingTop: 7 }}>
          {[['Centering', subs.centering], ['Corners', subs.corners], ['Edges', subs.edges], ['Surface', subs.surface]].map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5B6470' }}>{k}</div>
              <div style={{ fontFamily: serif, fontSize: 21, lineHeight: 1.15 }}>{v.toFixed(1)}</div>
            </div>
          ))}
        </div>
      )}
      {!isBGS && (
        <div style={{ borderTop: '1.5px solid #14181C', paddingTop: 7, fontSize: 11.5, color: '#3A424C', lineHeight: 1.45 }}>
          PSA prints one number. The pillar that held this card back was <strong>{limiter}</strong>.
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────  APP  ────────────────────────────── */

export default function GradeBench() {
  const [tab, setTab] = useState('bench');
  const [title, setTitle] = useState('');
  const [front, setFront] = useState(null);   // { src, img, frames }
  const [back, setBack] = useState(null);
  const [side, setSide] = useState('front');
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [vault, setVault] = useState([]);
  const [vaultBusy, setVaultBusy] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get('vault:index');
        setVault(r ? JSON.parse(r.value) : []);
      } catch { setVault([]); }
      setVaultBusy(false);
    })();
  }, []);

  const ingest = async (file, which) => {
    setError(null);
    try {
      const src = await fileToDataURL(file);
      const img = await loadImage(src);
      const frames = detectFrames(img);
      const rec = { src, img, frames };
      which === 'front' ? setFront(rec) : setBack(rec);
      setAi(null); setSaved(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const fm = front ? ratios(front.frames.outer, front.frames.inner) : null;
  const bm = back ? ratios(back.frames.outer, back.frames.inner) : null;

  /* ───── inspection call ───── */
  const inspect = async () => {
    if (!front) return;
    setBusy(true); setError(null);
    try {
      const o = front.frames.outer;
      const size = Math.min(o.w, o.h) * 0.24;
      const cor = {
        'top-left':     { x: o.x, y: o.y, w: size, h: size },
        'top-right':    { x: o.x + o.w - size, y: o.y, w: size, h: size },
        'bottom-right': { x: o.x + o.w - size, y: o.y + o.h - size, w: size, h: size },
        'bottom-left':  { x: o.x, y: o.y + o.h - size, w: size, h: size },
      };
      const images = [
        cropDataURL(front.img, o, 900),
        ...Object.values(cor).map((r) => cropDataURL(front.img, r, 420)),
      ];
      if (back) images.push(cropDataURL(back.img, back.frames.outer, 700));

      const prompt = `You are a trading-card condition inspector. Grade on the Beckett half-point scale (1.0-10.0, steps of 0.5) where 10 is flawless under magnification and 9 means one minor flaw visible.

Images in order: [1] full card front, [2] top-left corner macro, [3] top-right corner macro, [4] bottom-right corner macro, [5] bottom-left corner macro${back ? ', [6] full card back' : ''}.

Judge only what is actually visible. If an image is blurry, glared or too low-resolution to assess a region, score it conservatively and say so in that region's flaw text. Do not invent defects. Ignore centering entirely — it is measured separately.

Corners: whitening, fraying, dings, rounding, layer separation.
Edges: chipping, whitening, rough cuts, dents along each of the four edges of image [1].
Surface: scratches, scuffs, print lines, print dots, gloss breaks, indentations, staining.

Respond with ONLY raw JSON, no markdown fences, no preamble:
{"corners":{"top-left":{"s":9.5,"f":"short flaw text or empty string"},"top-right":{...},"bottom-right":{...},"bottom-left":{...}},"edges":{"top":{"s":9,"f":""},"right":{"s":9,"f":""},"bottom":{"s":9,"f":""},"left":{"s":9,"f":""}},"surface":{"s":9,"f":["flaw one","flaw two"]},"imageQuality":"good|fair|poor","confidence":0.0-1.0,"summary":"one sentence on what limits this card"}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              ...images.map((d) => ({
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: d.split(',')[1] },
              })),
              { type: 'text', text: prompt },
            ],
          }],
        }),
      });
      const data = await res.json();
      const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      setAi(normalise(extractJSON(text)));
      setSaved(false);
      setTab('report');
    } catch (e) {
      setError('Inspection failed — the model returned something unreadable. Try again, or retake the photo with flatter light.');
    }
    setBusy(false);
  };

  /* ───── grade assembly ───── */
  let report = null;
  if (ai && fm) {
    const cScores = Object.values(ai.corners).map((v) => v.s);
    const eScores = Object.values(ai.edges).map((v) => v.s);
    const anchor = (arr) => {
      const min = Math.min(...arr);
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return half(Math.min(min + 0.5, min * 0.65 + avg * 0.35));
    };
    const bgsSubs = {
      centering: centeringSub([BGS_FRONT, BGS_BACK], fm.worst, bm ? bm.worst : null),
      corners: anchor(cScores),
      edges: anchor(eScores),
      surface: half(ai.surface.s),
    };
    const psaCent = centeringSub([PSA_FRONT, PSA_BACK], fm.worst, bm ? bm.worst : null);
    const bgs = bgsFinal(bgsSubs);
    const psa = psaFinal(bgsSubs, psaCent);
    const cgc = bgsFinal(bgsSubs);

    const verdict =
      psa.grade >= 10 ? { icon: Sparkles, word: 'Submit', line: 'This scans as a gem candidate. Worth the fee on any card with a real 10/9 price gap.' }
      : psa.grade === 9 && bgsSubs.centering >= 9 ? { icon: AlertTriangle, word: 'Borderline', line: 'Reads as a strong 9 with 10 upside. Only submit if the card carries enough value to justify a 9 outcome.' }
      : psa.grade === 9 ? { icon: AlertTriangle, word: 'Borderline', line: 'Reads as a 9, held back by centering rather than condition. A 10 is unlikely from these numbers.' }
      : { icon: CircleSlash, word: 'Hold', line: 'Predicted below 9. Grading fees will likely exceed the uplift unless this card is scarce or high-value.' };

    report = { bgsSubs, psaCent, bgs, psa, cgc, verdict };
  }

  const saveToVault = async () => {
    if (!report || !front) return;
    try {
      const id = `c${Date.now()}`;
      const entry = {
        id, title: title || 'Untitled card', at: new Date().toISOString(),
        psa: report.psa.grade, bgs: report.bgs.grade,
        subs: report.bgsSubs, centering: fm.lrText + ' · ' + fm.tbText,
        thumb: thumbDataURL(front.img, 150),
      };
      const next = [entry, ...vault].slice(0, 40);
      await window.storage.set('vault:index', JSON.stringify(next));
      setVault(next); setSaved(true);
    } catch {
      setError('Could not write to the vault. Your grade is still on screen.');
    }
  };

  const removeFromVault = async (id) => {
    const next = vault.filter((v) => v.id !== id);
    setVault(next);
    try { await window.storage.set('vault:index', JSON.stringify(next)); } catch { /* noop */ }
  };

  const reset = () => {
    setFront(null); setBack(null); setAi(null); setTitle(''); setSaved(false); setError(null); setTab('bench');
  };

  /* ───────────────────────────  TABS  ─────────────────────────── */

  const TABS = [
    { id: 'bench', label: 'Bench', icon: Camera, ok: true },
    { id: 'calipers', label: 'Calipers', icon: Ruler, ok: !!front },
    { id: 'report', label: 'Report', icon: ScrollText, ok: !!report },
    { id: 'vault', label: 'Vault', icon: Archive, ok: true },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bench, color: C.ink, fontFamily: sans }}>
      <style>{FONTS}{`
        *{box-sizing:border-box}
        input,button{font-family:inherit}
        input:focus-visible,button:focus-visible{outline:2px solid ${C.amber};outline-offset:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
      `}</style>

      {/* header */}
      <header style={{ borderBottom: `1px solid ${C.rule}`, padding: '14px 16px 12px', position: 'sticky', top: 0, background: C.bench, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: serif, fontSize: 25, lineHeight: 1 }}>Gradebench</div>
            <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.faint, marginTop: 3 }}>
              Pre-submission inspection
            </div>
          </div>
          {(front || back) && (
            <button onClick={reset} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${C.rule}`,
              color: C.muted, borderRadius: 3, padding: '7px 11px', fontSize: 12, cursor: 'pointer',
            }}>
              <RotateCcw size={13} /> New card
            </button>
          )}
        </div>
      </header>

      <main style={{ padding: '16px 16px 108px', maxWidth: 620, margin: '0 auto' }}>
        {error && (
          <Panel style={{ padding: 13, marginBottom: 14, borderColor: `${C.amber}66` }}>
            <div style={{ display: 'flex', gap: 9 }}>
              <AlertTriangle size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{error}</div>
            </div>
          </Panel>
        )}

        {/* ═══ BENCH ═══ */}
        {tab === 'bench' && (
          <div>
            <Eyebrow icon={Camera}>Step one · photograph the card</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: C.muted, marginTop: 0, marginBottom: 16 }}>
              Out of the sleeve, flat on a dark surface, camera square-on. Diffuse light from two sides — a
              single overhead bulb blows out the gloss and hides exactly the scratches you're checking for.
            </p>

            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Card name and year"
              style={{
                width: '100%', background: C.panel, border: `1px solid ${C.rule}`, color: C.ink,
                padding: '11px 12px', borderRadius: 3, fontSize: 14, marginBottom: 14,
              }}
            />

            <div style={{ display: 'grid', gap: 12 }}>
              {[['front', front, 'Front', true], ['back', back, 'Back', false]].map(([key, rec, label, req]) => (
                <label key={key} style={{ display: 'block', cursor: 'pointer' }}>
                  <input
                    type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) ingest(f, key);
                      e.target.value = '';   // allow re-picking the same file
                    }}
                  />
                  <Panel style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 62, height: 86, borderRadius: 3, background: C.panel2, flexShrink: 0,
                      display: 'grid', placeItems: 'center', overflow: 'hidden', border: `1px dashed ${C.rule}`,
                    }}>
                      {rec ? <img src={rec.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                           : <Upload size={17} color={C.faint} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>
                        {rec ? 'Loaded — tap to replace'
                             : req ? 'Required. Drives every subgrade.'
                                   : 'Optional. Back centering can cost you a full point.'}
                      </div>
                    </div>
                    {rec ? <Check size={17} color={C.steel} /> : <ChevronRight size={17} color={C.faint} />}
                  </Panel>
                </label>
              ))}
            </div>

            {front && (
              <button onClick={() => setTab('calipers')} style={{
                width: '100%', marginTop: 18, background: C.amber, color: '#141414', border: 'none',
                padding: '15px', borderRadius: 3, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Ruler size={17} /> Measure centering
              </button>
            )}

            <Panel style={{ padding: 13, marginTop: 20, background: 'none' }}>
              <div style={{ display: 'flex', gap: 9 }}>
                <Info size={15} color={C.faint} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                  A phone photo can't see everything a loupe under angled light can. Treat every number
                  here as a pre-screen for deciding what to send, not a grade.
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* ═══ CALIPERS ═══ */}
        {tab === 'calipers' && front && (
          <div>
            <Eyebrow icon={Ruler}>Step two · seat the frames</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: C.muted, marginTop: 0, marginBottom: 14 }}>
              The solid frame goes on the cut edge of the card. The dashed frame goes on the printed border.
              Drag a handle and the loupe opens so you can land it on the exact pixel.
            </p>

            {back && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['front', 'back'].map((s) => (
                  <button key={s} onClick={() => setSide(s)} style={{
                    flex: 1, padding: '9px', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: side === s ? C.panel2 : 'transparent',
                    border: `1px solid ${side === s ? C.amber : C.rule}`,
                    color: side === s ? C.ink : C.muted,
                  }}>
                    {side === s ? '● ' : '○ '}{s === 'front' ? 'Front' : 'Back'}
                  </button>
                ))}
              </div>
            )}

            <Caliper
              src={side === 'front' ? front.src : back.src}
              frames={side === 'front' ? front.frames : back.frames}
              onChange={(f) => side === 'front'
                ? setFront({ ...front, frames: f })
                : setBack({ ...back, frames: f })}
            />

            {(() => {
              const isFront = side === 'front';
              const m = isFront ? fm : bm;
              // Each side is measured against its own tolerance table.
              const grade = half(lookup(isFront ? BGS_FRONT : BGS_BACK, m.worst));
              const psaG = lookup(isFront ? PSA_FRONT : PSA_BACK, m.worst);
              return (
                <Panel style={{ marginTop: 14, padding: 14 }}>
                  <Eyebrow icon={MoveDiagonal}>Measured centering · {side}</Eyebrow>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['Left / right', m.lrText, m.lrBias], ['Top / bottom', m.tbText, m.tbBias]].map(([k, v, bias]) => (
                      <div key={k}>
                        <div style={{ fontSize: 11.5, color: C.faint }}>{k}</div>
                        <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, marginTop: 2 }}>{v}</div>
                        <div style={{ fontSize: 11.5, color: C.muted }}>{bias}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.rule}` }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>BGS SUB</div>
                      <div style={{ fontFamily: serif, fontSize: 26, lineHeight: 1.1 }}>{grade.toFixed(1)}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>PSA CEILING</div>
                      <div style={{ fontFamily: serif, fontSize: 26, lineHeight: 1.1 }}>{psaG}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
                    {isFront
                      ? 'PSA allows 55/45 on the front for a 10. Beckett wants 50/50 for a black label and 55/45 for a 9.5.'
                      : 'Backs run looser — PSA allows 75/25 for a 10. A badly shifted back still caps the front.'}
                  </div>
                </Panel>
              );
            })()}

            <button onClick={inspect} disabled={busy} style={{
              width: '100%', marginTop: 16, background: busy ? C.panel2 : C.amber,
              color: busy ? C.muted : '#141414', border: 'none', padding: '15px', borderRadius: 3,
              fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            }}>
              {busy ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Inspecting eight regions…</>
                    : <><Sparkles size={17} /> Inspect corners, edges and surface</>}
            </button>
            <div style={{ fontSize: 12, color: C.faint, textAlign: 'center', marginTop: 9, lineHeight: 1.5 }}>
              Four corner macros are cropped and magnified, then read alongside the full front{back ? ' and back' : ''}.
            </div>
          </div>
        )}

        {/* ═══ REPORT ═══ */}
        {tab === 'report' && report && (
          <div>
            <Eyebrow icon={ScrollText}>Predicted outcome</Eyebrow>

            <div style={{ display: 'grid', gap: 10 }}>
              <SlabLabel vendor="PSA" grade={report.psa.grade}
                         label={PSA_LABEL[report.psa.grade] || ''} subs={report.psa.subs}
                         limiter={report.psa.limiter} title={title} />
              <SlabLabel vendor="BGS" grade={report.bgs.grade}
                         label={report.bgs.grade === 10 ? 'Pristine · Black Label' : (BGS_LABEL[report.bgs.grade] || '')}
                         subs={report.bgsSubs} title={title} />
              <SlabLabel vendor="CGC" grade={report.cgc.grade}
                         label={BGS_LABEL[report.cgc.grade] || ''} subs={report.bgsSubs} title={title} />
            </div>

            {/* verdict */}
            <Panel style={{ padding: 14, marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 3, display: 'grid', placeItems: 'center',
                  border: `1px solid ${C.amber}55`, background: `${C.amber}14`, color: C.amber, flexShrink: 0,
                }}>
                  <report.verdict.icon size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{report.verdict.word}</div>
                  <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{report.verdict.line}</div>
                </div>
              </div>
            </Panel>

            {/* pillars */}
            <Panel style={{ padding: '4px 14px 12px', marginTop: 14 }}>
              <div style={{ paddingTop: 12 }}><Eyebrow icon={ShieldCheck}>The four pillars</Eyebrow></div>
              <ScoreRow label="Centering" score={report.bgsSubs.centering}
                        sub={`${fm.lrText} · ${fm.tbText}`}
                        note={`Front is ${fm.lrBias === 'even' && fm.tbBias === 'even' ? 'square' : `${fm.lrBias}, ${fm.tbBias}`}${bm ? `. Back measures ${bm.lrText} and ${bm.tbText}.` : '.'}`} />
              <ScoreRow label="Corners" score={report.bgsSubs.corners}
                        sub={`worst: ${Object.entries(ai.corners).sort((a, b) => a[1].s - b[1].s)[0][0]}`}
                        note={Object.entries(ai.corners).filter(([, v]) => v.f).map(([k, v]) => `${k}: ${v.f}`).join(' · ') || 'No corner flaws called out.'} />
              <ScoreRow label="Edges" score={report.bgsSubs.edges}
                        sub={`worst: ${Object.entries(ai.edges).sort((a, b) => a[1].s - b[1].s)[0][0]}`}
                        note={Object.entries(ai.edges).filter(([, v]) => v.f).map(([k, v]) => `${k}: ${v.f}`).join(' · ') || 'No edge flaws called out.'} />
              <ScoreRow label="Surface" score={report.bgsSubs.surface}
                        note={(ai.surface.f || []).join(' · ') || 'No surface flaws called out.'} />
            </Panel>

            {/* how the maths landed */}
            <Panel style={{ padding: 14, marginTop: 14 }}>
              <Eyebrow icon={Info}>How the grade was reached</Eyebrow>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 9px' }}><strong style={{ color: C.ink }}>BGS.</strong> {report.bgs.rule}</p>
                <p style={{ margin: '0 0 9px' }}><strong style={{ color: C.ink }}>PSA.</strong> Centering measures {report.psaCent} on PSA's looser table. The lowest pillar was {report.psa.limiter}, and PSA prints whole numbers, so it rounds down to {report.psa.grade}.</p>
                <p style={{ margin: 0 }}><strong style={{ color: C.ink }}>CGC.</strong> Modelled on Beckett's tolerances, which is the closest published match. Treat it as the loosest of the three predictions.</p>
              </div>
              <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.rule}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>MODEL CONFIDENCE</div>
                  <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700 }}>{Math.round((ai.confidence ?? 0.5) * 100)}%</div>
                </div>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>IMAGE QUALITY</div>
                  <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, textTransform: 'capitalize' }}>{ai.imageQuality || 'unknown'}</div>
                </div>
              </div>
              {ai.summary && <div style={{ fontSize: 13.5, color: C.muted, marginTop: 11, lineHeight: 1.55, fontStyle: 'italic' }}>{ai.summary}</div>}
            </Panel>

            <button onClick={saveToVault} disabled={saved} style={{
              width: '100%', marginTop: 16, background: saved ? 'transparent' : C.panel2,
              border: `1px solid ${saved ? C.rule : C.amber}`, color: saved ? C.muted : C.ink,
              padding: '14px', borderRadius: 3, fontSize: 14.5, fontWeight: 600,
              cursor: saved ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}>
              {saved ? <><Check size={16} /> Saved to vault</> : <><Archive size={16} /> Save to vault</>}
            </button>

            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 16, lineHeight: 1.6 }}>
              Beckett has never published its final-grade formula; the rules applied here are reverse-engineered
              from submission data by the collecting community and are wrong often enough to matter. PSA's
              published figures cover the 10 and 9 thresholds only.
            </div>
          </div>
        )}

        {tab === 'report' && !report && (
          <Panel style={{ padding: 22, textAlign: 'center' }}>
            <ScrollText size={26} color={C.faint} />
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>No inspection yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
              Load a front image, seat the calipers, then run the inspection.
            </div>
            <button onClick={() => setTab('bench')} style={{
              marginTop: 14, background: C.amber, color: '#141414', border: 'none',
              padding: '11px 20px', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Start a card</button>
          </Panel>
        )}

        {/* ═══ VAULT ═══ */}
        {tab === 'vault' && (
          <div>
            <Eyebrow icon={Archive}>Graded on this device</Eyebrow>
            {vaultBusy && <div style={{ color: C.muted, fontSize: 13 }}>Opening the vault…</div>}
            {!vaultBusy && vault.length === 0 && (
              <Panel style={{ padding: 22, textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Nothing filed yet</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                  Saved cards land here so you can compare a batch before deciding what goes in the envelope.
                </div>
              </Panel>
            )}
            <div style={{ display: 'grid', gap: 9 }}>
              {vault.map((v) => (
                <Panel key={v.id} style={{ padding: 10, display: 'flex', gap: 11, alignItems: 'center' }}>
                  <img src={v.thumb} alt="" style={{ width: 42, height: 58, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginTop: 3 }}>
                      PSA {v.psa} · BGS {v.bgs.toFixed(1)} · {v.centering}
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
                      {new Date(v.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <button onClick={() => removeFromVault(v.id)} aria-label={`Remove ${v.title}`} style={{
                    background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: 7,
                  }}><Trash2 size={15} /></button>
                </Panel>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* bottom dock */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: C.panel,
        borderTop: `1px solid ${C.rule}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 30,
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => t.ok && setTab(t.id)} disabled={!t.ok}
              style={{
                background: 'none', border: 'none', padding: '11px 4px 13px', cursor: t.ok ? 'pointer' : 'not-allowed',
                color: active ? C.amber : t.ok ? C.muted : C.faint, opacity: t.ok ? 1 : 0.4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                borderTop: `2px solid ${active ? C.amber : 'transparent'}`, marginTop: -1,
              }}>
              <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: '0.02em' }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
