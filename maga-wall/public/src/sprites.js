/* Hand-drawn pixel art, written as character grids.
 *
 * Everything here is original artwork made of rectangles. No logos, no campaign
 * imagery, no photographs, no traced third-party sprites — the Americana is
 * generic and the rally iconography is a red cap and a placard, which is why
 * there is nothing in this file that needs clearing before the game is sold.
 *
 * Each sprite is baked once into its own little canvas at boot, then blitted
 * with a single drawImage. Anything that needs to animate every frame (zombies,
 * crowd, wall blocks) is drawn procedurally in render.js instead.
 */

import { P } from './palette.js';

/** '.' is transparent. Every other character indexes the sprite's own map. */
const SPRITES = {
  eagleFlyUp: {
    map: { D: P.eagleWing, B: P.eagleBody, W: P.eagleHead, Y: P.eagleBeak },
    rows: [
      '..D.........D..',
      '.DDD.......DDD.',
      '.DDDD.....DDDD.',
      '..DDDD...DDDD..',
      '...DDDBBBDDDD..',
      '.....BBBBBWWW..',
      '.....BBBBBWWWY.',
      '.....DBBBDWWW..',
      '......D.D......',
      '......Y.Y......',
    ],
  },
  eagleFlyDown: {
    map: { D: P.eagleWing, B: P.eagleBody, W: P.eagleHead, Y: P.eagleBeak },
    rows: [
      '...............',
      '...............',
      '....DBBBD......',
      '..DDDBBBBBWWW..',
      '.DDDDBBBBBWWWY.',
      'DDDD.DBBBDWWW..',
      'DDD....D.D.....',
      '.D.....Y.Y.....',
      '...............',
      '...............',
    ],
  },
  eaglePerch: {
    map: { D: P.eagleWing, B: P.eagleBody, W: P.eagleHead, Y: P.eagleBeak },
    rows: [
      '..WWW......',
      '.WWWWW.....',
      'YWWWWWD....',
      '.WWWWDDD...',
      '..DBBBBDD..',
      '..DBBBBBDD.',
      '..DBBBBBBD.',
      '...DBBBBBD.',
      '....DBBBD..',
      '.....DDD...',
      '.....Y.Y...',
      '....YY.YY..',
    ],
  },

  /* --- Americana. Generic civic architecture, drawn from scratch. --------- */
  whiteHouse: {
    map: { M: P.marble, S: P.marbleShade, D: '#6f6a5c', G: P.lawn, W: '#8ea8c8' },
    rows: [
      '..............SSSSSSSSSS..............',
      '.............SMMMMMMMMMMS.............',
      '............SMMMMMMMMMMMMS............',
      '............MMMMMMMMMMMMMM............',
      '...........SMMMMMMMMMMMMMMS...........',
      'SSSSSSSSSSSSMMMMMMMMMMMMMMSSSSSSSSSSSS',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'MWMMWMMWMMMDMMDMMDMMDMMDMMMWMMWMMWMMMM',
      'MWMMWMMWMMMDMMDMMDMMDMMDMMMWMMWMMWMMMM',
      'MMMMMMMMMMMDMMDMMDMMDMMDMMMMMMMMMMMMMM',
      'MMMMMMMMMMMDMMDMMDMMDMMDMMMMMMMMMMMMMM',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'MMWMMWMMWMMMMMWMMWMMWMMMMMWMMWMMWMMMMM',
      'MMWMMWMMWMMMMMWMMWMMWMMMMMWMMWMMWMMMMM',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
    ],
  },
  capitol: {
    map: { M: P.marble, S: P.marbleShade, D: '#6f6a5c', W: '#8ea8c8' },
    rows: [
      '...........M..........',
      '..........MMM.........',
      '.........SMMMS........',
      '........SMMMMMS.......',
      '.......SMMMMMMMS......',
      '......SMMMMMMMMMS.....',
      '......MMMWMMMWMMM.....',
      '.....SMMMWMMMWMMMS....',
      '....SSSSSSSSSSSSSSS...',
      '...SMMMMMMMMMMMMMMMS..',
      '..SMMMMMMMMMMMMMMMMMS.',
      '.SSSSSSSSSSSSSSSSSSSSS',
      'MMMMMMMMMMMMMMMMMMMMMM',
      'MDMMDMMDMMDMMDMMDMMDMM',
      'MDMMDMMDMMDMMDMMDMMDMM',
      'SSSSSSSSSSSSSSSSSSSSSS',
    ],
  },
  monument: {
    map: { M: P.marble, S: P.marbleShade },
    rows: [
      '..M..', '..M..', '.MMM.', '.MMS.', '.MMS.', '.MMS.', '.MMS.', '.MMS.',
      '.MMS.', '.MMS.', '.MMS.', '.MMS.', 'MMMSS', 'MMMSS', 'MMMSS', 'MMMSS',
      'MMMSS', 'MMMSS', 'MMMSS', 'MMMSS', 'MMMSS', 'MMMSS', 'SSSSS',
    ],
  },

  /* --- Interactables ------------------------------------------------------ */
  crate: {
    map: { W: P.flagWhite, R: P.flagRed, C: '#8a6a3a', D: '#5c4526', S: P.star, L: '#cfc7b0' },
    rows: [
      '...WWWWWWW...',
      '..WWWWWWWWW..',
      '.WWRRWWWRRWW.',
      '.WWWWWWWWWWW.',
      '..L.......L..',
      '...L.....L...',
      '....L...L....',
      '.....L.L.....',
      '..CCCCCCCCC..',
      '..CDCCCCCDC..',
      '..CCDCCCDCC..',
      '..CCCDSDCCC..',
      '..CCDCCCDCC..',
      '..CDCCCCCDC..',
      '..CCCCCCCCC..',
    ],
  },
  balloons: {
    map: { R: P.flagRed, W: P.flagWhite, B: P.flagBlue, L: '#c8c0a8', G: P.zSkin, D: P.zSkinDark, Y: P.zEye, C: P.zCloth },
    rows: [
      '.RRR...BBB...',
      'RRRRR.BBBBB..',
      'RRRRR.BBBBB..',
      '.RRR.WWW.BB..',
      '..R.WWWWW.B..',
      '..L.WWWWW.L..',
      '...L.WWW.L...',
      '....L.L.L....',
      '.....LLL.....',
      '......L......',
      '......L......',
      '....GGGGG....',
      '...GDGYGDG...',
      '...GGGGGGG...',
      '....GGGGG....',
      '...CCCCCCC...',
      '..CCCCCCCCC..',
      '...CC...CC...',
      '...GG...GG...',
      '...GG...GG...',
      '..DD.....DD..',
    ],
  },

  /* A dead tree, to make the hostile side read as hostile at a glance. */
  deadTree: {
    map: { T: '#3a2c22', D: '#241a14' },
    rows: [
      '..T.....T..',
      '.T.T...T.D.',
      'T...T.T..D.',
      '.....T.T.D.',
      '......TTD..',
      '.......TD..',
      '......TTD..',
      '.......TD..',
      '.......TD..',
      '.......TD..',
      '......TTDD.',
      '.....TT.DD.',
    ],
  },
};

/** name -> { canvas, w, h, flipped } once baked. */
const baked = {};

function bake(def) {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const colour = def.map[ch];
      if (!colour) continue;
      c.fillStyle = colour;
      c.fillRect(x, y, 1, 1);
    }
  }
  // A horizontally mirrored copy, so flipping never costs a canvas transform.
  const fv = document.createElement('canvas');
  fv.width = w;
  fv.height = h;
  const f = fv.getContext('2d');
  f.translate(w, 0);
  f.scale(-1, 1);
  f.imageSmoothingEnabled = false;
  f.drawImage(cv, 0, 0);
  return { canvas: cv, flipped: fv, w, h };
}

/** Bake every sprite. Call once, after the document exists. */
export function buildSprites() {
  for (const [name, def] of Object.entries(SPRITES)) baked[name] = bake(def);
  return baked;
}

export const sprite = (name) => baked[name];

/**
 * Blit a sprite with its top-left at (x, y), rounded to whole pixels so the
 * art never lands on a half-pixel and goes soft.
 */
export function draw(ctx, name, x, y, flip = false) {
  const s = baked[name];
  if (!s) return;
  ctx.drawImage(flip ? s.flipped : s.canvas, Math.round(x), Math.round(y));
}

/** Blit centred horizontally on x, with the sprite's BOTTOM sitting on y. */
export function drawFoot(ctx, name, x, y, flip = false) {
  const s = baked[name];
  if (!s) return;
  ctx.drawImage(flip ? s.flipped : s.canvas, Math.round(x - s.w / 2), Math.round(y - s.h));
}
