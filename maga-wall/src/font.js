/* A hand-drawn 5x7 bitmap font.
 *
 * Written out by hand rather than licensed, so there is no font licence to
 * clear before selling the game. Each glyph is seven rows of five bits, MSB on
 * the left. Missing characters fall back to a blank so text never explodes.
 */

const G = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 25, 21, 19, 19, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14],
  1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31],
  3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14],
  7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 31],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '/': [1, 1, 2, 4, 8, 16, 16],
  "'": [4, 4, 0, 0, 0, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14],
  '%': [17, 1, 2, 4, 8, 16, 17],
  '*': [0, 10, 4, 31, 4, 10, 0],
  '#': [10, 31, 10, 10, 31, 10, 0],
  '$': [4, 15, 20, 14, 5, 30, 4],
  '<': [1, 2, 4, 8, 4, 2, 1],
  '>': [16, 8, 4, 2, 4, 8, 16],
  '^': [4, 14, 21, 4, 4, 4, 0],
  'v': [0, 4, 4, 4, 21, 14, 4],
  x: [0, 0, 17, 10, 4, 10, 17],
  '@': [14, 17, 23, 21, 22, 16, 14],
  // Chunky UI arrows, used on the control bar.
  '◀': [1, 3, 7, 15, 7, 3, 1],
  '▶': [16, 24, 28, 30, 28, 24, 16],
  '▼': [31, 31, 14, 14, 4, 4, 0],
  '▲': [0, 4, 4, 14, 14, 31, 31],
  // Rotate glyph: an arrow bending back on itself.
  '↺': [7, 8, 17, 17, 17, 2, 12],
  // Heart, used for the breach pips.
  '♥': [10, 31, 31, 31, 14, 4, 0],
  // Lock.
  '⌂': [14, 17, 17, 31, 27, 27, 31],
};

export const FONT_W = 5;
export const FONT_H = 7;
/** One blank column between glyphs. */
export const ADVANCE = 6;

export function textWidth(str, scale = 1) {
  if (!str.length) return 0;
  return (str.length * ADVANCE - 1) * scale;
}

/**
 * Draw uppercase-ish bitmap text.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} str
 * @param {number} x left edge, in buffer pixels
 * @param {number} y top edge, in buffer pixels
 * @param {string} colour
 * @param {number} scale integer pixel size
 */
export function text(ctx, str, x, y, colour, scale = 1) {
  ctx.fillStyle = colour;
  let cx = x | 0;
  const cy = y | 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const g = G[ch] !== undefined ? G[ch] : G[ch.toUpperCase()];
    if (g) {
      for (let r = 0; r < FONT_H; r++) {
        const bits = g[r];
        if (!bits) continue;
        for (let c = 0; c < FONT_W; c++) {
          if (bits & (1 << (FONT_W - 1 - c))) {
            ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
          }
        }
      }
    }
    cx += ADVANCE * scale;
  }
}

/** Same, but with a one-pixel hard drop shadow. Reads much better over art. */
export function textShadow(ctx, str, x, y, colour, scale = 1, shadow = '#0a0812') {
  text(ctx, str, x + scale, y + scale, shadow, scale);
  text(ctx, str, x, y, colour, scale);
}

export function textCentre(ctx, str, cx, y, colour, scale = 1, shadow) {
  const x = Math.round(cx - textWidth(str, scale) / 2);
  if (shadow === undefined) text(ctx, str, x, y, colour, scale);
  else textShadow(ctx, str, x, y, colour, scale, shadow);
  return x;
}

/** Zero-padded score, because arcade. */
export const pad = (n, w) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
