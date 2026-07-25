/**
 * Generates the PWA raster icons from the same shapes as the SVG icon.
 *
 * Run with `node scripts/generate-icons.mjs`. Pure Node — no image libraries —
 * so the icons are reproducible on any machine and nothing is downloaded.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const COLORS = {
  background: [245, 240, 232, 255],
  case: [201, 154, 68, 255],
  caseDark: [125, 91, 36, 255],
  dial: [255, 252, 246, 255],
  ink: [43, 35, 28, 255],
};

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const centre = size / 2;
  const set = (x, y, color) => {
    const offset = (y * size + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  };

  const caseRadius = size * 0.42;
  const dialRadius = size * 0.31;
  const teeth = 12;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - centre;
      const dy = y + 0.5 - centre;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      // Toothed outer edge, so the icon reads as a gear even when tiny.
      const toothWave = Math.cos(angle * teeth);
      const outer = caseRadius + (toothWave > 0 ? size * 0.045 : 0);

      let color = COLORS.background;
      if (distance <= outer) color = COLORS.case;
      if (distance <= caseRadius * 0.93) color = COLORS.caseDark;
      if (distance <= dialRadius) color = COLORS.dial;

      // Hands: a vertical hour hand and a horizontal minute hand.
      const inDial = distance <= dialRadius * 0.92;
      const handThickness = Math.max(1.5, size * 0.028);
      const hourHand = inDial && Math.abs(dx) <= handThickness && dy <= 0 && dy >= -dialRadius * 0.72;
      const minuteHand =
        inDial && Math.abs(dy) <= handThickness * 0.85 && dx >= 0 && dx <= dialRadius * 0.62;
      if (hourHand || minuteHand || distance <= handThickness * 1.6) color = COLORS.ink;

      set(x, y, color);
    }
  }

  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), drawIcon(size));
  console.log(`wrote icons/icon-${size}.png`);
}
