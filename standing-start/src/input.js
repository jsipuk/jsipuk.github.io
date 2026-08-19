/* Standing Start — touch interpretation.
 *
 * The whole game is one thumb, so the hard part is telling a hard turn-in
 * apart from a deliberate drift. The spec's flick test overlaps with ordinary
 * cornering — turning in hard *is* a fast sideways drag — so three entry
 * models are implemented and switchable while driving. Model B is the default
 * because it cannot be triggered by accident: the drift only starts once the
 * thumb travels past the end of the steering range.
 *
 * Keyboard input exists for desktop development. It synthesises the same
 * state the touch path produces and has no say in the design.
 */

const HISTORY_MS = 500;

export function createInput(el, cfg) {
  const input = {
    lock: 0,
    active: false,
    driftRequest: false,
    release: false,
    // Debug read-outs
    pointerX: 0, anchorX: 0, travel: 0, model: 'beyond',
    itemEvents: 0,
    lastItemAt: -99,
  };

  let pointerId = null;
  let anchorX = 0;
  let currentX = 0;
  let downAt = 0;
  let moved = 0;
  let history = [];
  let armed = true;        // false once a drift has been requested this touch
  let keyLock = 0;
  let keyDrift = false;
  let keyActive = false;
  let pendingRelease = false;

  const now = () => performance.now();

  function zoneTop() {
    return el.clientHeight * cfg.zoneTop;
  }

  function onDown(e) {
    if (e.clientY < zoneTop()) return;
    if (pointerId !== null) {
      // A second contact while driving is the item gesture. It deliberately
      // shares the play area, because the top of a portrait screen cannot be
      // reached by the thumb that is steering.
      input.itemEvents++;
      input.lastItemAt = now();
      e.preventDefault();
      return;
    }
    pointerId = e.pointerId;
    anchorX = currentX = e.clientX;
    downAt = now();
    moved = 0;
    armed = true;
    history = [{ t: downAt, x: currentX }];
    input.active = true;
    if (el.setPointerCapture) {
      try { el.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    }
    e.preventDefault();
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    currentX = e.clientX;
    moved = Math.max(moved, Math.abs(currentX - anchorX));
    const t = now();
    history.push({ t, x: currentX });
    while (history.length > 2 && t - history[0].t > HISTORY_MS) history.shift();
    e.preventDefault();
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    const held = now() - downAt;
    if (held <= cfg.tapMaxMs && moved <= cfg.tapMaxPx) {
      input.itemEvents++;
      input.lastItemAt = now();
    }
    pointerId = null;
    input.active = false;
    pendingRelease = true;
    history = [];
    e.preventDefault();
  }

  el.addEventListener('pointerdown', onDown, { passive: false });
  el.addEventListener('pointermove', onMove, { passive: false });
  el.addEventListener('pointerup', onUp, { passive: false });
  el.addEventListener('pointercancel', onUp, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { keyLock = -1; keyActive = true; }
    if (e.key === 'ArrowRight' || e.key === 'd') { keyLock = 1; keyActive = true; }
    if (e.key === 'Shift' || e.key === ' ') { keyDrift = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { if (keyLock < 0) { keyLock = 0; keyActive = false; } }
    if (e.key === 'ArrowRight' || e.key === 'd') { if (keyLock > 0) { keyLock = 0; keyActive = false; } }
    if (e.key === 'Shift' || e.key === ' ') { keyDrift = false; pendingRelease = true; }
  });

  /** Distance travelled within the gesture window, signed. */
  function windowTravel() {
    if (history.length < 2) return 0;
    const t = now();
    let oldest = history[0];
    for (const h of history) {
      if (t - h.t <= cfg.driftWindow) { oldest = h; break; }
    }
    return currentX - oldest.x;
  }

  function steerFromOffset(dx, range) {
    const dead = cfg.steerDeadzone;
    const mag = Math.abs(dx);
    if (mag <= dead) return 0;
    const span = Math.max(1, range - dead);
    return Math.sign(dx) * Math.min(1, (mag - dead) / span);
  }

  /** Read the current frame's input. Edge flags are cleared by reading. */
  input.read = function read() {
    const models = ['flick', 'beyond', 'zone'];
    const model = models[cfg.driftModel] || 'beyond';
    input.model = model;

    let lock = 0;
    let wantDrift = false;

    if (pointerId !== null) {
      if (model === 'zone') {
        const centre = el.clientWidth / 2;
        const range = el.clientWidth * cfg.zoneRange;
        const dx = currentX - centre;
        lock = steerFromOffset(dx, range);
        input.travel = dx;
        if (armed && Math.abs(dx) >= range + cfg.driftOvertravel) wantDrift = true;
      } else {
        const dx = currentX - anchorX;
        lock = steerFromOffset(dx, cfg.steerRange);
        input.travel = dx;
        if (model === 'beyond') {
          if (armed && Math.abs(dx) >= cfg.steerRange + cfg.driftOvertravel) wantDrift = true;
        } else {
          const flick = windowTravel();
          if (armed && Math.abs(flick) >= cfg.driftFlickDist &&
              Math.sign(flick) === Math.sign(lock) && Math.abs(lock) >= cfg.driftMinLock) {
            wantDrift = true;
          }
        }
      }
      if (wantDrift) armed = false;
      input.pointerX = currentX;
      input.anchorX = model === 'zone' ? el.clientWidth / 2 : anchorX;
    } else if (keyActive || keyDrift) {
      lock = keyLock;
      input.travel = 0;
      if (keyDrift && armed) { wantDrift = true; armed = false; }
      if (!keyDrift) armed = true;
    } else {
      input.travel = 0;
      armed = true;
    }

    input.lock = lock;
    input.active = pointerId !== null || (keyDrift && keyActive) || keyDrift;
    input.driftRequest = wantDrift;
    input.release = pendingRelease;
    pendingRelease = false;
    return input;
  };

  return input;
}
