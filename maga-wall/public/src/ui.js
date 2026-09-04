/* Every screen that is not the game itself.
 *
 * Drawn into the same pixel buffer with the same bitmap font as the HUD, so the
 * menus are part of the cartridge rather than a web page wrapped around it.
 *
 * Each screen function draws itself and returns its tappable rectangles. The
 * screen manager in main.js hit-tests whatever the last draw returned, which
 * keeps layout and hit-testing from ever drifting apart.
 */

import { VW, TRIAL_RUNS } from './config.js';
import { P } from './palette.js';
import { text, textCentre, textWidth, pad } from './font.js';

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export function fill(c, colour, vh) {
  c.fillStyle = colour;
  c.fillRect(0, 0, VW, vh);
}

/** Dim whatever is already on the buffer, for overlays like pause. */
export function scrim(c, vh, alpha = 0.78) {
  c.fillStyle = 'rgba(10,8,18,' + alpha + ')';
  c.fillRect(0, 0, VW, vh);
}

export function panel(c, x, y, w, h, edge = P.panelEdge, face = P.panel) {
  c.fillStyle = face;
  c.fillRect(x, y, w, h);
  c.fillStyle = edge;
  c.fillRect(x, y, w, 1);
  c.fillRect(x, y + h - 1, w, 1);
  c.fillRect(x, y, 1, h);
  c.fillRect(x + w - 1, y, 1, h);
}

/**
 * A chunky arcade menu button. Pushes its rectangle onto `items`.
 * `sel` draws the highlighted state used by keyboard navigation.
 */
export function button(c, items, id, y, label, opts = {}) {
  const w = opts.w || 168;
  const h = opts.h || 26;
  const x = opts.x !== undefined ? opts.x : Math.round((VW - w) / 2);
  const sel = opts.sel;
  const dim = opts.dim;
  c.fillStyle = P.black;
  c.fillRect(x, y + 2, w, h);
  c.fillStyle = sel ? P.btnLit : P.btn;
  c.fillRect(x, y, w, h);
  c.fillStyle = sel ? P.gold : P.btnEdge;
  c.fillRect(x, y, w, 1);
  c.fillRect(x, y + h - 1, w, 1);
  c.fillRect(x, y, 1, h);
  c.fillRect(x + w - 1, y, 1, h);
  // Shrink rather than overflow. A label that does not fit is a bug the author
  // will not notice on their own screen size, so the layout refuses to allow it.
  let scale = opts.scale || 2;
  while (scale > 1 && textWidth(label, scale) > w - 10) scale--;
  const ty = y + Math.round((h - 7 * scale) / 2);
  textCentre(c, label, x + w / 2, ty, dim ? P.textDim : sel ? P.white : P.text, scale, P.ink);
  if (sel) {
    textCentre(c, '▶', x - 7, ty, P.gold, scale === 2 ? 1 : 1, P.ink);
  }
  items.push({ id, x, y, w, h });
  return y + h + (opts.gap === undefined ? 6 : opts.gap);
}

/** Left-aligned body copy. Returns the y after the block. */
export function lines(c, arr, x, y, colour = P.textDim, step = 9, scale = 1) {
  for (const l of arr) {
    if (l) text(c, l, x, y, l.startsWith('*') ? P.gold : colour, scale);
    y += step;
  }
  return y;
}

const heading = (c, s, y, colour = P.gold, scale = 2) =>
  textCentre(c, s, VW / 2, y, colour, scale, P.ink);

/* -------------------------------------------------------------------------- */
/* Decorative attract strip used on the title screen                          */
/* -------------------------------------------------------------------------- */

function attractStrip(c, y, t) {
  const h = 44;
  c.fillStyle = '#2b1e4a';
  c.fillRect(0, y, VW, h);
  c.fillStyle = '#6b4a6b';
  c.fillRect(0, y + h - 14, VW, 14);
  c.fillStyle = P.dirt;
  c.fillRect(0, y + h - 6, VW, 6);
  // a stubby wall
  for (let col = 0; col < 5; col++) {
    for (let r = 0; r < 3 - (col % 2); r++) {
      const bx = 92 + col * 12;
      const by = y + h - 6 - (r + 1) * 10;
      const tier = P.tier[(col + r) % 3];
      c.fillStyle = tier.face;
      c.fillRect(bx, by, 11, 9);
      c.fillStyle = tier.top;
      c.fillRect(bx, by, 11, 2);
      c.fillStyle = tier.line;
      c.fillRect(bx, by + 8, 11, 1);
    }
  }
  // two shufflers
  for (let i = 0; i < 2; i++) {
    const zx = 20 + i * 26 + ((t * 9 + i * 40) % 60);
    const zy = y + h - 6;
    const step = Math.sin(t * 7 + i) > 0 ? 1 : 0;
    c.fillStyle = P.zCloth;
    c.fillRect(zx, zy - 8, 6, 5);
    c.fillRect(zx + 1, zy - 3, 2, 3 - step);
    c.fillRect(zx + 4, zy - 3, 2, 2 + step);
    c.fillStyle = P.zSkin;
    c.fillRect(zx + 1, zy - 12, 5, 4);
    c.fillRect(zx + 6, zy - 7, 3, 2);
    c.fillStyle = P.zEye;
    c.fillRect(zx + 3, zy - 11, 1, 1);
    c.fillRect(zx + 5, zy - 11, 1, 1);
  }
  // flag on the right
  c.fillStyle = P.marbleShade;
  c.fillRect(178, y + 6, 1, h - 12);
  for (let r = 0; r < 6; r++) {
    c.fillStyle = r % 2 === 0 ? P.flagRed : P.flagWhite;
    c.fillRect(179, y + 7 + r * 2, 14 + Math.round(Math.sin(t * 3 + r) * 1.5), 2);
  }
  c.fillStyle = P.flagBlue;
  c.fillRect(179, y + 7, 6, 6);
}

/* -------------------------------------------------------------------------- */
/* Screens                                                                    */
/* -------------------------------------------------------------------------- */

export function drawBoot(c, vh, t, claiming) {
  fill(c, P.ink, vh);
  const items = [];
  if (claiming) {
    // Straight back from Stripe. Say so, and do not offer a way past.
    textCentre(c, 'UNLOCKING', VW / 2, vh / 2 - 20, P.gold, 2, P.ink);
    const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));
    textCentre(c, dots, VW / 2, vh / 2, P.gold, 2, P.ink);
    textCentre(c, 'ONE MOMENT', VW / 2, vh / 2 + 20, P.textDim, 1, P.ink);
    return items;
  }
  const step = Math.min(3, Math.floor(t / 0.7));
  if (step >= 0) textCentre(c, 'JSIPUK', VW / 2, vh / 2 - 30, P.textDim, 2, P.ink);
  if (step >= 1) textCentre(c, 'PRESENTS', VW / 2, vh / 2 - 12, P.textDim, 1, P.ink);
  if (step >= 2) {
    panel(c, 40, vh / 2 + 8, 128, 26);
    textCentre(c, 'CARTRIDGE OK', VW / 2, vh / 2 + 17, P.good, 1, P.ink);
  }
  if (step >= 3 && Math.floor(t * 2) % 2 === 0) {
    textCentre(c, 'TAP TO START', VW / 2, vh - 60, P.gold, 1, P.ink);
  }
  items.push({ id: 'any', x: 0, y: 0, w: VW, h: vh });
  return items;
}

export function drawTitle(c, vh, t, sel, scores, ent) {
  fill(c, P.night, vh);
  const items = [];

  // Sky wash behind the logo.
  for (let i = 0; i < 4; i++) {
    c.fillStyle = ['#12102a', '#2b1e4a', '#4a3268', '#6b4a6b'][i];
    c.fillRect(0, i * 10, VW, 10);
  }
  c.fillStyle = P.night;
  c.fillRect(0, 40, VW, 4);

  // BUILD / THE / MAGA WALL, stacked like a cabinet marquee.
  textCentre(c, 'BUILD', VW / 2, 14, P.flagWhite, 3, P.ink);
  textCentre(c, 'THE', VW / 2, 38, P.flagWhite, 2, P.ink);
  const y3 = 54;
  textCentre(c, 'MAGA WALL', VW / 2, y3 + 2, '#7a1414', 3);
  textCentre(c, 'MAGA WALL', VW / 2, y3, P.gold, 3);
  // Underline in red / white / blue.
  const uw = textWidth('MAGA WALL', 3);
  const ux = Math.round((VW - uw) / 2);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = [P.flagRed, P.flagWhite, P.flagBlue][i];
    c.fillRect(ux + Math.round((uw / 3) * i), y3 + 22, Math.ceil(uw / 3), 3);
  }

  attractStrip(c, 82, t);

  let y = Math.max(136, Math.round(vh * 0.37));
  const labels = [
    ['play', ent && !ent.canPlay() ? 'UNLOCK' : 'PLAY'],
    ['how', 'HOW TO PLAY'],
    ['settings', 'SETTINGS'],
    ['scores', 'HIGH SCORES'],
  ];
  labels.forEach(([id, label], i) => {
    y = button(c, items, id, y, label, { sel: sel === i, h: i === 0 ? 30 : 24, scale: i === 0 ? 2 : 2 });
  });

  if (scores && scores.best > 0) {
    textCentre(c, 'BEST ' + pad(scores.best, 8), VW / 2, y + 4, P.gold, 1, P.ink);
  }
  if (ent && !ent.isUnlocked()) {
    const left = ent.trialLeft();
    textCentre(c, left > 0 ? 'FREE ROUNDS LEFT: ' + left : 'TRIAL SPENT', VW / 2, y + 14, left > 0 ? P.textDim : P.danger, 1, P.ink);
  }

  y = vh - 30;
  items.push({ id: 'about', x: 0, y: y - 4, w: VW, h: 30 });
  textCentre(c, 'PARODY. NOT AFFILIATED WITH OR', VW / 2, y, P.textDim, 1, P.ink);
  textCentre(c, 'ENDORSED BY ANY PERSON, PARTY', VW / 2, y + 8, P.textDim, 1, P.ink);
  textCentre(c, 'OR CAMPAIGN.  [ABOUT]', VW / 2, y + 16, P.panelEdge, 1, P.ink);
  return items;
}

const HOW_PAGES = [
  [
    '*BUILD THE WALL',
    ' PIECES FALL INTO THE GRID.',
    ' SLIDE, TURN AND DROP THEM',
    ' WITH THE BUTTONS BELOW.',
    '',
    '*LAND THEM FLUSH',
    ' A PIECE THAT LEAVES NO GAP',
    ' UNDERNEATH SCORES MORE AND',
    ' BUILDS YOUR COMBO. GAPS ARE',
    ' TUNNELS FOR ZOMBIES.',
    '',
    '*SEAL A COURSE',
    ' FILL A WHOLE ROW AND IT',
    ' UPGRADES ONE MATERIAL:',
    ' BRICK, STONE, STEEL, GOLD.',
    ' GOLD LASTS SIX TIMES LONGER',
    ' THAN BRICK. THIS IS HOW YOU',
    ' SURVIVE THE LATE WAVES.',
  ],
  [
    '*THEY EAT THE BOTTOM',
    ' ZOMBIES CHEW THE GROUND',
    ' COURSE. WHEN A BLOCK DIES',
    ' THE ONES ABOVE DROP DOWN.',
    ' KEEP FEEDING THE WALL.',
    '',
    '*DROP ON THEIR HEADS',
    ' A PIECE THAT LANDS ON A',
    ' ZOMBIE FLATTENS IT. THIS IS',
    ' YOUR ONLY WEAPON.',
    '',
    '*TAP THE EAGLE',
    ' WHEN IT GLOWS ON THE POLE.',
    ' IT TAKES ONE ZOMBIE AWAY.',
    ' ALSO TAP BALLOONS AND ANY',
    ' SUPPLY CRATE YOU SEE.',
    '',
    '*DO NOT BUILD TOO HIGH',
    ' A TOWER TOPPLES AND COSTS',
    ' YOU POINTS. WIDE BEATS TALL.',
  ],
];

export function drawHow(c, vh, page, sel) {
  fill(c, P.ink, vh);
  const items = [];
  const body = HOW_PAGES[page];
  const panelH = body.length * 9 + 12;
  // Centre the whole block, so a tall phone does not leave a hole in the middle.
  const top = Math.max(24, Math.round((vh - (panelH + 78)) / 2) + 8);
  heading(c, 'HOW TO PLAY', top - 18);
  panel(c, 4, top, VW - 8, panelH);
  lines(c, body, 9, top + 6, P.text, 9, 1);
  let y = top + panelH + 6;
  textCentre(c, 'PAGE ' + (page + 1) + ' OF ' + HOW_PAGES.length, VW / 2, y, P.textDim, 1, P.ink);
  y += 11;
  if (page < HOW_PAGES.length - 1) y = button(c, items, 'next', y, 'NEXT', { sel: sel === 0, h: 24 });
  else y = button(c, items, 'prev', y, 'BACK A PAGE', { sel: sel === 0, h: 24 });
  button(c, items, 'back', y, 'MENU', { sel: sel === 1, h: 22 });
  return items;
}

export function drawSettings(c, vh, settings, sel, storageOk, licence) {
  fill(c, P.ink, vh);
  const items = [];
  // 4 toggles + 2 buttons + the back button, centred as one block.
  const blockH = 4 * 30 + 12 + 2 * 28 + 40;
  let y = Math.max(36, Math.round((vh - blockH) / 2) + 14);
  heading(c, 'SETTINGS', y - 24);
  const rows = [
    ['music', 'MUSIC', settings.music],
    ['sfx', 'SOUND FX', settings.sfx],
    ['crt', 'CRT LINES', settings.crt],
    ['shake', 'SCREEN SHAKE', settings.shake],
  ];
  rows.forEach(([id, label, on], i) => {
    const w = 176;
    const x = Math.round((VW - w) / 2);
    const h = 24;
    c.fillStyle = P.black;
    c.fillRect(x, y + 2, w, h);
    c.fillStyle = sel === i ? P.btnLit : P.btn;
    c.fillRect(x, y, w, h);
    c.fillStyle = sel === i ? P.gold : P.btnEdge;
    c.fillRect(x, y, w, 1);
    c.fillRect(x, y + h - 1, w, 1);
    c.fillRect(x, y, 1, h);
    c.fillRect(x + w - 1, y, 1, h);
    text(c, label, x + 8, y + 9, P.text, 1);
    const tag = on ? 'ON' : 'OFF';
    text(c, tag, x + w - 8 - textWidth(tag, 2), y + 5, on ? P.good : P.textDim, 2);
    items.push({ id, x, y, w, h });
    y += h + 6;
  });

  y += 6;
  y = button(c, items, 'reset', y, 'RESET SCORES', { sel: sel === 4, h: 22, w: 176 });
  y = button(c, items, 'about', y, 'ABOUT / LEGAL', { sel: sel === 5, h: 22, w: 176 });
  if (!storageOk) {
    textCentre(c, 'STORAGE OFF: NOTHING SAVES', VW / 2, y + 2, P.danger, 1, P.ink);
    y += 12;
  }
  if (licence) {
    textCentre(c, 'LICENCE KEY', VW / 2, y + 4, P.textDim, 1, P.ink);
    textCentre(c, licence, VW / 2, y + 13, P.gold, 1, P.ink);
    y += 24;
  }
  button(c, items, 'back', y + 8, 'BACK', { sel: sel === 6, h: 26, w: 176 });
  return items;
}

const ABOUT_TEXT = [
  'BUILD THE MAGA WALL IS A',
  'WORK OF SATIRE AND PARODY.',
  '',
  'IT IS NOT AFFILIATED WITH,',
  'ENDORSED BY, SPONSORED BY OR',
  'CONNECTED TO DONALD TRUMP,',
  'ANY POLITICAL CAMPAIGN, THE',
  'REPUBLICAN PARTY, ANY MAGA',
  'ORGANISATION, OR THE UNITED',
  'STATES GOVERNMENT.',
  '',
  'ALL ARTWORK, MUSIC, SOUND AND',
  'TEXT IN THIS GAME ARE ORIGINAL',
  'AND MADE FOR IT. NO LOGOS,',
  'SLOGANS, PHOTOGRAPHS OR',
  'CAMPAIGN MATERIALS ARE USED.',
  '',
  'ANY RESEMBLANCE TO REAL',
  'EVENTS IS FOR COMIC EFFECT.',
  '',
  'SCORES AND SETTINGS ARE STORED',
  'ONLY ON THIS DEVICE.',
];

export function drawAbout(c, vh, sel) {
  fill(c, P.ink, vh);
  const items = [];
  const panelH = ABOUT_TEXT.length * 9 + 12;
  const top = Math.max(24, Math.round((vh - (panelH + 60)) / 2) + 8);
  heading(c, 'ABOUT', top - 18);
  panel(c, 4, top, VW - 8, panelH);
  lines(c, ABOUT_TEXT, 9, top + 6, P.text, 9, 1);
  button(c, items, 'back', top + panelH + 10, 'BACK', { sel: sel === 0, h: 26, w: 176 });
  return items;
}

export function drawScores(c, vh, scores, sel) {
  fill(c, P.ink, vh);
  const items = [];
  const top = Math.max(32, Math.round((vh - 210) / 2) + 12);
  heading(c, 'HIGH SCORES', top - 22);
  panel(c, 10, top, VW - 20, 96);
  if (!scores.table.length) {
    textCentre(c, 'NO RUNS YET', VW / 2, top + 42, P.textDim, 1, P.ink);
  } else {
    scores.table.forEach((row, i) => {
      const y = top + 8 + i * 17;
      text(c, String(i + 1) + '.', 18, y + 2, P.textDim, 1);
      text(c, pad(row.score, 8), 34, y, i === 0 ? P.gold : P.text, 2);
      text(c, 'W' + pad(row.wave, 2), 150, y + 2, P.textDim, 1);
    });
  }
  let y = top + 108;
  text(c, 'BEST WAVE', 20, y, P.textDim, 1);
  text(c, pad(scores.bestWave, 2), 160, y, P.text, 1);
  y += 11;
  text(c, 'RUNS PLAYED', 20, y, P.textDim, 1);
  text(c, String(scores.runs), 160, y, P.text, 1);
  button(c, items, 'back', y + 18, 'BACK', { sel: sel === 0, h: 26, w: 176 });
  return items;
}

export function drawPause(c, vh, sel) {
  scrim(c, vh);
  const items = [];
  const top = Math.round((vh - 150) / 2);
  heading(c, 'PAUSED', top, P.gold, 3);
  let y = top + 40;
  y = button(c, items, 'resume', y, 'RESUME', { sel: sel === 0, h: 30 });
  y = button(c, items, 'how', y, 'HOW TO PLAY', { sel: sel === 1, h: 24 });
  y = button(c, items, 'settings', y, 'SETTINGS', { sel: sel === 2, h: 24 });
  button(c, items, 'quit', y, 'QUIT TO TITLE', { sel: sel === 3, h: 24 });
  return items;
}

export function drawGameOver(c, vh, g, result, sel) {
  scrim(c, vh, 0.84);
  const items = [];
  const top = Math.max(18, Math.round((vh - 300) / 2) + 8);
  textCentre(c, 'RALLY', VW / 2, top, P.danger, 3, P.ink);
  textCentre(c, 'OVERRUN', VW / 2, top + 22, P.danger, 3, P.ink);

  panel(c, 14, top + 52, VW - 28, 72);
  let y = top + 60;
  // Right-aligned against the panel's inner edge: an eight-digit score at
  // scale 2 is 94px wide and overruns a fixed left position.
  const row = (label, value, colour) => {
    text(c, label, 22, y + 2, P.textDim, 1);
    text(c, value, VW - 14 - 8 - textWidth(value, 2), y, colour || P.text, 2);
    y += 18;
  };
  row('SCORE', pad(result.score, 8), P.gold);
  row('WAVE', pad(result.wave, 2));
  row('BEST', pad(result.best, 8));
  if (result.isBest) {
    textCentre(c, 'NEW PERSONAL BEST', VW / 2, top + 114, P.good, 1, P.ink);
  } else {
    textCentre(c, g.stats.kills + ' STOPPED   ' + g.stats.seals + ' SEALED', VW / 2, top + 114, P.textDim, 1, P.ink);
  }

  let by = top + 138;
  by = button(c, items, 'again', by, 'PLAY AGAIN', { sel: sel === 0, h: 30 });
  by = button(c, items, 'scores', by, 'HIGH SCORES', { sel: sel === 1, h: 24 });
  button(c, items, 'title', by, 'TITLE', { sel: sel === 2, h: 24 });
  return items;
}

export function drawPaywall(c, vh, ent, sel, dev, busy, message, price) {
  fill(c, P.ink, vh);
  const items = [];
  const top = Math.max(16, Math.round((vh - 330) / 2) + 6);
  textCentre(c, 'THE WALL', VW / 2, top, P.gold, 3, P.ink);
  textCentre(c, 'IS LOCKED', VW / 2, top + 22, P.gold, 3, P.ink);

  panel(c, 10, top + 52, VW - 20, 66);
  lines(c, [
    'YOUR ' + TRIAL_RUNS + ' FREE ROUNDS ARE SPENT.',
    '',
    'ONE PAYMENT. NO SUBSCRIPTION.',
    'EVERY WAVE, FOREVER, ON ANY',
    'DEVICE YOU RESTORE IT TO.',
  ], 16, top + 60, P.text, 9, 1);

  let y = top + 128;
  const buyLabel = busy === 'buy' ? 'ONE MOMENT...'
    : price ? 'UNLOCK  ' + price
      : dev ? 'DEV UNLOCK' : 'UNLOCK';
  y = button(c, items, 'buy', y, buyLabel, { sel: sel === 0, h: 32, dim: !!busy });
  y = button(c, items, 'restore', y, busy === 'restore' ? 'CHECKING...' : 'ALREADY PAID?',
    { sel: sel === 1, h: 24, dim: !!busy });
  y = button(c, items, 'back', y, 'BACK', { sel: sel === 2, h: 24 });

  if (message) {
    const chunks = wrap(message.toUpperCase(), 32);
    lines(c, chunks.slice(0, 4), 6, y + 6, P.danger, 9, 1);
  } else if (dev && !price) {
    lines(c, [
      'DEV BUILD: THIS UNLOCK IS LOCAL',
      'ONLY AND TAKES NO MONEY.',
    ], 6, y + 6, P.textDim, 9, 1);
  } else if (!price) {
    lines(c, [
      'PAYMENTS ARE NOT CONFIGURED ON',
      'THIS DEPLOYMENT YET.',
    ], 6, y + 6, P.textDim, 9, 1);
  } else {
    lines(c, [
      'PAYMENT IS HANDLED BY STRIPE.',
      'WE NEVER SEE YOUR CARD DETAILS.',
    ], 6, y + 6, P.textDim, 9, 1);
  }
  return items;
}

/**
 * Shown once, straight after a successful purchase.
 *
 * The licence key is the only way to unlock a second device, and it exists
 * nowhere else the buyer can easily find. So it gets a whole screen, drawn big,
 * and the button below it says COPY rather than OK.
 */
export function drawUnlocked(c, vh, licence, sel, copied) {
  fill(c, P.ink, vh);
  const items = [];
  const top = Math.max(20, Math.round((vh - 280) / 2));
  textCentre(c, 'WALL', VW / 2, top, P.good, 3, P.ink);
  textCentre(c, 'UNLOCKED', VW / 2, top + 22, P.good, 3, P.ink);

  lines(c, [
    'THANK YOU. EVERY WAVE IS YOURS.',
  ], 10, top + 52, P.text, 9, 1);

  panel(c, 8, top + 68, VW - 16, 52, P.gold);
  textCentre(c, 'YOUR LICENCE KEY', VW / 2, top + 74, P.textDim, 1, P.ink);
  if (licence) {
    const parts = licence.split('-');
    textCentre(c, parts.slice(0, 2).join('-'), VW / 2, top + 86, P.gold, 2, P.ink);
    textCentre(c, parts.slice(2).join('-'), VW / 2, top + 100, P.gold, 2, P.ink);
  }

  lines(c, [
    'KEEP THIS. IT IS HOW YOU UNLOCK',
    'THE GAME ON ANOTHER PHONE. IT IS',
    'ALSO ON THE SETTINGS SCREEN.',
  ], 8, top + 126, P.textDim, 9, 1);

  let y = top + 160;
  y = button(c, items, 'copy', y, copied ? 'COPIED' : 'COPY KEY', { sel: sel === 0, h: 26 });
  button(c, items, 'play', y, 'PLAY', { sel: sel === 1, h: 30 });
  return items;
}

/** Full-width banner used for wave starts and other announcements. */
export function drawBanner(c, msg, sub, y, t) {
  const h = sub ? 30 : 20;
  c.fillStyle = 'rgba(10,8,18,0.85)';
  c.fillRect(0, y, VW, h);
  c.fillStyle = P.gold;
  c.fillRect(0, y, VW, 1);
  c.fillRect(0, y + h - 1, VW, 1);
  const flash = Math.floor(t * 6) % 2 === 0 ? P.gold : P.flagWhite;
  textCentre(c, msg, VW / 2, y + 4, flash, 2, P.ink);
  if (sub) textCentre(c, sub, VW / 2, y + 21, P.textDim, 1, P.ink);
}

/** Word wrap for the odd bit of dynamic text (provider error messages). */
export function wrap(str, width) {
  const words = String(str).split(/\s+/);
  const out = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) { out.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

export const MENU_LENGTHS = {
  title: 4, how: 2, settings: 7, about: 1, scores: 1,
  pause: 4, gameover: 3, paywall: 3, unlocked: 2,
};
