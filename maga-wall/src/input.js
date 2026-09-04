/* Touch and keyboard.
 *
 * The controls are visible buttons rather than gestures. Swipes read beautifully
 * in a design document and then lose you a piece every time your thumb drifts,
 * and this game already spends taps on the eagle, the balloons and the crate —
 * putting movement on gestures too would make those three fight the piece.
 *
 * The only gestures are taps on the scene itself, and those are routed to
 * sim.tapScene, which owns every tappable object.
 */

import { SCENE_H, PIECE } from './config.js';

/**
 * Button rectangles, in buffer pixels. The bar's height flexes with the
 * viewport, so the layout is computed rather than constant.
 */
export function layoutButtons(vh) {
  const top = SCENE_H;
  const avail = vh - top;
  const pad = 5;
  const h1 = 46;
  const gap = 4;
  const h2 = Math.max(28, avail - pad * 2 - h1 - gap);
  const y1 = top + pad;
  const y2 = y1 + h1 + gap;
  return [
    { id: 'left', glyph: '◀', x: 4, y: y1, w: 52, h: h1 },
    { id: 'right', glyph: '▶', x: 60, y: y1, w: 52, h: h1 },
    { id: 'rotate', glyph: '↺', x: 116, y: y1, w: 44, h: h1 },
    { id: 'soft', glyph: '▼', x: 164, y: y1, w: 40, h: h1 },
    { id: 'hard', glyph: 'DROP', x: 4, y: y2, w: 150, h: h2 },
    { id: 'pause', glyph: 'II', x: 158, y: y2, w: 46, h: h2 },
  ];
}

const hit = (btn, x, y) => x >= btn.x && x < btn.x + btn.w && y >= btn.y && y < btn.y + btn.h;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{toBuffer:(x:number,y:number)=>{x:number,y:number,inside:boolean}, view:{vh:number}}} renderer
 * @param {{onSceneTap:Function, onUiTap:Function, onUiKey:Function, onPause:Function, onEagle:Function, isPlaying:()=>boolean}} hooks
 */
export function createInput(canvas, renderer, hooks) {
  /** pointerId -> button id, or 'scene'. */
  const pointers = new Map();
  const down = new Set();
  const keys = new Set();
  const queue = [];
  const das = { dir: 0, t: 0, fired: false };
  let lastTap = 0;

  const isDown = (id) => down.has(id);

  function press(id) {
    if (down.has(id)) return;
    down.add(id);
    if (id === 'left' || id === 'right') {
      queue.push(id);
      das.dir = id === 'left' ? -1 : 1;
      das.t = 0;
      das.fired = true;
    } else if (id === 'rotate') queue.push('rotate');
    else if (id === 'hard') queue.push('hard');
    else if (id === 'pause') hooks.onPause();
  }

  function release(id) {
    down.delete(id);
    if ((id === 'left' && das.dir === -1) || (id === 'right' && das.dir === 1)) {
      // Fall back to the other direction if it is still held.
      das.dir = down.has('left') ? -1 : down.has('right') ? 1 : 0;
      das.t = 0;
    }
  }

  /* ---- pointers --------------------------------------------------------- */

  function locate(ev) {
    const rect = canvas.getBoundingClientRect();
    return renderer.toBuffer(ev.clientX - rect.left, ev.clientY - rect.top);
  }

  function onDown(ev) {
    ev.preventDefault();
    const p = locate(ev);
    if (!p.inside) return;
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* not fatal */ }

    if (!hooks.isPlaying()) {
      pointers.set(ev.pointerId, 'ui');
      hooks.onUiTap(p.x, p.y);
      return;
    }
    for (const btn of layoutButtons(renderer.view.vh)) {
      if (hit(btn, p.x, p.y)) {
        pointers.set(ev.pointerId, btn.id);
        press(btn.id);
        return;
      }
    }
    if (p.y < SCENE_H) {
      pointers.set(ev.pointerId, 'scene');
      const now = performance.now();
      if (now - lastTap > 120) { lastTap = now; hooks.onSceneTap(p.x, p.y); }
    }
  }

  function onMove(ev) {
    const id = pointers.get(ev.pointerId);
    if (id === undefined) return;
    ev.preventDefault();
    if (id === 'ui' || id === 'scene') return;
    // Sliding off a button releases it, sliding onto another presses it. This
    // makes the left/right buttons feel like a d-pad rather than two islands.
    const p = locate(ev);
    let over = null;
    for (const btn of layoutButtons(renderer.view.vh)) if (hit(btn, p.x, p.y)) { over = btn.id; break; }
    if (over === id) return;
    release(id);
    if (over && (over === 'left' || over === 'right' || over === 'soft')) {
      pointers.set(ev.pointerId, over);
      press(over);
    } else {
      pointers.set(ev.pointerId, 'none');
    }
  }

  function onUp(ev) {
    const id = pointers.get(ev.pointerId);
    pointers.delete(ev.pointerId);
    if (id && id !== 'ui' && id !== 'scene' && id !== 'none') release(id);
    try { canvas.releasePointerCapture(ev.pointerId); } catch { /* already gone */ }
  }

  canvas.addEventListener('pointerdown', onDown, { passive: false });
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---- keyboard, for desktop and for testing ----------------------------- */

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'soft', KeyS: 'soft',
    ArrowUp: 'rotate', KeyW: 'rotate', KeyX: 'rotate',
    Space: 'hard',
    KeyP: 'pause', Escape: 'pause',
  };

  function onKeyDown(ev) {
    if (ev.repeat) return;
    const id = KEYMAP[ev.code];
    if (ev.code === 'KeyZ') { queue.push('rotateCCW'); ev.preventDefault(); return; }
    if (ev.code === 'KeyE') { hooks.onEagle(); ev.preventDefault(); return; }
    if (ev.code === 'Enter' || ev.code === 'NumpadEnter') {
      ev.preventDefault();
      if (hooks.isPlaying()) return;
      hooks.onUiKey('enter');
      return;
    }
    if (!id) return;
    ev.preventDefault();
    if (!hooks.isPlaying()) { hooks.onUiKey(id); return; }
    keys.add(ev.code);
    press(id);
  }

  function onKeyUp(ev) {
    const id = KEYMAP[ev.code];
    if (!id) return;
    keys.delete(ev.code);
    // Only release if no other key still maps to the same action.
    for (const code of keys) if (KEYMAP[code] === id) return;
    release(id);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  /* ---- per-frame --------------------------------------------------------- */

  /**
   * Drain the queued discrete actions and run auto-repeat.
   * @returns {{actions: string[], soft: boolean}}
   */
  function consume(dt) {
    if (das.dir !== 0) {
      das.t += dt;
      const delay = das.fired ? PIECE.dasDelay : PIECE.dasRate;
      if (das.t >= delay) {
        das.t -= delay;
        das.fired = false;
        queue.push(das.dir < 0 ? 'left' : 'right');
      }
    }
    const actions = queue.slice();
    queue.length = 0;
    return { actions, soft: down.has('soft') };
  }

  /** Wipe held state, e.g. when pausing or on a screen change. */
  function reset() {
    pointers.clear();
    down.clear();
    keys.clear();
    queue.length = 0;
    das.dir = 0;
    das.t = 0;
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  return { consume, isDown, reset, destroy, layout: () => layoutButtons(renderer.view.vh) };
}

/** Stop the page itself from moving under the game. */
export function lockViewport() {
  const stop = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchstart', stop, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
}
