/* All drawing.
 *
 * Everything is composed into one small integer-sized buffer (208 x ~370) and
 * then blitted to the real canvas with smoothing off. That is the whole trick
 * behind the look: because the buffer is tiny, every rectangle lands on a whole
 * pixel and the result is genuine pixel art rather than a smooth drawing that
 * has been made blocky afterwards.
 *
 * The renderer owns presentation-only state — particles, floating score
 * popups, the crowd's mood — and is fed by the event list the simulation
 * produces. It never writes to the simulation.
 */

import {
  VW, CELL, COLS, ROWS, HUD_H, GROUND_Y, SCENE_H, GRID_X, GRID_W, GRID_Y, GRID_H,
  MATERIALS, BREACH_LIMIT, WAVE, fallInterval, colX, rowY, worldX,
} from './config.js';
import { P, CROWD_SKIN, CROWD_SHIRT } from './palette.js';
import { text, textCentre, pad } from './font.js';
import { buildSprites, draw as blit, drawFoot, sprite } from './sprites.js';
import {
  EMPTY, idx, pieceState, ghostY, eagleReady, balloonY, rallyPanic,
  displayScore, maxWallHeight,
} from './sim.js';
import { layoutButtons } from './input.js';

/** Per-zombie-type drawing kit: colours and body proportions. */
const KIT = {
  shambler: { skin: P.zSkin, dark: P.zSkinDark, cloth: P.zCloth, w: 4, h: 13 },
  runner: { skin: P.zRot, dark: P.zSkinDark, cloth: P.zClothDark, w: 3, h: 12 },
  climber: { skin: P.zSkin, dark: P.zSkinDark, cloth: '#4a3a5c', w: 3, h: 12 },
  brute: { skin: P.bruteSkin, dark: '#5e5630', cloth: P.bruteCloth, w: 6, h: 17 },
};


/** Four corner brackets — an arcade "look at this" frame. */
function bracket(c, x, y, w, h, colour, len) {
  c.fillStyle = colour;
  const X = Math.round(x); const Y = Math.round(y);
  const W = Math.round(w); const H = Math.round(h);
  c.fillRect(X, Y, len, 1); c.fillRect(X, Y, 1, len);
  c.fillRect(X + W - len, Y, len, 1); c.fillRect(X + W - 1, Y, 1, len);
  c.fillRect(X, Y + H - 1, len, 1); c.fillRect(X, Y + H - len, 1, len);
  c.fillRect(X + W - len, Y + H - 1, len, 1); c.fillRect(X + W - 1, Y + H - len, 1, len);
}

/**
 * Control-bar icons, drawn as shapes centred on (cx, cy).
 * Solid triangles and a real circular arrow read instantly; the same shapes
 * squeezed into 5x7 font glyphs do not.
 */
function icon(c, id, cx, cy, colour) {
  c.fillStyle = colour;
  if (id === 'left' || id === 'right') {
    const dir = id === 'left' ? -1 : 1;
    for (let i = 0; i < 8; i++) {
      const hgt = (8 - i) * 2;
      c.fillRect(cx + dir * (i - 4) - (dir < 0 ? 2 : 0), cy - hgt / 2, 2, hgt);
    }
  } else if (id === 'soft') {
    for (let i = 0; i < 7; i++) c.fillRect(cx - 7 + i, cy - 6 + i * 2, 14 - i * 2, 2);
    c.fillRect(cx - 7, cy - 10, 14, 2);
  } else if (id === 'rotate') {
    // A broken ring with the gap on the right, and a chevron in the gap
    // pointing down — the direction of travel there if you are turning
    // clockwise. Ring plus chevron reads as "rotate" at any size; a five-pixel
    // font glyph of the same idea just reads as the letter C.
    const R = 7;
    for (let d = 55; d <= 320; d += 7) {
      const t = (d * Math.PI) / 180;
      c.fillRect(Math.round(cx + Math.cos(t) * R) - 1, Math.round(cy + Math.sin(t) * R) - 1, 2, 2);
    }
    c.fillRect(cx + 3, cy - 9, 2, 2);
    c.fillRect(cx + 5, cy - 7, 2, 2);
    c.fillRect(cx + 7, cy - 9, 2, 2);
    c.fillRect(cx + 5, cy - 5, 2, 2);
  } else if (id === 'pause') {
    c.fillRect(cx - 5, cy - 7, 3, 14);
    c.fillRect(cx + 2, cy - 7, 3, 14);
  }
}

/* Two ground planes, because one puts the scenery in the wrong place.
 *
 * The city stands on the far plane, high enough to stay visible over a
 * well-kept wall of five or six courses. The near plane starts lower and
 * carries the fence, the rubble and the build zone. Building tall gradually
 * hides the skyline, which is the correct parallax and a quiet nudge that a
 * tall wall is not the goal. */
const FAR_HORIZON = 134;
const HORIZON = 152;

/* -------------------------------------------------------------------------- */

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const buf = document.createElement('canvas');
  const b = buf.getContext('2d', { alpha: false });
  buildSprites();

  const view = { scale: 1, ox: 0, oy: 0, vh: SCENE_H + 98, cssW: 0, cssH: 0 };
  const fx = { parts: [], pops: [], cheer: 0, boo: 0, scanlines: true, shake: true };

  function resize(cssW, cssH, dpr) {
    view.cssW = cssW;
    view.cssH = cssH;
    // The scene is a fixed size; the slack in a tall viewport goes to the
    // control bar, so thumbs get more room on a big phone rather than the
    // whole picture just getting letterboxed.
    const wanted = Math.round(VW * (cssH / cssW));
    view.vh = Math.max(SCENE_H + 88, Math.min(SCENE_H + 132, wanted));
    buf.width = VW;
    buf.height = view.vh;
    const scale = Math.min(cssW / VW, cssH / view.vh);
    view.scale = scale;
    view.ox = Math.round((cssW - VW * scale) / 2);
    view.oy = Math.round((cssH - view.vh * scale) / 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    b.imageSmoothingEnabled = false;
    return view;
  }

  /** Screen (CSS px) -> buffer pixel. Returns null outside the letterbox. */
  function toBuffer(sx, sy) {
    const x = (sx - view.ox) / view.scale;
    const y = (sy - view.oy) / view.scale;
    return { x, y, inside: x >= 0 && x < VW && y >= 0 && y < view.vh };
  }

  return { ctx, b, buf, view, fx, resize, toBuffer, present, drawGame, drawScene };

  function present() {
    ctx.fillStyle = P.ink;
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    ctx.drawImage(buf, view.ox, view.oy, Math.round(VW * view.scale), Math.round(view.vh * view.scale));
  }

  function drawGame(g, dt, input, settings) {
    fx.scanlines = settings.crt;
    fx.shake = settings.shake;
    stepFx(fx, dt);
    drawScene(g, dt);
    drawHud(b, g);
    drawBar(b, view.vh, input);
    if (fx.scanlines) scanlines(b, view.vh);
    present();
  }

  function drawScene(g, dt) {
    const shake = fx.shake ? g.shake : 0;
    const sx = shake > 0.05 ? Math.round((Math.random() - 0.5) * shake) : 0;
    const sy = shake > 0.05 ? Math.round((Math.random() - 0.5) * shake) : 0;

    b.save();
    b.translate(sx, sy);
    b.fillStyle = P.night;
    b.fillRect(-8, -8, VW + 16, SCENE_H + 16);

    drawSky(b, g);
    drawSkyline(b, g);
    drawGround(b);
    drawCrowd(b, g);
    drawWall(b, g);
    drawZombies(b, g);
    drawPiece(b, g);
    drawCrate(b, g);
    drawEagle(b, g);
    drawParticles(b);
    drawPopups(b);
    b.restore();

    if (g.flash > 0) {
      b.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, g.flash * 1.6).toFixed(3) + ')';
      b.fillRect(0, HUD_H, VW, SCENE_H - HUD_H);
    }
  }

  /* ---- backdrop --------------------------------------------------------- */

  function drawSky(c, g) {
    const bands = [
      [HUD_H, P.night], [HUD_H + 14, P.dusk], [HUD_H + 34, P.haze],
      [HUD_H + 56, '#6b4a6b'], [HUD_H + 76, '#8a5a5a'],
    ];
    for (let i = 0; i < bands.length; i++) {
      const y0 = bands[i][0];
      const y1 = i + 1 < bands.length ? bands[i + 1][0] : FAR_HORIZON;
      c.fillStyle = bands[i][1];
      c.fillRect(0, y0, VW, y1 - y0);
    }
    // Stars, fixed positions so they do not crawl.
    c.fillStyle = P.star;
    for (let i = 0; i < 22; i++) {
      const x = (i * 71) % VW;
      const y = HUD_H + 2 + ((i * 37) % 26);
      if ((Math.floor(g.time * 2) + i) % 11 !== 0) c.fillRect(x, y, 1, 1);
    }
    // The hostile side is under a permanent smog bank, dithered at the edge so
    // the transition reads as 8-bit rather than as a soft gradient.
    c.fillStyle = 'rgba(30,26,26,0.55)';
    c.fillRect(0, HUD_H, GRID_X - 8, FAR_HORIZON - HUD_H);
    for (let y = HUD_H; y < FAR_HORIZON; y += 2) {
      c.fillRect(GRID_X - 8, y + ((y / 2) % 2), 8, 1);
    }
  }

  function drawSkyline(c, g) {
    // Far plane: the city.
    c.fillStyle = '#4e3a58';
    c.fillRect(0, FAR_HORIZON, VW, HORIZON - FAR_HORIZON);
    c.fillStyle = '#6b4f74';
    c.fillRect(0, FAR_HORIZON - 1, VW, 1);
    drawFoot(c, 'capitol', 74, FAR_HORIZON);
    drawFoot(c, 'whiteHouse', 138, FAR_HORIZON);
    drawFoot(c, 'monument', 104, FAR_HORIZON);
    drawFoot(c, 'deadTree', 14, FAR_HORIZON + 2);
    drawFoot(c, 'deadTree', 34, FAR_HORIZON);
    drawFlag(c, g.time, 186, FAR_HORIZON);
    drawPlain(c, g);
  }

  /**
   * The ground between the skyline and the wall.
   *
   * This is more than half the picture, and left as one flat fill it read as a
   * void with a wall floating in it. Receding bands plus a horizon line give
   * the scene depth, and the grid panel underneath tells the player where the
   * seven columns actually are — which on a phone is the difference between
   * aiming and guessing.
   */
  function drawPlain(c, g) {
    const bands = [
      [HORIZON, 12, '#5a4356'],
      [HORIZON + 12, 22, '#4a3648'],
      [HORIZON + 34, 32, '#3d2c3c'],
      [HORIZON + 66, GROUND_Y - HORIZON - 66, '#332531'],
    ];
    for (const [y, h, col] of bands) { c.fillStyle = col; c.fillRect(0, y, VW, h); }
    c.fillStyle = '#7a5a70';
    c.fillRect(0, HORIZON - 1, VW, 1);

    // Distant fencing along the horizon, so the eye has something to land on.
    c.fillStyle = '#2b1f2a';
    for (let x = 0; x < VW; x += 6) c.fillRect(x, HORIZON + 1, 1, 4);
    c.fillRect(0, HORIZON + 2, VW, 1);

    // Hostile side: cold, smoggy, strewn with rubble.
    c.fillStyle = 'rgba(26,34,28,0.30)';
    c.fillRect(0, HORIZON, GRID_X, GROUND_Y - HORIZON);
    c.fillStyle = '#2a2230';
    for (let i = 0; i < 9; i++) {
      const x = (i * 17) % (GRID_X - 6);
      const y = HORIZON + 14 + ((i * 23) % (GROUND_Y - HORIZON - 20));
      c.fillRect(x, y, 3 + (i % 3), 2);
    }
    // Rally side: warm light spilling off the stands.
    c.fillStyle = 'rgba(255,190,120,0.10)';
    c.fillRect(GRID_X + GRID_W, HORIZON, VW - GRID_X - GRID_W, GROUND_Y - HORIZON);

    drawGridPanel(c, g);
  }

  /** The build zone: a recessed panel with column guides and the danger line. */
  function drawGridPanel(c, g) {
    c.fillStyle = 'rgba(10,8,20,0.42)';
    c.fillRect(GRID_X, GRID_Y, GRID_W, GRID_H);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    for (let col = 1; col < COLS; col++) c.fillRect(colX(col), GRID_Y, 1, GRID_H);
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.fillRect(GRID_X, GRID_Y, 1, GRID_H);
    c.fillRect(GRID_X + GRID_W - 1, GRID_Y, 1, GRID_H);

    // Build above this and the top course topples. Drawn as a dashed line that
    // brightens as the wall approaches it.
    const dy = rowY(ROWS - 2);
    const close = maxWallHeight(g) >= ROWS - 4;
    const on = close && Math.floor(g.time * 4) % 2 === 0;
    c.fillStyle = on ? 'rgba(255,77,77,0.85)' : 'rgba(255,77,77,0.28)';
    for (let x = GRID_X; x < GRID_X + GRID_W; x += 4) c.fillRect(x, dy, 2, 1);
  }

  /** Stars and stripes, drawn as 5 stripes so it reads at this size. */
  function drawFlag(c, t, x, footY) {
    c.fillStyle = P.marbleShade;
    c.fillRect(x, footY - 62, 2, 62);
    c.fillStyle = P.star;
    c.fillRect(x, footY - 64, 2, 2);
    for (let row = 0; row < 10; row++) {
      const off = Math.round(Math.sin(t * 3 + row * 0.5) * 1.4);
      const y = footY - 60 + row * 2;
      c.fillStyle = row % 2 === 0 ? P.flagRed : P.flagWhite;
      c.fillRect(x + 2, y, 20, 2);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(x + 2, y + off * 0 + 1, 20, 1);
      if (off !== 0) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + 14, y, 8, 2); }
    }
    c.fillStyle = P.flagBlue;
    c.fillRect(x + 2, footY - 60, 9, 10);
    c.fillStyle = P.star;
    for (let i = 0; i < 6; i++) {
      c.fillRect(x + 3 + (i % 3) * 3, footY - 59 + Math.floor(i / 3) * 3, 1, 1);
      c.fillRect(x + 4 + (i % 3) * 3, footY - 57 + Math.floor(i / 3) * 3, 1, 1);
    }
  }

  function drawGround(c) {
    c.fillStyle = P.dirt;
    c.fillRect(0, GROUND_Y, VW, SCENE_H - GROUND_Y);
    c.fillStyle = P.dirtLight;
    c.fillRect(0, GROUND_Y, VW, 2);
    // Hostile side: bare, dark, with rubble. Rally side: mown grass.
    c.fillStyle = P.dirtDark;
    c.fillRect(0, GROUND_Y, GRID_X, SCENE_H - GROUND_Y);
    c.fillStyle = '#3a3026';
    for (let i = 0; i < 10; i++) c.fillRect((i * 13) % GRID_X, GROUND_Y + 4 + ((i * 7) % 9), 2, 1);
    c.fillStyle = P.lawn;
    c.fillRect(GRID_X + GRID_W, GROUND_Y, VW - GRID_X - GRID_W, SCENE_H - GROUND_Y);
    c.fillStyle = '#4f9147';
    for (let i = 0; i < 12; i++) c.fillRect(GRID_X + GRID_W + ((i * 5) % 48), GROUND_Y + 3 + ((i * 3) % 10), 1, 2);
    // Foundation course the wall stands on.
    c.fillStyle = '#5a5048';
    c.fillRect(GRID_X - 2, GROUND_Y, GRID_W + 4, 3);
    c.fillStyle = '#3a332e';
    c.fillRect(GRID_X - 2, GROUND_Y + 3, GRID_W + 4, 2);
  }

  /* ---- the rally -------------------------------------------------------- */

  function drawCrowd(c, g) {
    const x0 = GRID_X + GRID_W;
    const panic = rallyPanic(g);
    const mood = fx.cheer > 0 ? 2 : fx.boo > 0 || panic > 0.75 ? 0 : 1;
    // Three shallow terraces so the crowd reads as a stand, not a queue.
    const rows = [
      { y: GROUND_Y + 1, n: 5, sp: 10 },
      { y: GROUND_Y - 9, n: 5, sp: 10 },
      { y: GROUND_Y - 19, n: 4, sp: 11 },
    ];
    c.fillStyle = P.standDark;
    c.fillRect(x0, GROUND_Y - 22, VW - x0, 22);
    c.fillStyle = P.stand;
    c.fillRect(x0, GROUND_Y - 22, VW - x0, 2);
    c.fillRect(x0, GROUND_Y - 12, VW - x0, 2);
    c.fillRect(x0, GROUND_Y - 2, VW - x0, 2);

    let i = 0;
    for (const row of rows) {
      for (let k = 0; k < row.n; k++, i++) {
        const px = x0 + 3 + k * row.sp + ((i * 3) % 3);
        const beat = g.time * (mood === 2 ? 9 : mood === 0 ? 3 : 5) + i * 1.7;
        const bob = mood === 0 ? 0 : Math.round(Math.abs(Math.sin(beat)) * (mood === 2 ? 3 : 2));
        drawFan(c, px, row.y - bob, i, mood, beat);
      }
    }
    // A couple of placards above the back row.
    drawPlacard(c, x0 + 6, GROUND_Y - 36, g.time, 0);
    drawPlacard(c, x0 + 30, GROUND_Y - 34, g.time, 1);
  }

  /** One pixel supporter: cap, face, body, waving arms. */
  function drawFan(c, x, footY, i, mood, beat) {
    const skin = CROWD_SKIN[i % CROWD_SKIN.length];
    const shirt = CROWD_SHIRT[(i * 3) % CROWD_SHIRT.length];
    const y = footY - 11;
    // legs
    c.fillStyle = '#2f2b3a';
    c.fillRect(x + 1, y + 8, 2, 3);
    c.fillRect(x + 4, y + 8, 2, 3);
    // body
    c.fillStyle = shirt;
    c.fillRect(x, y + 4, 7, 4);
    // arms — up for a cheer, out for a boo, one up otherwise
    c.fillStyle = skin;
    const armUp = mood === 2 ? 1 : mood === 0 ? 0 : (Math.sin(beat) > 0 ? 1 : 0);
    if (armUp) { c.fillRect(x - 1, y + 1, 1, 4); c.fillRect(x + 7, y + 1, 1, 4); }
    else { c.fillRect(x - 1, y + 5, 1, 3); c.fillRect(x + 7, y + 5, 1, 3); }
    // head
    c.fillRect(x + 1, y + 1, 5, 3);
    // the red cap
    c.fillStyle = P.cap;
    c.fillRect(x + 1, y - 1, 5, 2);
    c.fillStyle = P.capDark;
    c.fillRect(x, y + 1, 6, 1);
    // eyes, wide when things are going badly
    c.fillStyle = P.ink;
    c.fillRect(x + 2, y + 2, 1, mood === 0 ? 2 : 1);
    c.fillRect(x + 4, y + 2, 1, mood === 0 ? 2 : 1);
  }

  function drawPlacard(c, x, y, t, k) {
    const bob = Math.round(Math.sin(t * 4 + k * 2) * 1.5);
    c.fillStyle = '#8a6a3a';
    c.fillRect(x + 5, y + 9 + bob, 1, 8);
    c.fillStyle = P.flagWhite;
    c.fillRect(x, y + bob, 12, 9);
    c.fillStyle = k === 0 ? P.flagRed : P.flagBlue;
    c.fillRect(x + 1, y + 1 + bob, 10, 2);
    c.fillRect(x + 1, y + 4 + bob, 10, 1);
    c.fillRect(x + 1, y + 6 + bob, 7, 2);
  }

  /* ---- the wall --------------------------------------------------------- */

  function drawWall(c, g) {
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const i = idx(col, r);
        const tier = g.tier[i];
        if (tier === EMPTY) continue;
        const frac = g.hp[i] / MATERIALS[tier].hp;
        drawBlock(c, colX(col), rowY(r), tier, frac, col, r, g.hurt[i]);
      }
    }
  }

  function drawBlock(c, x, y, tier, frac, col, row, hurt) {
    const t = P.tier[tier];
    c.fillStyle = t.face;
    c.fillRect(x, y, CELL, CELL);
    c.fillStyle = t.top;
    c.fillRect(x, y, CELL, 2);
    c.fillStyle = t.shade;
    c.fillRect(x, y + CELL - 2, CELL, 2);
    c.fillRect(x + CELL - 2, y + 2, 2, CELL - 4);
    // Brick bond: a course line, and a head joint that alternates by row.
    c.fillStyle = t.line;
    c.fillRect(x, y + CELL - 1, CELL, 1);
    c.fillRect(x + CELL - 1, y, 1, CELL);
    c.fillRect(x, y + 7, CELL, 1);
    const jx = row % 2 === 0 ? 7 : 3;
    c.fillRect(x + jx, y, 1, 7);
    c.fillRect(x + ((jx + 8) % CELL), y + 8, 1, 7);
    // Damage, in three fixed stages. The pattern is derived from the cell's
    // coordinates so cracks stay put instead of shimmering each frame.
    const stage = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
    if (stage > 0) {
      c.fillStyle = P.crack;
      const seed = (col * 7 + row * 13) % 4;
      const cracks = CRACKS[seed];
      const n = stage === 1 ? Math.ceil(cracks.length / 2) : cracks.length;
      for (let k = 0; k < n; k++) c.fillRect(x + cracks[k][0], y + cracks[k][1], 1, 1);
      if (stage === 2) {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    }
    if (hurt > 0) {
      c.fillStyle = 'rgba(255,240,200,' + Math.min(0.8, hurt * 3.5).toFixed(3) + ')';
      c.fillRect(x, y, CELL, CELL);
    }
  }

  /* ---- falling piece ---------------------------------------------------- */

  function drawPiece(c, g) {
    const p = g.piece;
    if (!p) return;
    const s = pieceState(p);
    const interval = fallInterval(g.wave);
    const frac = g.lockT > 0 ? 0 : Math.min(0.999, g.fallAcc / interval);
    const gy = ghostY(g);

    // Highlight the columns the piece occupies, all the way down. On a phone
    // this is what makes it possible to aim without staring at the piece.
    c.fillStyle = 'rgba(255,212,92,0.07)';
    const cols = new Set(s.cells.map(([dx]) => p.x + dx));
    for (const col of cols) c.fillRect(colX(col), GRID_Y, CELL, GRID_H);

    // Landing shadow, so the player always knows where it will end up.
    c.fillStyle = 'rgba(255,255,255,0.16)';
    for (const [dx, dy] of s.cells) {
      c.fillRect(colX(p.x + dx) + 1, rowY(gy + dy) + 1, CELL - 2, CELL - 2);
    }
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (const [dx, dy] of s.cells) {
      const bx = colX(p.x + dx);
      const by = rowY(gy + dy);
      if (!s.cells.some(([ex, ey]) => ex === dx && ey === dy - 1)) c.fillRect(bx, by, CELL, 1);
      if (!s.cells.some(([ex, ey]) => ex === dx && ey === dy + 1)) c.fillRect(bx, by + CELL - 1, CELL, 1);
      if (!s.cells.some(([ex, ey]) => ex === dx - 1 && ey === dy)) c.fillRect(bx, by, 1, CELL);
      if (!s.cells.some(([ex, ey]) => ex === dx + 1 && ey === dy)) c.fillRect(bx + CELL - 1, by, 1, CELL);
    }

    const off = Math.round(frac * CELL);
    const nearLock = g.lockT > 0;
    for (const [dx, dy] of s.cells) {
      const bx = colX(p.x + dx);
      const by = rowY(p.y + dy) + off;
      drawBlock(c, bx, by, 0, 1, p.x + dx, p.y + dy, nearLock ? 0.06 : 0);
    }
  }

  /* ---- zombies ---------------------------------------------------------- */

  function drawZombies(c, g) {
    for (const z of g.zombies) {
      if (z.dead && z !== g.eagle.carried) continue;
      if (z.kind === 'balloon') { drawBalloon(c, z, g); continue; }
      const x = worldX(z.x + 0.5);
      const footY = rowY(z.drawRow) + CELL;
      drawZombie(c, x, footY, z);
    }
  }

  /** Drawn from rectangles rather than a sprite sheet so the walk, the bite and
   *  the climb can all be posed from the same handful of parts. */
  function drawZombie(c, cx, footY, z) {
    const k = KIT[z.kind] || KIT.shambler;
    const step = z.state === 'walk' ? Math.sin(z.anim * 7) : 0;
    const bite = z.state === 'bite' ? Math.max(0, Math.sin(z.anim * 11)) : 0;
    const climb = z.state === 'climb' ? Math.sin(z.anim * 9) : 0;
    const x = Math.round(cx - k.w);
    const y = Math.round(footY - k.h);
    const lean = z.state === 'bite' ? 1 : 0;

    // legs
    c.fillStyle = k.cloth;
    const l1 = Math.round(step * 1.6);
    c.fillRect(x, footY - 4, 2, 4 - Math.abs(l1));
    c.fillRect(x + k.w * 2 - 3, footY - 4, 2, 4 - Math.abs(l1 * 0.5));
    c.fillStyle = k.dark;
    c.fillRect(x - 1, footY - 1, 3, 1);
    c.fillRect(x + k.w * 2 - 4, footY - 1, 3, 1);

    // torso
    c.fillStyle = k.cloth;
    c.fillRect(x, y + 5, k.w * 2 - 1, k.h - 9);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(x, y + 5, 1, k.h - 9);
    // exposed ribs, because zombie
    c.fillStyle = k.skin;
    c.fillRect(x + 1, y + 7, 2, 1);
    c.fillRect(x + 1, y + 9, 3, 1);

    // arms, reaching forward (to the right)
    c.fillStyle = k.skin;
    const reach = 2 + Math.round(bite * 2) + lean;
    c.fillRect(x + k.w * 2 - 2, y + 6, reach, 2);
    c.fillRect(x + k.w * 2 - 2, y + 8 + Math.round(climb * 1.5), reach - 1, 2);

    // head
    const hy = y + Math.round(climb) - lean;
    c.fillStyle = k.skin;
    c.fillRect(x + 1, hy, k.w * 2 - 3, 5);
    c.fillStyle = k.dark;
    c.fillRect(x + 1, hy + 4, k.w * 2 - 3, 1);
    c.fillStyle = P.zEye;
    c.fillRect(x + k.w * 2 - 5, hy + 2, 1, 1);
    c.fillRect(x + k.w * 2 - 3, hy + 2, 1, 1);
    // mouth, open mid-bite
    c.fillStyle = P.zBlood;
    if (bite > 0.4) c.fillRect(x + k.w * 2 - 4, hy + 3, 3, 2);

    if (z.kind === 'brute') {
      c.fillStyle = '#6b3a1e';
      c.fillRect(x - 1, y + 3, k.w * 2 + 1, 2);       // hard hat
      c.fillStyle = '#a85a2e';
      c.fillRect(x, y + 1, k.w * 2 - 1, 2);
    }
    if (z.kind === 'runner') {
      c.fillStyle = P.zRot;
      c.fillRect(x + 1, hy - 1, 1, 1);                 // stray tuft of hair
      c.fillRect(x + 3, hy - 1, 1, 1);
    }
    // Health pip above anything that has taken damage.
    if (z.hp < z.maxHp) {
      const w = k.w * 2;
      c.fillStyle = '#000';
      c.fillRect(x, y - 3, w, 2);
      c.fillStyle = P.danger;
      c.fillRect(x, y - 3, Math.max(1, Math.round(w * (z.hp / z.maxHp))), 2);
    }
  }

  function drawBalloon(c, z, g) {
    const x = worldX(z.x + 0.5);
    const y = balloonY(z);
    const s = sprite('balloons');
    if (!s) return;
    const bob = Math.round(Math.sin(g.time * 2.5 + z.id) * 2);
    blit(c, 'balloons', x - s.w / 2, y - s.h + 8 + bob);
    // A blinking marker, because this one has to be noticed and popped.
    if (Math.floor(g.time * 4) % 2 === 0) {
      c.fillStyle = P.gold;
      textCentre(c, 'TAP!', x, y - s.h + bob - 8, P.gold, 1, P.ink);
    }
  }

  /* ---- eagle and crate --------------------------------------------------- */

  function drawEagle(c, g) {
    const e = g.eagle;
    if (e.state === 'gone') return;
    const flap = Math.floor(g.time * 12) % 2 === 0 ? 'eagleFlyUp' : 'eagleFlyDown';

    if (e.state === 'perched') {
      const ready = eagleReady(g);
      if (ready) {
        // Corner brackets that breathe. This is the whole tutorial for the
        // eagle, so it has to catch the eye without hiding the bird.
        const pulse = 2 + Math.round(Math.abs(Math.sin(g.time * 3)) * 2);
        bracket(c, e.x - 9 - pulse, e.y - 10 - pulse, 18 + pulse * 2, 20 + pulse * 2, P.gold, 4);
      }
      drawFoot(c, 'eaglePerch', e.x, e.y + 8);
      if (ready && Math.floor(g.time * 2) % 2 === 0) {
        textCentre(c, 'TAP', e.x - 22, e.y + 2, P.gold, 1, P.ink);
      }
      if (!ready) {
        const s = sprite('eaglePerch');
        c.fillStyle = 'rgba(20,16,30,0.55)';
        if (s) c.fillRect(e.x - s.w / 2, e.y - s.h + 8, s.w, s.h);
      }
      return;
    }
    blit(c, flap, e.x - 7, e.y - 5, e.flip);
    if (e.state === 'carry' && e.carried) {
      const z = e.carried;
      drawZombie(c, e.x + 2, e.y + 16, { ...z, state: 'walk', anim: g.time * 2 });
      c.fillStyle = P.eagleBeak;
      c.fillRect(Math.round(e.x + 1), Math.round(e.y + 4), 1, 4);
    }
  }

  function drawCrate(c, g) {
    if (!g.crate) return;
    const cr = g.crate;
    const s = sprite('crate');
    if (!s) return;
    blit(c, 'crate', cr.x + cr.sway - s.w / 2, cr.y - s.h / 2);
    if (Math.floor(g.time * 4) % 2 === 0) {
      textCentre(c, 'TAP!', cr.x + cr.sway, cr.y + s.h / 2 + 1, P.good, 1, P.ink);
    }
  }

  /* ---- effects ----------------------------------------------------------- */

  function drawParticles(c) {
    for (const p of fx.parts) {
      c.fillStyle = p.colour;
      c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
  }

  function drawPopups(c) {
    for (const p of fx.pops) {
      const a = Math.min(1, p.life * 2);
      if (a < 0.35 && Math.floor(p.life * 20) % 2 === 0) continue;   // flicker out
      textCentre(c, p.text, p.x, Math.round(p.y), p.colour, 1, P.ink);
    }
  }

  /* ---- HUD --------------------------------------------------------------- */

  function drawHud(c, g) {
    c.fillStyle = P.ink;
    c.fillRect(0, 0, VW, HUD_H);
    c.fillStyle = P.panelEdge;
    c.fillRect(0, HUD_H - 1, VW, 1);

    text(c, 'SCORE', 3, 2, P.textDim, 1);
    text(c, pad(displayScore(g), 8), 35, 2, P.text, 1);
    if (g.mult > 1) {
      const s = 'x' + g.mult;
      text(c, s, 92, 2, P.gold, 1);
    }

    text(c, 'WAVE', 3, 12, P.textDim, 1);
    text(c, pad(g.wave, 2), 29, 12, P.text, 1);

    // Breach pips: how many more get through before the rally is overrun.
    for (let i = 0; i < BREACH_LIMIT; i++) {
      const lost = i < g.breaches;
      text(c, '♥', 46 + i * 8, 12, lost ? '#3a2233' : P.danger, 1);
    }

    // Wave timer.
    const frac = g.phase === 'break' ? 1 : Math.min(1, g.waveT / WAVE.length);
    c.fillStyle = P.panel;
    c.fillRect(74, 15, 74, 4);
    c.fillStyle = g.phase === 'break' ? P.good : P.gold;
    c.fillRect(74, 15, Math.round(74 * frac), 4);
    c.fillStyle = P.panelEdge;
    c.fillRect(74, 15, 74, 1);

    drawNextBox(c, g, 152, 1);
  }

  function drawNextBox(c, g, x, y) {
    const w = 53;
    const h = 21;
    c.fillStyle = P.panel;
    c.fillRect(x, y, w, h);
    c.fillStyle = P.panelEdge;
    c.strokeStyle = P.panelEdge;
    c.fillRect(x, y, w, 1);
    c.fillRect(x, y + h - 1, w, 1);
    c.fillRect(x, y, 1, h);
    c.fillRect(x + w - 1, y, 1, h);
    text(c, 'NEXT', x + 3, y + 2, P.textDim, 1);
    if (!g.nextShape) return;
    const st = { shape: g.nextShape, rot: 0 };
    const s = pieceState(st);
    const cs = 5;
    const ox = x + 32 - (s.w * cs) / 2;
    const oy = y + 11 - (s.h * cs) / 2;
    for (const [dx, dy] of s.cells) {
      const bx = Math.round(ox + dx * cs);
      const by = Math.round(oy + (s.h - 1 - dy) * cs);
      c.fillStyle = P.tier[0].top;
      c.fillRect(bx, by, cs, cs);
      c.fillStyle = '#ffa86a';
      c.fillRect(bx, by, cs, 1);
      c.fillStyle = P.tier[0].line;
      c.fillRect(bx + cs - 1, by, 1, cs);
      c.fillRect(bx, by + cs - 1, cs, 1);
    }
  }

  /* ---- control bar -------------------------------------------------------- */

  function drawBar(c, vh, input) {
    c.fillStyle = P.ink;
    c.fillRect(0, SCENE_H, VW, vh - SCENE_H);
    c.fillStyle = P.panelEdge;
    c.fillRect(0, SCENE_H, VW, 1);
    const btns = layoutButtons(vh);
    for (const btn of btns) {
      drawButton(c, btn, input.isDown(btn.id));
    }
  }

  function drawButton(c, btn, down) {
    const { x, y, w, h, id } = btn;
    const oy = down ? 1 : 0;
    c.fillStyle = P.black;
    c.fillRect(x, y + 2, w, h);
    c.fillStyle = down ? P.btnLit : P.btn;
    c.fillRect(x, y + oy, w, h);
    c.fillStyle = P.btnEdge;
    c.fillRect(x, y + oy, w, 1);
    c.fillRect(x, y + oy, 1, h);
    c.fillStyle = '#1a1530';
    c.fillRect(x, y + oy + h - 1, w, 1);
    c.fillRect(x + w - 1, y + oy, 1, h);
    const cx = Math.round(x + w / 2);
    const cy = Math.round(y + oy + h / 2);
    if (id === 'hard') {
      textCentre(c, 'DROP', cx, cy - 7, P.gold, 2, P.ink);
    } else {
      icon(c, id, cx, cy, P.text);
    }
  }

  function scanlines(c, vh) {
    c.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < vh; y += 2) c.fillRect(0, y, VW, 1);
  }
}

/* -------------------------------------------------------------------------- */
/* Effects state, fed by simulation events                                    */
/* -------------------------------------------------------------------------- */

const CRACKS = [
  [[4, 3], [5, 4], [5, 5], [6, 6], [10, 9], [11, 10], [11, 11]],
  [[10, 2], [10, 3], [9, 4], [9, 5], [3, 9], [4, 10], [4, 11]],
  [[7, 2], [6, 3], [6, 4], [7, 5], [12, 8], [11, 9], [12, 10]],
  [[3, 4], [4, 5], [4, 6], [3, 7], [9, 10], [10, 11], [8, 12]],
];

export function stepFx(fx, dt) {
  fx.cheer = Math.max(0, fx.cheer - dt);
  fx.boo = Math.max(0, fx.boo - dt);
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    const p = fx.parts[i];
    p.life -= dt;
    if (p.life <= 0) { fx.parts.splice(i, 1); continue; }
    p.vy += 260 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > GROUND_Y + 8) { p.y = GROUND_Y + 8; p.vy *= -0.35; p.vx *= 0.6; }
  }
  for (let i = fx.pops.length - 1; i >= 0; i--) {
    const p = fx.pops[i];
    p.life -= dt;
    p.y -= 14 * dt;
    if (p.life <= 0) fx.pops.splice(i, 1);
  }
  // Hard caps: a long run should never accumulate thousands of these.
  if (fx.parts.length > 160) fx.parts.splice(0, fx.parts.length - 160);
  if (fx.pops.length > 12) fx.pops.splice(0, fx.pops.length - 12);
}

export function burst(fx, x, y, n, colour, spread = 60, up = 90) {
  for (let i = 0; i < n; i++) {
    fx.parts.push({
      x, y,
      vx: (Math.random() - 0.5) * spread * 2,
      vy: -Math.random() * up - 10,
      life: 0.4 + Math.random() * 0.5,
      colour,
      s: Math.random() < 0.3 ? 2 : 1,
    });
  }
}

/** Translate one simulation event into noise and confetti. */
export function reactToEvent(fx, e) {
  switch (e.t) {
    case 'popup': {
      // Repeated identical popups in the same spot pile into an unreadable
      // smear; refresh the existing one instead of adding another.
      const same = fx.pops.find((q) => q.text === e.text && Math.abs(q.x - e.x) < 16 && Math.abs(q.y - e.y) < 16);
      if (same) { same.life = 1.1; same.y = e.y; break; }
      fx.pops.push({ x: e.x, y: e.y, text: e.text, colour: e.colour, life: 1.1 });
      break;
    }
    case 'break':
      burst(fx, colX(e.c) + 8, rowY(e.r) + 8, 10, P.tier[e.tier || 0].face, 70, 110);
      break;
    case 'chew':
      burst(fx, colX(e.c) + 2, rowY(e.r) + 8, 2, P.tier[0].shade, 30, 40);
      break;
    case 'bite':
      burst(fx, e.x, e.y, 2, '#c88a5a', 26, 36);
      break;
    case 'kill':
      burst(fx, e.x, e.y, e.how === 'eagle' ? 6 : 12, P.zBlood, 80, 120);
      burst(fx, e.x, e.y, 4, P.zSkin, 70, 100);
      fx.cheer = 0.9;
      break;
    case 'seal':
      for (let c = 0; c < COLS; c++) burst(fx, colX(c) + 8, rowY(e.row) + 8, 4, P.gold, 50, 120);
      fx.cheer = 1.6;
      break;
    case 'breach':
      fx.boo = 2.2;
      burst(fx, worldX(COLS + 0.5), GROUND_Y - 6, 16, P.danger, 90, 130);
      break;
    case 'balloon_pop':
      burst(fx, e.x, e.y - 20, 14, P.flagRed, 90, 60);
      fx.cheer = 1.0;
      break;
    case 'crate_take':
      fx.cheer = 1.6;
      break;
    case 'topple':
      fx.boo = 1.2;
      break;
    default:
      break;
  }
}
