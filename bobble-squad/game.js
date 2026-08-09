/* Bobble Squad — the game.
 *
 * Physics, the player, the camera, actors, the buggy, building, gadgets,
 * particles and the render loop. Missions live next door in missions.js and
 * talk to this file through BS.on / BS.emit.
 *
 * Design rules that shaped the code, all of them for five-year-olds:
 *   - falling never hurts, it just puts you back somewhere sensible
 *   - you automatically step up anything one block high, so kerbs, stairs and
 *     blocks you have placed yourself never need a jump
 *   - the camera swings itself round behind you if you stop steering it
 *   - every button does something visible the instant it is pressed
 */
(function (global) {
  'use strict';

  var E = global.BSEngine;
  var M4 = E.M4;
  var C = global.BSWorld.C;

  var GRAV = -30;
  var JUMP_V = 10.2;
  var BOOTS_V = 18.4;
  var WALK = 6.4;
  var STEP_UP = 1.05;          // auto-climb: exactly one block, plus a nudge
  var VEH_STEP = 0.8;
  var FALL_Y = -26;

  var BLOCK_TYPES = [
    { name: 'block', col: C.teal, h: 1, icon: '🟦' },
    { name: 'bouncy', col: C.berry, h: 1, icon: '🟪' },
    { name: 'plank', col: C.lemon, h: 0.35, icon: '🟨' }
  ];

  var BS = {
    ready: false,
    paused: false,
    started: false,
    world: null,
    t: 0,
    badgesFound: {},
    gadgets: { sniffer: false, boots: false, mitt: false },
    bootsOn: false,
    activeGadget: -1,
    blocks: [],
    listeners: {},
    flags: {},
    stats: { badges: 0, blocks: 0 }
  };

  /* ------------------------------------------------------------- storage */

  var SAVE_KEY = 'bobblesquad:v1';

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        badges: Object.keys(BS.badgesFound),
        gadgets: BS.gadgets,
        mission: BS.missionSave ? BS.missionSave() : null,
        colour: BS.playerColour,
        sound: global.BSAudio.isEnabled()
      }));
    } catch (e) { /* private browsing, or storage full — play on regardless */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to do */ }
  }

  /* ------------------------------------------------------------- events */

  BS.on = function (name, fn) {
    (BS.listeners[name] || (BS.listeners[name] = [])).push(fn);
  };
  BS.emit = function (name, data) {
    var l = BS.listeners[name];
    if (!l) return;
    for (var i = 0; i < l.length; i++) l[i](data);
  };

  /* ------------------------------------------------------------ physics */

  var CELL = 8;
  var hash = {};
  var dynSolids = [];        // placed blocks and movers, scanned linearly
  var scratch = [];

  function hashKey(cx, cz) { return cx + ':' + cz; }

  function buildHash(solids) {
    hash = {};
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      var x0 = Math.floor(s.x0 / CELL), x1 = Math.floor((s.x1 - 0.001) / CELL);
      var z0 = Math.floor(s.z0 / CELL), z1 = Math.floor((s.z1 - 0.001) / CELL);
      for (var cx = x0; cx <= x1; cx++) {
        for (var cz = z0; cz <= z1; cz++) {
          var k = hashKey(cx, cz);
          (hash[k] || (hash[k] = [])).push(s);
        }
      }
    }
  }

  function gather(x0, y0, z0, x1, y1, z1) {
    scratch.length = 0;
    var cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL);
    var cz0 = Math.floor(z0 / CELL), cz1 = Math.floor(z1 / CELL);
    var i, s;
    for (var cx = cx0; cx <= cx1; cx++) {
      for (var cz = cz0; cz <= cz1; cz++) {
        var list = hash[hashKey(cx, cz)];
        if (!list) continue;
        for (i = 0; i < list.length; i++) {
          s = list[i];
          if (s.x1 <= x0 || s.x0 >= x1 || s.y1 <= y0 || s.y0 >= y1 || s.z1 <= z0 || s.z0 >= z1) continue;
          if (scratch.indexOf(s) < 0) scratch.push(s);
        }
      }
    }
    for (i = 0; i < dynSolids.length; i++) {
      s = dynSolids[i];
      if (!s.on) continue;
      if (s.x1 <= x0 || s.x0 >= x1 || s.y1 <= y0 || s.y0 >= y1 || s.z1 <= z0 || s.z0 >= z1) continue;
      scratch.push(s);
    }
    return scratch;
  }

  function ent(x, y, z, hw, h) {
    return { x: x, y: y, z: z, hw: hw, h: h, vy: 0, onGround: false, ground: null };
  }

  function overlapsAny(e) {
    return gather(e.x - e.hw, e.y + 0.02, e.z - e.hw, e.x + e.hw, e.y + e.h, e.z + e.hw).length > 0;
  }

  /* Only surfaces you could actually have landed on count. Without the
   * `prev` tests, brushing against a tall block while walking snaps you to
   * the top of it — which had the fountain pillar flinging people into the
   * air on contact. */
  function collideY(e, dy) {
    var prev = e.y;
    e.y += dy;
    var list = gather(e.x - e.hw, e.y, e.z - e.hw, e.x + e.hw, e.y + e.h, e.z + e.hw);
    if (!list.length) return false;
    var hit = false, i, s;
    if (dy <= 0) {
      var top = -Infinity, best = null;
      for (i = 0; i < list.length; i++) {
        s = list[i];
        if (s.y1 <= prev + 0.02 && s.y1 > top) { top = s.y1; best = s; }
      }
      if (top > -Infinity) { e.y = top; e.vy = 0; e.onGround = true; e.ground = best; hit = true; }
    } else {
      var head = prev + e.h - 0.02;
      var bot = Infinity;
      for (i = 0; i < list.length; i++) {
        s = list[i];
        if (s.y0 >= head && s.y0 < bot) bot = s.y0;
      }
      if (bot < Infinity) { e.y = bot - e.h; e.vy = 0; hit = true; }
    }
    return hit;
  }

  function collideX(e, dx) {
    if (!dx) return false;
    e.x += dx;
    var list = gather(e.x - e.hw, e.y + 0.05, e.z - e.hw, e.x + e.hw, e.y + e.h, e.z + e.hw);
    var hit = false;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (dx > 0) { if (s.x0 - e.hw < e.x) { e.x = s.x0 - e.hw; hit = true; } }
      else { if (s.x1 + e.hw > e.x) { e.x = s.x1 + e.hw; hit = true; } }
    }
    return hit;
  }

  function collideZ(e, dz) {
    if (!dz) return false;
    e.z += dz;
    var list = gather(e.x - e.hw, e.y + 0.05, e.z - e.hw, e.x + e.hw, e.y + e.h, e.z + e.hw);
    var hit = false;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (dz > 0) { if (s.z0 - e.hw < e.z) { e.z = s.z0 - e.hw; hit = true; } }
      else { if (s.z1 + e.hw > e.z) { e.z = s.z1 + e.hw; hit = true; } }
    }
    return hit;
  }

  /* Horizontal movement with the auto-step that makes the whole game gentle:
   * if we were blocked, try the same move again from one block higher, and if
   * that works, drop back onto the ledge we just found. */
  function moveXZ(e, dx, dz, stepUp) {
    var ox = e.x, oy = e.y, oz = e.z;
    var blocked = collideX(e, dx);
    blocked = collideZ(e, dz) || blocked;
    if (!blocked || !e.onGround || !stepUp) return blocked;

    var got = Math.abs(e.x - ox) + Math.abs(e.z - oz);
    var sx = e.x, sz = e.z;
    e.x = ox; e.z = oz; e.y = oy + stepUp;
    if (!overlapsAny(e)) {
      collideX(e, dx);
      collideZ(e, dz);
      if (Math.abs(e.x - ox) + Math.abs(e.z - oz) > got + 0.01) {
        e.vy = Math.min(e.vy, 0);
        collideY(e, -stepUp - 0.01);
        return false;
      }
    }
    e.x = sx; e.z = sz; e.y = oy;
    return true;
  }

  function groundYAt(x, z, fromY) {
    var list = gather(x - 0.2, -40, z - 0.2, x + 0.2, fromY, z + 0.2);
    var top = -40;
    for (var i = 0; i < list.length; i++) if (list[i].y1 > top && list[i].y1 <= fromY + 0.05) top = list[i].y1;
    return top;
  }

  /* ------------------------------------------------------------- helpers */

  function dist2(ax, ay, az, bx, by, bz) {
    var dx = ax - bx, dy = ay - by, dz = az - bz;
    return dx * dx + dy * dy + dz * dz;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function shade(col, k) { return [col[0] * k, col[1] * k, col[2] * k]; }

  /* ------------------------------------------------------- characters */

  var _m = M4.create(), _tmp = M4.create(), _lm = M4.create();

  var SKIN = [
    [246, 206, 172], [226, 172, 130], [176, 122, 86], [120, 82, 58]
  ];

  /* One chunky person: legs, body, arms, head, and the squad's bobble hat.
   * Fourteen boxes, drawn straight into the frame's dynamic batch. Sized to
   * fit inside the 1.7-unit collision box, with only the bobble sticking out
   * over the top. */
  function drawChar(B, c, x, y, z, yaw, walk, opt) {
    opt = opt || {};
    var s = opt.scale || 1;
    var sw = Math.sin(walk) * (opt.swing === undefined ? 0.7 : opt.swing);
    var bob = Math.abs(Math.cos(walk)) * 0.035 * (opt.swing === undefined ? 1 : opt.swing);
    M4.trs(_m, x, y + bob * s, z, yaw, 0, 0);

    // legs, swinging from the hip
    var legs = [[-0.135, sw], [0.135, -sw]];
    for (var i = 0; i < 2; i++) {
      M4.trs(_tmp, legs[i][0] * s, 0.46 * s, 0, 0, legs[i][1], 0);
      M4.multiply(_lm, _m, _tmp);
      B.boxT(_lm, 0, -0.23 * s, 0, 0.11 * s, 0.23 * s, 0.11 * s, c.trousers);
      B.boxT(_lm, 0, -0.42 * s, 0.03 * s, 0.125 * s, 0.06 * s, 0.145 * s, c.shoes || C.dark);
    }
    // body
    B.boxT(_m, 0, 0.75 * s, 0, 0.25 * s, 0.25 * s, 0.16 * s, c.shirt);
    B.boxT(_m, 0, 1.01 * s, 0, 0.27 * s, 0.05 * s, 0.18 * s, c.collar || shade(c.shirt, 0.78));
    /* Arms swing opposite the legs. A waving Bobble throws the right arm up
     * and flaps it; a pointing one holds it out straight towards whatever it
     * is pointing at. Both are what make "press me" feel answered. */
    var arms = [[-0.31, -sw], [0.31, sw]];
    var waveAmt = opt.wave > 0 ? Math.min(1, opt.wave * 1.6) : 0;
    for (i = 0; i < 2; i++) {
      var ang = arms[i][1];
      var roll = 0;
      if (i === 1 && waveAmt > 0) {
        ang = -2.4 + Math.sin(BS.t * 14) * 0.45;
        roll = -0.5 * waveAmt;
      } else if (i === 1 && opt.point) {
        ang = -1.5;
      }
      M4.trs(_tmp, arms[i][0] * s, 0.96 * s, 0, 0, ang, roll);
      M4.multiply(_lm, _m, _tmp);
      B.boxT(_lm, 0, -0.16 * s, 0, 0.072 * s, 0.16 * s, 0.09 * s, c.shirt);
      B.boxT(_lm, 0, -0.37 * s, 0, 0.072 * s, 0.06 * s, 0.09 * s, c.skin);
    }
    // head and face
    B.boxT(_m, 0, 1.26 * s, 0, 0.22 * s, 0.22 * s, 0.2 * s, c.skin);
    B.boxT(_m, -0.1 * s, 1.29 * s, 0.21 * s, 0.045 * s, 0.055 * s, 0.02 * s, C.dark);
    B.boxT(_m, 0.1 * s, 1.29 * s, 0.21 * s, 0.045 * s, 0.055 * s, 0.02 * s, C.dark);
    B.boxT(_m, 0, 1.15 * s, 0.21 * s, 0.075 * s, 0.022 * s, 0.02 * s, [196, 108, 108]);
    // the bobble hat: brim, crown, bobble. The squad's whole identity.
    if (c.hat !== false) {
      B.boxT(_m, 0, 1.5 * s, 0, 0.245 * s, 0.07 * s, 0.225 * s, c.hat);
      B.boxT(_m, 0, 1.62 * s, 0, 0.2 * s, 0.1 * s, 0.185 * s, c.hat, { tint: 0.1 });
      var bb = Math.sin(BS.t * 6 + x) * 0.02;
      B.boxT(_m, 0, (1.8 + bb) * s, 0, 0.095 * s, 0.095 * s, 0.095 * s, c.bobble);
    }
  }

  /* A Fizzbot: a hovering googly-eyed cube. Grumbo's whole workforce. */
  function drawFizzbot(B, f) {
    var hov = Math.sin(BS.t * 3 + f.phase) * 0.16;
    var spin = f.found ? BS.t * 1.2 + f.phase : f.phase + Math.sin(BS.t + f.phase) * 0.4;
    M4.trs(_m, f.x, f.y + hov, f.z, spin, 0, Math.sin(BS.t * 2 + f.phase) * 0.12);
    B.boxT(_m, 0, 0.45, 0, 0.38, 0.38, 0.38, f.col, { tint: 0.05 });
    B.boxT(_m, -0.16, 0.55, 0.39, 0.11, 0.13, 0.03, C.white);
    B.boxT(_m, 0.16, 0.55, 0.39, 0.11, 0.13, 0.03, C.white);
    var look = Math.sin(BS.t * 2.2 + f.phase) * 0.05;
    B.boxT(_m, -0.16 + look, 0.55, 0.42, 0.05, 0.06, 0.02, C.dark);
    B.boxT(_m, 0.16 + look, 0.55, 0.42, 0.05, 0.06, 0.02, C.dark);
    B.boxT(_m, 0, 0.33, 0.4, 0.14, 0.04, 0.02, f.found ? [120, 220, 140] : C.dark);
    // antenna with a blinking tip
    B.boxT(_m, 0, 0.92, 0, 0.04, 0.14, 0.04, C.metalDark);
    var blink = (Math.sin(BS.t * 5 + f.phase) > 0 || f.found) ? C.yellow : C.coral;
    B.boxT(_m, 0, 1.08, 0, 0.09, 0.09, 0.09, blink);
    // little legs
    B.boxT(_m, -0.22, 0.06, 0, 0.06, 0.08, 0.06, C.metalDark);
    B.boxT(_m, 0.22, 0.06, 0, 0.06, 0.08, 0.06, C.metalDark);
  }

  /* A Waddler: the town's resident round bird. Purely for delight. */
  function drawWaddler(B, a) {
    var wob = Math.sin(BS.t * 7 + a.phase) * 0.1;
    M4.trs(_m, a.x, a.y, a.z, a.yaw, 0, wob * 0.3);
    B.boxT(_m, 0, 0.4, 0, 0.3, 0.28, 0.36, a.col);
    B.boxT(_m, 0, 0.72, 0.12, 0.2, 0.19, 0.2, a.col, { tint: 0.08 });
    B.boxT(_m, 0, 0.68, 0.34, 0.09, 0.06, 0.1, C.orange);
    B.boxT(_m, -0.1, 0.78, 0.3, 0.045, 0.05, 0.02, C.dark);
    B.boxT(_m, 0.1, 0.78, 0.3, 0.045, 0.05, 0.02, C.dark);
    B.boxT(_m, -0.16, 0.08 + Math.max(0, wob) * 0.1, 0.06, 0.07, 0.08, 0.11, C.orange);
    B.boxT(_m, 0.16, 0.08 + Math.max(0, -wob) * 0.1, 0.06, 0.07, 0.08, 0.11, C.orange);
    B.boxT(_m, 0, 0.42, -0.34, 0.12, 0.1, 0.06, a.col, { tint: -0.1 });
  }

  /* The Puttabout: the squad's little electric explorer buggy. */
  function drawBuggy(B, v) {
    var squash = v.squash;
    M4.trs(_m, v.x, v.y, v.z, v.yaw, 0, v.roll);
    var hy = 1 - squash * 0.3;
    B.boxT(_m, 0, 0.62 * hy, 0, 1.0, 0.32, 1.55, C.coral, { tint: 0.04 });
    B.boxT(_m, 0, 0.95 * hy, -0.35, 0.82, 0.22, 0.9, C.teal);
    B.boxT(_m, 0, 1.45 * hy, -0.4, 0.66, 0.36, 0.62, C.white);   // seat back
    B.boxT(_m, 0, 1.05 * hy, 0.52, 0.62, 0.2, 0.34, C.yellow);   // dash
    B.boxT(_m, 0, 1.3 * hy, 0.46, 0.26, 0.07, 0.26, C.dark);     // wheel
    B.boxT(_m, -0.86, 0.98 * hy, 0.9, 0.16, 0.16, 0.16, C.lemon);// lamps
    B.boxT(_m, 0.86, 0.98 * hy, 0.9, 0.16, 0.16, 0.16, C.lemon);
    B.boxT(_m, 0, 1.9 * hy, -0.4, 0.2, 0.2, 0.2, C.berry);       // roof bobble
    B.boxT(_m, 0, 1.72 * hy, -0.4, 0.08, 0.2, 0.08, C.metalDark);
    var wheels = [[-1.02, 0.95], [1.02, 0.95], [-1.02, -0.95], [1.02, -0.95]];
    for (var i = 0; i < wheels.length; i++) {
      M4.trs(_tmp, wheels[i][0], 0.42, wheels[i][1], 0, v.wheel, 0);
      M4.multiply(_lm, _m, _tmp);
      B.boxT(_lm, 0, 0, 0, 0.16, 0.42, 0.42, C.dark);
      B.boxT(_lm, 0, 0, 0, 0.19, 0.16, 0.16, C.metal);
    }
  }

  /* --------------------------------------------------------- particles */

  var particles = [];

  function puff(x, y, z, n, col, opt) {
    opt = opt || {};
    for (var i = 0; i < n; i++) {
      if (particles.length > 260) break;
      particles.push({
        x: x + (Math.random() - 0.5) * (opt.spread || 1),
        y: y + Math.random() * (opt.spread || 1) * 0.5,
        z: z + (Math.random() - 0.5) * (opt.spread || 1),
        vx: (Math.random() - 0.5) * (opt.speed || 3),
        vy: (opt.up === undefined ? 3 : opt.up) + Math.random() * 3,
        vz: (Math.random() - 0.5) * (opt.speed || 3),
        life: opt.life || 1.2,
        max: opt.life || 1.2,
        size: opt.size || 0.16,
        grav: opt.grav === undefined ? -9 : opt.grav,
        col: col,
        alpha: opt.alpha || 255,
        spin: Math.random() * 6
      });
    }
  }

  function confetti(x, y, z, n) {
    var cols = [C.coral, C.teal, C.yellow, C.lilac, C.mint, C.berry];
    for (var i = 0; i < n; i++) {
      puff(x, y, z, 1, cols[i % cols.length], { spread: 2, speed: 6, up: 7, life: 2.2, size: 0.14 });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && p.grav < 0) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
    }
  }

  /* --------------------------------------------------------------- game */

  var R, input, canvas;
  var opaque, blend;
  var world;
  var player, cam, buggy;
  var actors = { fizzbots: [], npcs: [], waddlers: [] };
  var scan = { until: 0, ring: 0, nearest: null, dist: 999 };
  var buildMode = false, blockType = 0, ghost = null;
  var lastSafe = { x: 0, y: 0.2, z: 10 };
  var toastUntil = 0;
  var lookIdleTime = 0;
  var hudSafeTop = 150;
  var noteCooldown = {};
  var dom = {};

  BS.playerColour = 0;
  var PLAYER_KITS = [
    { shirt: C.teal, trousers: [58, 74, 120], hat: C.yellow, bobble: C.coral, skin: SKIN[0] },
    { shirt: C.coral, trousers: [86, 60, 110], hat: C.mint, bobble: C.lilac, skin: SKIN[1] },
    { shirt: C.lilac, trousers: [50, 70, 90], hat: C.coral, bobble: C.mint, skin: SKIN[2] },
    { shirt: C.mint, trousers: [70, 60, 100], hat: C.berry, bobble: C.yellow, skin: SKIN[3] }
  ];

  function $(id) { return document.getElementById(id); }

  BS.init = function () {
    canvas = $('game');
    R = new E.Renderer(canvas);
    opaque = new E.Builder(20000);
    blend = new E.Builder(8000);

    world = global.BSWorld.build();
    BS.world = world;
    buildHash(world.solids);

    for (var i = 0; i < world.bucketList.length; i++) {
      var bk = world.bucketList[i];
      R.addChunk(bk.builder, bk.bounds);
      bk.builder = null;                    // the vertices now live on the GPU
    }

    // movers become dynamic solids so doors and lifts really block and carry
    for (i = 0; i < world.movers.length; i++) {
      var mv = world.movers[i];
      mv.offset = 0;
      mv.target = 0;
      mv.visible = !mv.hiddenProp;
      dynSolids.push({
        x0: mv.x, y0: mv.y, z0: mv.z,
        x1: mv.x + mv.w, y1: mv.y + mv.h, z1: mv.z + mv.d,
        on: mv.solid && !mv.hiddenProp, mover: mv
      });
      mv.solidRef = dynSolids[dynSolids.length - 1];
    }

    player = ent(world.places.spawn.x, world.places.spawn.y, world.places.spawn.z, 0.36, 1.7);
    player.yaw = Math.PI;
    player.walk = 0;
    player.inVehicle = false;
    BS.player = player;

    cam = { yaw: 0, pitch: 0.30, dist: 9.5, x: 0, y: 0, z: 0 };
    BS.cam = cam;

    buggy = ent(19.5, 0, 14, 1.15, 1.7);
    buggy.yaw = 0; buggy.speed = 0; buggy.wheel = 0; buggy.roll = 0; buggy.squash = 0;
    BS.buggy = buggy;

    makeActors();
    cacheDom();
    input = new global.BSInput(canvas);
    input.attachStick($('stick'), $('knob'));
    input.onFirstInput = function () { global.BSAudio.unlock(); };
    wireButtons();

    var saved = load();
    if (saved) {
      if (saved.badges) for (i = 0; i < saved.badges.length; i++) BS.badgesFound[saved.badges[i]] = true;
      if (saved.gadgets) BS.gadgets = saved.gadgets;
      if (typeof saved.colour === 'number') BS.playerColour = saved.colour;
      if (saved.sound === false) global.BSAudio.setEnabled(false);
    }
    BS.savedMission = saved && saved.mission;
    BS.stats.badges = Object.keys(BS.badgesFound).length;

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();

    BS.ready = true;
    global.BSMissions.init(BS);
    refreshGadgetButtons();
    updateBadgeHud();
    requestAnimationFrame(frame);
  };

  function makeActors() {
    var fb = [
      { x: 3.4, y: 1.8, z: 3.4, col: C.coral, home: 'fountain' },
      { x: -10, y: 2.1, z: -10, col: C.mint, home: 'bench' },
      { x: 4, y: 0.2, z: -14, col: C.lilac, home: 'cafe' }
    ];
    for (var i = 0; i < fb.length; i++) {
      actors.fizzbots.push({
        id: 'fizz' + i, x: fb[i].x, y: fb[i].y, z: fb[i].z, col: fb[i].col,
        phase: i * 2.1, found: false, follow: false, ox: fb[i].x, oy: fb[i].y, oz: fb[i].z
      });
    }

    actors.npcs.push({
      id: 'pom', x: 6, y: 0, z: 5, yaw: Math.PI, walk: 0, scale: 1.08,
      kit: { shirt: C.teal, trousers: [40, 60, 100], hat: C.yellow, bobble: C.coral, skin: SKIN[1] },
      icon: '🧢', line: 'chief'
    });
    actors.npcs.push({
      id: 'shopkeep', x: 12, y: 0, z: -25, yaw: Math.PI, walk: 0, scale: 1,
      kit: { shirt: C.berry, trousers: [70, 60, 100], hat: C.lilac, bobble: C.mint, skin: SKIN[2] },
      icon: '👋', line: 'shop'
    });
    actors.npcs.push({
      id: 'walker1', x: -8, y: 0, z: 6, yaw: 0, walk: 0, scale: 0.95, wander: { cx: -8, cz: 6, r: 7 },
      kit: { shirt: C.orange, trousers: [60, 70, 90], hat: C.sky, bobble: C.yellow, skin: SKIN[0] },
      icon: '👋', line: 'hello'
    });
    actors.npcs.push({
      id: 'walker2', x: 9, y: 0, z: 24, yaw: 0, walk: 0, scale: 0.9, wander: { cx: 9, cz: 24, r: 8 },
      kit: { shirt: C.sky, trousers: [80, 60, 70], hat: C.berry, bobble: C.white, skin: SKIN[3] },
      icon: '👋', line: 'hello'
    });
    actors.npcs.push({
      id: 'grumbo', x: 0, y: 0, z: -6, yaw: 0, walk: 0, scale: 1, hidden: true,
      kit: {
        shirt: [120, 108, 168], trousers: [70, 64, 100], hat: C.orange,
        bobble: C.berry, skin: SKIN[1], shoes: [90, 60, 40]
      },
      icon: '🙃', line: 'grumbo'
    });

    for (i = 0; i < 3; i++) {
      actors.waddlers.push({
        x: -40 + Math.cos(i * 2) * 6, y: 0, z: -8 + Math.sin(i * 2) * 6, yaw: i,
        col: [[250, 250, 250], [255, 226, 150], [190, 220, 250]][i],
        phase: i * 1.7, timer: 0, tx: -40, tz: -8
      });
    }
  }

  /* --------------------------------------------------------------- DOM */

  function cacheDom() {
    ['missionIcon', 'missionText', 'missionPips', 'badgeCount', 'markers', 'chevron',
      'toast', 'overlayStart', 'overlayPause', 'rotateHint', 'scanMeter', 'scanPips',
      'buildBar', 'btnAction', 'actionIcon', 'btnJump', 'btnBuild', 'btnPause',
      'btnG1', 'btnG2', 'btnG3', 'gadgetRow', 'btnPlace', 'btnRemove', 'btnDone',
      'swatches', 'hud', 'btnMap', 'mapOverlay', 'mapCanvas', 'btnMapClose'].forEach(function (id) { dom[id] = $(id); });
  }

  function wireButtons() {
    input.attachButton(dom.btnJump, 'jump');
    input.attachButton(dom.btnAction, 'action');
    input.attachButton(dom.btnBuild, 'build');
    input.attachButton(dom.btnG1, 'gadget1');
    input.attachButton(dom.btnG2, 'gadget2');
    input.attachButton(dom.btnG3, 'gadget3');
    input.attachButton(dom.btnPlace, 'place');
    input.attachButton(dom.btnRemove, 'removeBlock');
    input.attachButton(dom.btnDone, 'buildDone');

    for (var i = 0; i < 3; i++) {
      (function (n) {
        var el = $('swatch' + n);
        el.addEventListener('pointerdown', function (e) {
          e.preventDefault(); e.stopPropagation();
          blockType = n;
          refreshSwatches();
          global.BSAudio.play('click');
        }, { passive: false });
      })(i);
    }

    dom.btnMap.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      setMap(!mapOpen);
    }, { passive: false });
    dom.btnMapClose.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      setMap(false);
    }, { passive: false });

    dom.btnPause.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      setPaused(!BS.paused);
    }, { passive: false });

    $('btnResume').addEventListener('click', function () { setPaused(false); });
    $('btnSound').addEventListener('click', function () {
      global.BSAudio.setEnabled(!global.BSAudio.isEnabled());
      refreshSoundBtn();
      save();
    });
    $('btnHome').addEventListener('click', function () {
      teleport(world.places.spawn.x, world.places.spawn.y, world.places.spawn.z);
      setPaused(false);
    });
    $('btnWipe').addEventListener('click', function () {
      var on = !$('wipeConfirm').classList.contains('show');
      $('wipeConfirm').classList.toggle('show', on);
      // swap the menu out for the question so the panel never outgrows a phone
      $('overlayPause').querySelector('.panel').classList.toggle('confirming', on);
    });
    $('btnWipeYes').addEventListener('click', function () {
      wipe();
      location.reload();
    });
    $('btnWipeNo').addEventListener('click', function () {
      $('wipeConfirm').classList.remove('show');
      $('overlayPause').querySelector('.panel').classList.remove('confirming');
    });

    var kits = document.querySelectorAll('#kitPick .kit');
    for (i = 0; i < kits.length; i++) {
      (function (el, n) {
        el.addEventListener('click', function () {
          BS.playerColour = n;
          for (var j = 0; j < kits.length; j++) kits[j].classList.toggle('sel', j === n);
          global.BSAudio.unlock();
          global.BSAudio.play('click');
        });
      })(kits[i], i);
    }

    $('btnPlay').addEventListener('click', function () {
      global.BSAudio.unlock();
      global.BSAudio.play('fanfare');
      dom.overlayStart.classList.remove('show');
      BS.started = true;
      save();
    });

    refreshSoundBtn();
    refreshSwatches();
  }

  function refreshSoundBtn() {
    var on = global.BSAudio.isEnabled();
    $('btnSound').textContent = on ? '🔊  Sound is on' : '🔇  Sound is off';
  }

  function refreshSwatches() {
    for (var i = 0; i < 3; i++) $('swatch' + i).classList.toggle('sel', i === blockType);
  }

  function refreshGadgetButtons() {
    dom.btnG1.classList.toggle('hidden', !BS.gadgets.sniffer);
    dom.btnG2.classList.toggle('hidden', !BS.gadgets.boots);
    dom.btnG3.classList.toggle('hidden', !BS.gadgets.mitt);
    dom.btnG2.classList.toggle('on', BS.bootsOn);
  }

  function updateBadgeHud() {
    BS.stats.badges = Object.keys(BS.badgesFound).length;
    dom.badgeCount.textContent = BS.stats.badges + '/' + world.badges.length;
  }

  var toastTimer = null;
  BS.toast = function (icon, text, secs) {
    dom.toast.innerHTML = '<span class="ti">' + icon + '</span>' + (text ? '<span>' + text + '</span>' : '');
    dom.toast.classList.add('show');
    toastUntil = BS.t + (secs || 3);
  };

  function setPaused(p) {
    if (!p && mapOpen) setMap(false);
    BS.paused = p;
    dom.overlayPause.classList.toggle('show', p);
    if (!p) {
      $('wipeConfirm').classList.remove('show');
      dom.overlayPause.querySelector('.panel').classList.remove('confirming');
    }
  }
  BS.setPaused = setPaused;

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    // Cap the pixel ratio: an iPad's 2x is lovely but 3x is wasted on boxes.
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > 4.6e6) dpr = Math.min(dpr, 1.5);
    R.resize(w, h, dpr);
    dom.rotateHint.classList.toggle('show', h > w * 1.06);
    /* Where a speech bubble is allowed to start. offsetTop ignores transforms,
     * so it gives the toast's real resting place even while it is hidden — but
     * its HEIGHT is useless here because the toast is empty at startup, so a
     * fixed allowance covers the tallest it ever gets. The toast drops down the
     * screen on narrow layouts and the bubble has to clear it. */
    hudSafeTop = Math.max(150, (dom.toast.offsetTop || 0) + 100);
  }

  /* ------------------------------------------------------------- actions */

  function teleport(x, y, z) {
    if (player.inVehicle) exitVehicle();
    player.x = x; player.y = y; player.z = z; player.vy = 0;
    lastSafe = { x: x, y: y, z: z };
    puff(x, y + 0.5, z, 14, C.teal, { spread: 1.2, up: 4, life: 0.9 });
    global.BSAudio.play('whoosh');
  }
  BS.teleport = teleport;

  function findInteractable(id) {
    for (var i = 0; i < world.interactables.length; i++) {
      if (world.interactables[i].id === id) return world.interactables[i];
    }
    return null;
  }
  BS.interactable = findInteractable;

  function findMover(id) {
    for (var i = 0; i < world.movers.length; i++) if (world.movers[i].id === id) return world.movers[i];
    return null;
  }
  BS.mover = findMover;

  BS.actor = function (id) {
    for (var i = 0; i < actors.npcs.length; i++) if (actors.npcs[i].id === id) return actors.npcs[i];
    return null;
  };
  BS.fizzbots = actors.fizzbots;

  /* What the action button will act on right now: the vehicle if we are in it
   * or next to it, otherwise the nearest thing worth pressing. */
  function currentTarget() {
    if (player.inVehicle) return { kind: 'exit', icon: '🚪' };
    var px = player.x, py = player.y + 0.9, pz = player.z;
    if (dist2(px, py, pz, buggy.x, buggy.y + 0.8, buggy.z) < 12) {
      return { kind: 'enter', icon: '🚙' };
    }
    var best = null, bestD = 1e9;
    for (var i = 0; i < world.interactables.length; i++) {
      var it = world.interactables[i];
      if (it.locked || it.done) continue;
      if (it.hidden && !it.revealed) continue;
      var d = dist2(px, py, pz, it.x, it.y + 0.6, it.z);
      if (d < it.r * it.r && d < bestD) { bestD = d; best = it; }
    }
    for (i = 0; i < actors.fizzbots.length; i++) {
      var f = actors.fizzbots[i];
      if (f.found) continue;
      var fd = dist2(px, py, pz, f.x, f.y + 0.5, f.z);
      if (fd < 9 && fd < bestD) { bestD = fd; best = { kind: 'fizzbot', bot: f, icon: '🤖', x: f.x, y: f.y + 1, z: f.z }; }
    }
    for (i = 0; i < actors.npcs.length; i++) {
      var n = actors.npcs[i];
      if (n.hidden) continue;
      var nd = dist2(px, py, pz, n.x, n.y + 1, n.z);
      if (nd < 9 && nd < bestD) { bestD = nd; best = { kind: 'npc', npc: n, icon: n.icon, x: n.x, y: n.y + 2.4, z: n.z }; }
    }
    for (i = 0; i < actors.waddlers.length; i++) {
      var wd2 = actors.waddlers[i];
      var wdd = dist2(px, py, pz, wd2.x, wd2.y + 0.5, wd2.z);
      if (wdd < 6.25 && wdd < bestD) { bestD = wdd; best = { kind: 'waddler', a: wd2, icon: '🐤', x: wd2.x, y: wd2.y + 1.2, z: wd2.z }; }
    }
    return best;
  }

  function doAction() {
    var t = currentTarget();
    if (!t) { global.BSAudio.play('click'); return; }
    if (t.kind === 'exit') { exitVehicle(); return; }
    if (t.kind === 'enter') { enterVehicle(); return; }
    if (t.kind === 'fizzbot') {
      t.bot.found = true;
      t.bot.follow = true;
      puff(t.bot.x, t.bot.y + 0.8, t.bot.z, 16, C.yellow, { spread: 0.9, up: 4, life: 1 });
      global.BSAudio.play('pick');
      BS.toast('🤖', 'Friend!', 1.6);
      BS.emit('fizzbot', t.bot);
      return;
    }
    if (t.kind === 'npc') {
      talkTo(t.npc);
      return;
    }
    if (t.kind === 'waddler') {
      global.BSAudio.play('quack');
      t.a.hop = 1;
      puff(t.a.x, t.a.y + 0.8, t.a.z, 8, [255, 245, 200], { spread: 0.6, up: 3, life: 0.8 });
      return;
    }
    useInteractable(t);
  }

  /* Pressing a Bobble used to play a duck quack and puff six white specks two
   * and a half units above their head, which read as nothing happening at all.
   * Now they turn to you, wave, and every one of them actually does something:
   * the Chief points at your objective, the shopkeeper restyles your hat, and
   * the townsfolk hand out jokes, high fives and directions to nearby badges. */
  function talkTo(npc) {
    npc.wave = 1.4;
    npc.faceUntil = BS.t + 3.5;
    var role = npc.line || 'hello';

    if (role === 'chief') {
      var mi = global.BSMissions.current();
      bubble(npc, mi ? mi.icon : '🏅', 3.4);
      global.BSAudio.play('hint');
      if (mi && mi.target) {
        BS.hintPulse = BS.t + 5;
        for (var k = 0; k < 14; k++) {
          puff(mi.target.x, mi.target.y + 1 + k * 0.5, mi.target.z, 1, C.yellow,
            { spread: 0.6, up: 1.2, life: 1.6, grav: -1, size: 0.22 });
        }
      }
      BS.toast(mi ? mi.icon : '🏅', mi ? mi.text : 'Find the badges', 3.5);
      BS.emit('npc', npc);
      return;
    }

    if (role === 'shop') {
      BS.playerColour = (BS.playerColour + 1) % PLAYER_KITS.length;
      bubble(npc, '🎩', 2.6);
      global.BSAudio.play('pick');
      confetti(player.x, player.y + 1.6, player.z, 14);
      BS.toast('🎩', 'New hat!', 2);
      save();
      BS.emit('npc', npc);
      return;
    }

    if (role === 'grumbo') {
      npc.hop = 1;
      bubble(npc, ['🙃', '🫧', '🤗', '🎉'][Math.floor(Math.random() * 4)], 2.6);
      global.BSAudio.play('laugh');
      confetti(npc.x, npc.y + 2, npc.z, 12);
      BS.emit('npc', npc);
      return;
    }

    /* Townsfolk. If a badge the player has not found is nearby they point at
     * it, which turns every Bobble into a soft, optional hint system. */
    var near = null, nearD = 900;
    for (var i = 0; i < world.badges.length; i++) {
      var bg = world.badges[i];
      if (BS.badgesFound[bg.id]) continue;
      var d = dist2(npc.x, npc.y, npc.z, bg.x, bg.y, bg.z);
      if (d < nearD) { nearD = d; near = bg; }
    }
    if (near && nearD < 900 && Math.random() < 0.6) {
      npc.point = { x: near.x, y: near.y, z: near.z, until: BS.t + 4 };
      bubble(npc, '🏅', 3.2);
      global.BSAudio.play('hint');
      for (var j = 0; j < 10; j++) {
        puff(near.x, near.y + j * 0.35, near.z, 1, C.gold,
          { spread: 0.5, up: 1, life: 1.4, grav: -1, size: 0.2 });
      }
    } else {
      var greets = ['👋', '😄', '🎉', '🍩', '🐤', '⭐'];
      bubble(npc, greets[Math.floor(Math.random() * greets.length)], 2.4);
      global.BSAudio.play(Math.random() < 0.4 ? 'laugh' : 'hello');
      npc.hop = 1;
      puff(npc.x, npc.y + 2.1, npc.z, 8, C.yellow, { spread: 0.7, up: 2.4, life: 0.9, size: 0.13 });
    }
    BS.emit('npc', npc);
  }

  /* A speech bubble is a DOM chip pinned over a head — the world is drawn from
   * untextured boxes, so there is nowhere to put a picture in 3D. */
  var bubbles = [];
  function bubble(actor, icon, secs) {
    bubbles.push({ actor: actor, icon: icon, until: BS.t + (secs || 2.5) });
    if (bubbles.length > 4) bubbles.shift();
  }
  BS.bubble = bubble;

  function useInteractable(it) {
    switch (it.kind) {
      case 'honk':
        global.BSAudio.play(it.id.indexOf('bell') === 0 ? 'moo' : 'honk');
        puff(it.x, it.y + 0.6, it.z, 10, C.yellow, { spread: 0.8, up: 3, life: 0.7 });
        BS.toast(it.id.indexOf('bell') === 0 ? '🐄' : '📣', '', 1.2);
        break;
      case 'fountain':
        global.BSAudio.play('bubble');
        for (var i = 0; i < 22; i++) {
          puff(0, 4.8, 0, 1, [200, 240, 255], { spread: 2.4, speed: 2, up: 5, life: 2, grav: -3, size: 0.2, alpha: 190 });
        }
        BS.emit('fountain', it);
        break;
      case 'tube':
        teleport(it.data.to.x, it.data.to.y, it.data.to.z);
        BS.emit('tube', it);
        break;
      case 'lift': {
        var mv = findMover(it.data.mover);
        if (mv) {
          mv.target = mv.target > 0.5 ? 0 : 1;
          global.BSAudio.play('door');
          BS.toast('🛗', '', 1.2);
        }
        break;
      }
      case 'panel': {
        var door = findMover(it.data.mover);
        if (door) door.target = 1;
        it.done = true;
        global.BSAudio.play('door');
        puff(it.x, it.y, it.z, 20, C.rock, { spread: 1.6, up: 3, life: 1.2 });
        var tube = findInteractable('rock-tube');
        if (tube) tube.locked = false;
        BS.emit('panel', it);
        break;
      }
      case 'crate': {
        it.done = true;
        var prop = it.data && it.data.prop ? findMover(it.data.prop) : null;
        if (prop) { prop.visible = false; if (prop.solidRef) prop.solidRef.on = false; }
        confetti(it.x, it.y + 1, it.z, 26);
        global.BSAudio.play('badge');
        BS.emit('crate', it);
        break;
      }
      case 'bench':
        it.done = true;
        confetti(it.x, it.y + 1, it.z, 24);
        global.BSAudio.play('badge');
        BS.emit('bench', it);
        break;
      default:
        global.BSAudio.play('click');
    }
  }

  /* -------------------------------------------------------------- vehicle */

  function enterVehicle() {
    player.inVehicle = true;
    cam.dist = 12.5;
    global.BSAudio.play('engine');
    BS.toast('🚙', '', 1.4);
    BS.emit('enterVehicle');
  }

  function exitVehicle() {
    player.inVehicle = false;
    cam.dist = 9.5;
    // step out to the left of the buggy, then drop to whatever is under us
    var ox = Math.cos(buggy.yaw) * 2.2, oz = -Math.sin(buggy.yaw) * 2.2;
    player.x = buggy.x + ox;
    player.z = buggy.z + oz;
    player.y = buggy.y + 1.2;
    player.vy = 0;
    if (overlapsAny(player)) { player.x = buggy.x - ox; player.z = buggy.z - oz; }
    if (overlapsAny(player)) { player.x = buggy.x; player.z = buggy.z; player.y = buggy.y + 2; }
    global.BSAudio.play('click');
    BS.emit('exitVehicle');
  }

  function updateBuggy(dt, driving) {
    var throttle = 0, steer = 0;
    if (driving) {
      throttle = -input.move.y;
      steer = input.move.x;
      if (input.keys) { /* keyboard is merged into move by input.beginFrame */ }
    }
    var accel = throttle * 16;
    if (Math.abs(throttle) < 0.05) buggy.speed *= Math.pow(0.12, dt);
    buggy.speed += accel * dt;
    buggy.speed = clamp(buggy.speed, -5.5, 12);
    if (Math.abs(buggy.speed) < 0.02) buggy.speed = 0;

    // steering only bites when moving, and always in the direction of travel
    var grip = clamp(Math.abs(buggy.speed) / 3.5, 0, 1);
    buggy.yaw += steer * 2.0 * dt * grip * (buggy.speed < 0 ? -1 : 1);
    buggy.roll = lerp(buggy.roll, -steer * grip * 0.13, Math.min(1, dt * 6));

    var fx = Math.sin(buggy.yaw), fz = Math.cos(buggy.yaw);
    var dx = fx * buggy.speed * dt, dz = fz * buggy.speed * dt;

    buggy.vy += GRAV * dt;
    buggy.onGround = false;
    collideY(buggy, buggy.vy * dt);

    var hitWall = moveXZ(buggy, dx, dz, VEH_STEP);
    if (hitWall && Math.abs(buggy.speed) > 3) {
      // soft, funny bounce: never a crash, just a bonk and a wobble
      global.BSAudio.play('bonk');
      buggy.squash = 1;
      puff(buggy.x + fx * 1.6, buggy.y + 1, buggy.z + fz * 1.6, 10, C.yellow,
        { spread: 1, up: 3, life: 0.7, size: 0.2 });
      buggy.speed = -buggy.speed * 0.28;
    } else if (hitWall) {
      buggy.speed *= 0.3;
    }
    buggy.squash = Math.max(0, buggy.squash - dt * 3.4);
    buggy.wheel += buggy.speed * dt * 1.6;

    if (buggy.y < FALL_Y) {
      buggy.x = 19.5; buggy.y = 1; buggy.z = 14; buggy.speed = 0; buggy.vy = 0;
    }

    if (driving) {
      player.x = buggy.x; player.z = buggy.z; player.y = buggy.y + 1.1;
      player.yaw = buggy.yaw;
      if (Math.abs(buggy.speed) > 1 && Math.random() < dt * 3) global.BSAudio.play('engine');
      if (buggy.onGround && Math.abs(buggy.speed) > 4 && Math.random() < dt * 8) {
        puff(buggy.x - fx * 1.5, buggy.y + 0.1, buggy.z - fz * 1.5, 1,
          [220, 210, 190], { spread: 0.5, up: 0.6, life: 0.5, grav: -1, size: 0.14, alpha: 150 });
      }
    }
  }

  /* ------------------------------------------------------------- building */

  function inBuildZone(x, y, z) {
    for (var i = 0; i < world.buildZones.length; i++) {
      var b = world.buildZones[i];
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1) return b;
    }
    return null;
  }
  BS.inBuildZone = inBuildZone;

  /* The ghost block sits one and a half blocks in front of you, snapped to the
   * grid. Aiming is done with your feet, which is far kinder than aiming with
   * a finger.
   *
   * It lands FLUSH with the ground you are standing on, so walking out over a
   * gap placing blocks builds a level bridge with no steps in it. If that
   * space is already full it rides up until it finds room, which is what
   * makes stacking work. */
  function updateGhost() {
    if (!buildMode) { ghost = null; return; }
    var fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    var tx = Math.floor(player.x + fx * 1.7);
    var tz = Math.floor(player.z + fz * 1.7);
    var ty = Math.round(player.y) - 1;
    for (var tries = 0; tries < 4; tries++) {
      if (!cellOccupied(tx, ty, tz)) break;
      ty++;
    }
    var ok = !!inBuildZone(tx + 0.5, ty, tz + 0.5) && !cellOccupied(tx, ty, tz);
    ghost = { x: tx, y: ty, z: tz, ok: ok };
  }

  function cellOccupied(x, y, z) {
    var list = gather(x + 0.1, y + 0.1, z + 0.1, x + 0.9, y + 0.9, z + 0.9);
    return list.length > 0;
  }

  function placeBlock() {
    if (!ghost || !ghost.ok) {
      global.BSAudio.play('bonk');
      BS.toast('🚫', 'Build on the coloured squares', 2);
      return;
    }
    var t = BLOCK_TYPES[blockType];
    var b = { x: ghost.x, y: ghost.y, z: ghost.z, type: blockType };
    BS.blocks.push(b);
    b.solid = {
      x0: b.x, y0: b.y, z0: b.z, x1: b.x + 1, y1: b.y + t.h, z1: b.z + 1,
      on: true, block: b
    };
    dynSolids.push(b.solid);
    puff(b.x + 0.5, b.y + 0.5, b.z + 0.5, 8, t.col, { spread: 0.8, up: 2, life: 0.6, size: 0.12 });
    global.BSAudio.play('place');
    BS.stats.blocks++;
    BS.emit('placeBlock', b);
  }

  function removeBlock() {
    var best = -1, bestD = 25;
    for (var i = 0; i < BS.blocks.length; i++) {
      var b = BS.blocks[i];
      var d = dist2(player.x, player.y + 0.6, player.z, b.x + 0.5, b.y + 0.5, b.z + 0.5);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) { global.BSAudio.play('bonk'); return; }
    var blk = BS.blocks[best];
    var idx = dynSolids.indexOf(blk.solid);
    if (idx >= 0) dynSolids.splice(idx, 1);
    BS.blocks.splice(best, 1);
    puff(blk.x + 0.5, blk.y + 0.5, blk.z + 0.5, 8, BLOCK_TYPES[blk.type].col,
      { spread: 0.8, up: 2, life: 0.6, size: 0.12 });
    global.BSAudio.play('remove');
  }

  function setBuildMode(on) {
    buildMode = on && !player.inVehicle;
    dom.buildBar.classList.toggle('show', buildMode);
    dom.btnBuild.classList.toggle('on', buildMode);
    if (buildMode) BS.emit('buildMode');
  }
  BS.setBuildMode = setBuildMode;
  BS.isBuilding = function () { return buildMode; };

  /* -------------------------------------------------------------- gadgets */

  function useSniffer() {
    scan.until = BS.t + 14;
    scan.ring = 0;
    global.BSAudio.play('scan');
    var found = 0, i, d;
    for (i = 0; i < world.interactables.length; i++) {
      var it = world.interactables[i];
      if (!it.hidden || it.revealed) continue;
      d = Math.sqrt(dist2(player.x, player.y, player.z, it.x, it.y, it.z));
      if (d < 16) {
        it.revealed = true;
        it.locked = false;
        found++;
        puff(it.x, it.y + 0.5, it.z, 18, C.yellow, { spread: 1.4, up: 3, life: 1.4 });
      }
    }
    for (i = 0; i < world.badges.length; i++) {
      var bg = world.badges[i];
      if (BS.badgesFound[bg.id]) continue;
      d = Math.sqrt(dist2(player.x, player.y, player.z, bg.x, bg.y, bg.z));
      if (d < 22) bg.pinged = BS.t + 14;
    }
    if (found) {
      global.BSAudio.play('badge');
      BS.toast('🔎', 'Found something!', 2.5);
    }
    BS.emit('scan', { found: found });
  }

  function useBoots() {
    BS.bootsOn = !BS.bootsOn;
    dom.btnG2.classList.toggle('on', BS.bootsOn);
    global.BSAudio.play(BS.bootsOn ? 'boing' : 'click');
    BS.toast(BS.bootsOn ? '🦿' : '👟', BS.bootsOn ? 'Bouncy!' : 'Normal', 1.6);
    if (BS.bootsOn) puff(player.x, player.y + 0.2, player.z, 12, C.mint, { spread: 1, up: 3, life: 0.8 });
  }

  /* The Magnet Mitt reaches things that are out of arm's reach: it presses far
   * switches and yanks loose crates towards you. Never used on a person. */
  function useMitt() {
    var best = null, bestD = 400;
    for (var i = 0; i < world.interactables.length; i++) {
      var it = world.interactables[i];
      if (it.done || it.locked) continue;
      if (it.kind !== 'crate' && it.kind !== 'panel' && it.kind !== 'lift' && it.kind !== 'honk') continue;
      if (it.hidden && !it.revealed) continue;
      var d = dist2(player.x, player.y, player.z, it.x, it.y, it.z);
      if (d < bestD) { bestD = d; best = it; }
    }
    global.BSAudio.play('whoosh');
    var fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    for (i = 0; i < 10; i++) {
      puff(player.x + fx * (1 + i * 0.8), player.y + 1, player.z + fz * (1 + i * 0.8), 1,
        C.sky, { spread: 0.3, up: 0.4, life: 0.5, grav: 0, size: 0.16, alpha: 200 });
    }
    if (best) {
      useInteractable(best);
      BS.toast('🧲', '', 1.4);
    } else {
      BS.toast('🧲', 'Nothing to grab', 1.6);
    }
  }

  BS.unlockGadget = function (which) {
    BS.gadgets[which] = true;
    refreshGadgetButtons();
    save();
  };

  /* ---------------------------------------------------------- the player */

  function updatePlayer(dt) {
    var mv = input.move;
    var mag = Math.sqrt(mv.x * mv.x + mv.y * mv.y);
    var dx = 0, dz = 0;

    if (mag > 0.01) {
      var f = { x: -Math.sin(cam.yaw), z: -Math.cos(cam.yaw) };
      var r = { x: -f.z, z: f.x };
      dx = f.x * -mv.y + r.x * mv.x;
      dz = f.z * -mv.y + r.z * mv.x;
      var l = Math.sqrt(dx * dx + dz * dz);
      if (l > 0) { dx /= l; dz /= l; }
      player.yaw = lerpAngle(player.yaw, Math.atan2(dx, dz), Math.min(1, dt * 14));
      player.walk += dt * 11 * Math.min(1, mag * 1.3);
    } else {
      player.walk *= Math.pow(0.02, dt);
    }

    var speed = WALK * Math.min(1, mag * 1.25);
    if (player.inWater) speed *= 0.62;

    player.vy += GRAV * dt;
    if (player.vy < -46) player.vy = -46;
    var wasGround = player.onGround;
    player.onGround = false;
    collideY(player, player.vy * dt);

    if (player.onGround && !wasGround) {
      if (player.fallFrom - player.y > 2.5) {
        puff(player.x, player.y + 0.1, player.z, 8, [235, 235, 245],
          { spread: 0.8, up: 1.4, life: 0.5, size: 0.13, alpha: 170 });
      }
      global.BSAudio.play('land');
      /* A bouncy block you land on always throws you back up. The Bounce
       * Boots deliberately do NOT do this: a child who cannot stand still
       * cannot press anything, so the boots only make the jump button
       * jump higher. */
      if (player.ground && player.ground.block && BLOCK_TYPES[player.ground.block.type].name === 'bouncy') {
        player.vy = 16;
        player.onGround = false;
        global.BSAudio.play('boing');
        puff(player.x, player.y, player.z, 10, C.berry, { spread: 0.8, up: 3, life: 0.7 });
      }
    }
    if (player.onGround) player.fallFrom = player.y;
    else player.fallFrom = Math.max(player.fallFrom || player.y, player.y);

    moveXZ(player, dx * speed * dt, dz * speed * dt, STEP_UP);

    if (player.onGround && mag > 0.2 && Math.random() < dt * 6) global.BSAudio.play('step');

    /* Jumping is deliberately forgiving. A five-year-old presses the button
     * slightly before they land and slightly after they walk off an edge, and
     * both should still jump: pressing early is remembered for a quarter of a
     * second, and there is a moment of coyote time after leaving the ground. */
    if (input.pressed('jump')) player.jumpWanted = 0.25;
    else player.jumpWanted = Math.max(0, (player.jumpWanted || 0) - dt);
    player.coyote = player.onGround ? 0.15 : Math.max(0, (player.coyote || 0) - dt);

    if (player.jumpWanted > 0 && (player.onGround || player.coyote > 0)) {
      player.vy = BS.bootsOn ? BOOTS_V : JUMP_V;
      player.onGround = false;
      player.jumpWanted = 0;
      player.coyote = 0;
      global.BSAudio.play(BS.bootsOn ? 'boing' : 'jump');
      if (BS.bootsOn) puff(player.x, player.y, player.z, 10, C.mint, { spread: 0.9, up: 2, life: 0.6 });
    }

    // water is knee deep and completely harmless: you slow down and splash
    var wasWet = player.inWater;
    player.inWater = player.y < -0.35 && player.y > -2.4 &&
      global.BSWorld.surfaceAt(player.x, player.z) === 'water';
    if (player.inWater && !wasWet) {
      global.BSAudio.play('splash');
      puff(player.x, -0.2, player.z, 14, [180, 230, 255], { spread: 1, up: 3, life: 0.9, alpha: 200 });
    }
    if (player.inWater && Math.random() < dt * 4) {
      puff(player.x, -0.2, player.z, 1, [200, 240, 255], { spread: 0.8, up: 1.5, life: 0.6, alpha: 180 });
    }

    // remember somewhere safe to put us back if we end up somewhere silly
    if (player.onGround && !player.inWater && player.y > -12) {
      lastSafe.x = player.x; lastSafe.y = player.y + 0.05; lastSafe.z = player.z;
    }
    if (player.y < FALL_Y) {
      teleport(lastSafe.x, lastSafe.y, lastSafe.z);
      BS.toast('☁️', 'Whoops!', 1.6);
      global.BSAudio.play('reset');
      BS.emit('respawn', { x: lastSafe.x, y: lastSafe.y, z: lastSafe.z });
    }

    checkTriggers(dt);
    checkBadges();
  }

  function lerpAngle(a, b, t) {
    var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }

  function checkTriggers(dt) {
    for (var i = 0; i < world.triggers.length; i++) {
      var tr = world.triggers[i];
      if (Math.abs(player.x - tr.x) > tr.rx || Math.abs(player.z - tr.z) > tr.rz) continue;
      if (Math.abs(player.y - tr.y) > 1.2) continue;
      if (tr.kind === 'bounce' && player.vy <= 0.1) {
        player.vy = tr.power * (BS.bootsOn ? 1.25 : 1);
        player.onGround = false;
        global.BSAudio.play('boing');
        puff(tr.x, tr.y, tr.z, 14, C.berry, { spread: 1.6, up: 3, life: 0.8 });
        BS.emit('bounce', tr);
      } else if (tr.kind === 'note') {
        var key = 'n' + i;
        if ((noteCooldown[key] || 0) < BS.t) {
          noteCooldown[key] = BS.t + 0.28;
          global.BSAudio.play('note', tr.note);
          puff(tr.x, tr.y + 0.3, tr.z, 5, C.yellow, { spread: 1.4, up: 3, life: 0.7, size: 0.13 });
          tr.lit = BS.t + 0.4;
          BS.emit('note', tr);
        }
      }
    }
  }

  function checkBadges() {
    for (var i = 0; i < world.badges.length; i++) {
      var b = world.badges[i];
      if (BS.badgesFound[b.id]) continue;
      if (dist2(player.x, player.y + 0.8, player.z, b.x, b.y, b.z) < 2.9) {
        BS.badgesFound[b.id] = true;
        confetti(b.x, b.y, b.z, 16);
        global.BSAudio.play('badge');
        updateBadgeHud();
        BS.toast('🏅', BS.stats.badges + ' of ' + world.badges.length, 2.4);
        save();
        BS.emit('badge', b);
      }
    }
  }

  /* -------------------------------------------------------------- actors */

  function updateActors(dt) {
    var i, a;
    for (i = 0; i < actors.fizzbots.length; i++) {
      var f = actors.fizzbots[i];
      if (f.follow) {
        var tx = player.x - Math.sin(player.yaw) * (2 + i * 1.1);
        var tz = player.z - Math.cos(player.yaw) * (2 + i * 1.1);
        f.x = lerp(f.x, tx, Math.min(1, dt * 2.2));
        f.z = lerp(f.z, tz, Math.min(1, dt * 2.2));
        var gy = groundYAt(f.x, f.z, player.y + 3);
        f.y = lerp(f.y, Math.max(gy, player.y) + 1.1, Math.min(1, dt * 3));
      }
    }

    for (i = 0; i < actors.npcs.length; i++) {
      a = actors.npcs[i];
      if (a.wander) {
        a.timer = (a.timer || 0) - dt;
        if (a.timer <= 0) {
          a.timer = 2.5 + Math.random() * 3.5;
          a.tx = a.wander.cx + (Math.random() - 0.5) * a.wander.r * 2;
          a.tz = a.wander.cz + (Math.random() - 0.5) * a.wander.r * 2;
        }
        var dx = a.tx - a.x, dz = a.tz - a.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0.6) {
          a.yaw = lerpAngle(a.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
          a.x += (dx / d) * 1.7 * dt;
          a.z += (dz / d) * 1.7 * dt;
          a.walk += dt * 8;
        } else {
          a.walk *= Math.pow(0.05, dt);
        }
      } else {
        // idle folk turn to face you when you get close, which reads as alive
        var pd = dist2(a.x, 0, a.z, player.x, 0, player.z);
        if (pd < 64) a.yaw = lerpAngle(a.yaw, Math.atan2(player.x - a.x, player.z - a.z), Math.min(1, dt * 3));
        a.walk *= Math.pow(0.05, dt);
      }
      // whoever you just spoke to stops wandering and looks at you
      if (a.faceUntil > BS.t) {
        a.yaw = lerpAngle(a.yaw, Math.atan2(player.x - a.x, player.z - a.z), Math.min(1, dt * 8));
        a.timer = Math.max(a.timer || 0, 0.6);
        a.tx = a.x; a.tz = a.z;
      }
      if (a.wave > 0) a.wave = Math.max(0, a.wave - dt);
      if (a.hop > 0) a.hop = Math.max(0, a.hop - dt * 1.8);
      if (a.point && a.point.until < BS.t) a.point = null;
    }

    for (i = 0; i < actors.waddlers.length; i++) {
      a = actors.waddlers[i];
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = 2 + Math.random() * 4;
        a.tx = -40 + (Math.random() - 0.5) * 14;
        a.tz = -8 + (Math.random() - 0.5) * 14;
      }
      var wdx = a.tx - a.x, wdz = a.tz - a.z;
      var wd = Math.sqrt(wdx * wdx + wdz * wdz);
      if (wd > 0.5) {
        a.yaw = lerpAngle(a.yaw, Math.atan2(wdx, wdz), Math.min(1, dt * 4));
        a.x += (wdx / wd) * 1.4 * dt;
        a.z += (wdz / wd) * 1.4 * dt;
      }
      a.y = Math.max(0, groundYAt(a.x, a.z, 6));
      if (a.hop) {
        a.hop = Math.max(0, a.hop - dt * 2);
        a.y += Math.sin(a.hop * Math.PI) * 0.7;
      }
    }
  }

  function updateMovers(dt) {
    for (var i = 0; i < world.movers.length; i++) {
      var mv = world.movers[i];
      if (mv.travel === undefined) continue;
      var speed = (mv.speed || 2.5) * dt / Math.max(0.001, Math.abs(mv.travel));
      var before = mv.offset;
      if (mv.offset < mv.target) mv.offset = Math.min(mv.target, mv.offset + speed);
      else if (mv.offset > mv.target) mv.offset = Math.max(mv.target, mv.offset - speed);
      if (before === mv.offset) continue;
      var dy = (mv.offset - before) * mv.travel;
      var y = mv.y + mv.offset * mv.travel;
      if (mv.solidRef) { mv.solidRef.y0 = y; mv.solidRef.y1 = y + mv.h; }
      // carry whoever is standing on a rising or falling platform
      if (mv.kind === 'lift-platform' && !player.inVehicle &&
        player.x > mv.x - 0.4 && player.x < mv.x + mv.w + 0.4 &&
        player.z > mv.z - 0.4 && player.z < mv.z + mv.d + 0.4 &&
        Math.abs(player.y - (y + mv.h - dy)) < 0.6) {
        player.y = y + mv.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
  }

  /* -------------------------------------------------------------- camera */

  function updateCamera(dt) {
    if (input.look.dx || input.look.dy) {
      cam.yaw -= input.look.dx * 0.0052;
      cam.pitch = clamp(cam.pitch + input.look.dy * 0.0040, -0.30, 0.98);
      lookIdleTime = 0;
    } else {
      lookIdleTime += dt;
    }

    /* If nobody has touched the camera for a moment, swing it round behind
     * whichever way we are travelling. Without this, small children end up
     * walking towards the camera and getting lost. */
    var moving = Math.abs(input.move.x) + Math.abs(input.move.y) > 0.35;
    if (lookIdleTime > 1.1 && moving) {
      var want = player.inVehicle ? buggy.yaw + Math.PI : player.yaw + Math.PI;
      cam.yaw = lerpAngle(cam.yaw, want, Math.min(1, dt * (player.inVehicle ? 2.2 : 1.1)));
    }

    var tx = player.x, ty = player.y + (player.inVehicle ? 2.0 : 1.35), tz = player.z;
    var want = player.inVehicle ? 12.5 : 9.5;
    cam.dist = lerp(cam.dist, want, Math.min(1, dt * 3));

    var cp = Math.cos(cam.pitch);
    var dx = Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * cp;

    /* Pull the camera in if the town is in the way. Indoors this can end up
     * very close indeed — the café is smaller than the camera arm — so it is
     * allowed all the way in, and the player model is hidden when it gets
     * there rather than letting the camera sit inside a wall. */
    var maxD = cam.dist;
    for (var s = 1.0; s <= cam.dist; s += 0.35) {
      var px = tx + dx * s, py = ty + dy * s, pz = tz + dz * s;
      if (gather(px - 0.3, py - 0.3, pz - 0.3, px + 0.3, py + 0.3, pz + 0.3).length) {
        maxD = Math.max(0.75, s - 0.35);
        break;
      }
    }
    cam.x = tx + dx * maxD;
    cam.y = ty + dy * maxD;
    cam.z = tz + dz * maxD;
    cam.tx = tx; cam.ty = ty; cam.tz = tz;
    cam.close = maxD < 2.3;
  }

  /* ------------------------------------------------------------ rendering */

  var SKY = [150, 216, 244];

  function render() {
    R.setCamera(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, 62, 0.16, 260);
    R.begin(SKY, 62, 190);
    R.drawStatic();

    opaque.reset();
    blend.reset();
    var i, B = opaque;

    // clouds, drifting slowly and never in the way
    for (i = 0; i < world.decoAnim.length; i++) {
      var cl = world.decoAnim[i];
      var cx = cl.x + Math.sin(BS.t * 0.02 * cl.drift + i) * 12;
      B.box(cx, cl.y, cl.z, cl.w, cl.h, cl.d, [252, 253, 255], { tint: -0.02 });
      B.box(cx + cl.w * 0.2, cl.y + cl.h * 0.8, cl.z + cl.d * 0.15, cl.w * 0.5, cl.h * 0.7, cl.d * 0.6, [255, 255, 255]);
    }

    // movers
    for (i = 0; i < world.movers.length; i++) {
      var mv = world.movers[i];
      if (!mv.visible) continue;
      var y = mv.y + (mv.travel ? mv.offset * mv.travel : 0);
      B.box(mv.x, y, mv.z, mv.w, mv.h, mv.d, mv.col, { tint: 0.02 });
      if (mv.kind === 'lift-platform') {
        B.box(mv.x + 0.2, y + mv.h, mv.z + 0.2, mv.w - 0.4, 0.12, mv.d - 0.4, C.yellow, { tint: 0.1 });
      }
    }

    // blocks the player has built
    for (i = 0; i < BS.blocks.length; i++) {
      var bl = BS.blocks[i];
      var bt = BLOCK_TYPES[bl.type];
      var wob = bt.name === 'bouncy' ? Math.sin(BS.t * 4 + bl.x + bl.z) * 0.04 : 0;
      B.box(bl.x + 0.02, bl.y, bl.z + 0.02, 0.96, bt.h + wob, 0.96, bt.col, { tint: 0.04 });
      B.box(bl.x + 0.14, bl.y + bt.h + wob, bl.z + 0.14, 0.72, 0.09, 0.72, bt.col, { tint: 0.22 });
    }

    // badges: a spinning coin on a little post of light
    for (i = 0; i < world.badges.length; i++) {
      var bg = world.badges[i];
      if (BS.badgesFound[bg.id]) continue;
      var spin = BS.t * 2 + i;
      var bob = Math.sin(BS.t * 2.2 + i) * 0.16;
      M4.trs(_m, bg.x, bg.y + bob, bg.z, spin, 0, 0);
      B.boxT(_m, 0, 0, 0, 0.34, 0.34, 0.08, C.gold, { tint: 0.06 });
      B.boxT(_m, 0, 0, 0, 0.2, 0.2, 0.13, C.teal, { tint: 0.1 });
      if (bg.pinged > BS.t) {
        var pulse = 0.5 + Math.sin(BS.t * 8) * 0.3;
        blend.box(bg.x - 0.9, bg.y - 0.9, bg.z - 0.9, 1.8, 1.8, 1.8, C.yellow,
          { alpha: Math.round(70 * pulse) });
      }
    }

    // fizzbots, people, birds, buggy
    for (i = 0; i < actors.fizzbots.length; i++) drawFizzbot(B, actors.fizzbots[i]);
    for (i = 0; i < actors.npcs.length; i++) {
      var n = actors.npcs[i];
      if (n.hidden) continue;
      var hop = n.hop > 0 ? Math.abs(Math.sin(n.hop * Math.PI * 2)) * 0.45 : 0;
      drawChar(B, n.kit, n.x, n.y + hop, n.z, n.yaw, n.walk,
        { scale: n.scale, wave: n.wave, point: n.point });
    }
    for (i = 0; i < actors.waddlers.length; i++) drawWaddler(B, actors.waddlers[i]);
    drawBuggy(B, buggy);

    // when the camera is jammed up against a wall, drop to a first-person
    // view rather than filling the screen with the back of a head
    if (!player.inVehicle && !cam.close) {
      drawChar(B, PLAYER_KITS[BS.playerColour], player.x, player.y, player.z, player.yaw, player.walk, {});
      if (BS.bootsOn) {
        var g = Math.sin(BS.t * 8) * 0.05 + 0.2;
        blend.box(player.x - 0.35, player.y - 0.05, player.z - 0.35, 0.7, 0.25, 0.7, C.mint,
          { alpha: Math.round(200 * g + 60) });
      }
    }

    // particles
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      var k = p.life / p.max;
      var sz = p.size * (0.4 + k * 0.8);
      M4.trs(_m, p.x, p.y, p.z, p.spin + BS.t * 3, p.spin, 0);
      if (p.alpha >= 250) B.boxT(_m, 0, 0, 0, sz, sz, sz, p.col);
      else blend.boxT(_m, 0, 0, 0, sz, sz, sz, p.col, { alpha: Math.round(p.alpha * k) });
    }

    R.drawDynamic(opaque, false);

    /* ---- blended pass: water, shadows, ghost block, scan ring ---- */
    for (i = 0; i < world.water.length; i++) {
      var wt = world.water[i];
      var wave = Math.sin(BS.t * 1.4 + wt.x * 0.2 + wt.z * 0.15) * 0.06;
      blend.box(wt.x, wt.y + wave, wt.z, wt.w, wt.h, wt.d, C.water, { alpha: 165 });
    }

    shadowFor(player.x, player.y, player.z, 0.8);
    shadowFor(buggy.x, buggy.y, buggy.z, 2.2);
    for (i = 0; i < actors.npcs.length; i++) {
      if (!actors.npcs[i].hidden) shadowFor(actors.npcs[i].x, actors.npcs[i].y, actors.npcs[i].z, 0.8);
    }
    for (i = 0; i < actors.waddlers.length; i++) shadowFor(actors.waddlers[i].x, actors.waddlers[i].y, actors.waddlers[i].z, 0.6);
    for (i = 0; i < actors.fizzbots.length; i++) shadowFor(actors.fizzbots[i].x, actors.fizzbots[i].y, actors.fizzbots[i].z, 0.7);

    if (ghost) {
      var gc = ghost.ok ? BLOCK_TYPES[blockType].col : [255, 90, 90];
      var pulse2 = 0.55 + Math.sin(BS.t * 6) * 0.2;
      blend.box(ghost.x + 0.03, ghost.y + 0.03, ghost.z + 0.03, 0.94, BLOCK_TYPES[blockType].h, 0.94,
        gc, { alpha: Math.round(150 * pulse2) });
    }

    if (scan.until > BS.t) {
      scan.ring = (scan.ring + 0.05) % 1;
      var rr = scan.ring * 18;
      var a = Math.round(110 * (1 - scan.ring));
      blend.box(player.x - rr, player.y + 0.05, player.z - rr, rr * 2, 0.12, rr * 2, C.yellow, { alpha: a });
    }

    R.drawDynamic(blend, true);
  }

  function shadowFor(x, y, z, size) {
    var gy = groundYAt(x, z, y + 0.3);
    if (gy < -35) return;
    var drop = clamp(1 - (y - gy) / 8, 0.25, 1);
    var s = size * (0.6 + drop * 0.5);
    blend.box(x - s / 2, gy + 0.03, z - s / 2, s, 0.02, s, [20, 30, 50], { alpha: Math.round(90 * drop) });
  }

  /* ------------------------------------------------------------- the map */

  /* A block town at eye level is a maze of similar boxes, and a five-year-old
   * who walks the wrong way has no way back. The map is drawn straight from
   * the same surfaceAt() the ground is built from, so it can never disagree
   * with the world, and it only ever shows things the child already knows
   * about: where they are, where they are going, and the badges they have
   * already found. Unfound badges stay secret. */
  var mapOpen = false;

  function setMap(open) {
    mapOpen = open && BS.started;
    dom.mapOverlay.classList.toggle('show', mapOpen);
    dom.btnMap.classList.toggle('on', mapOpen);
    if (mapOpen) {
      mapWasPaused = !!BS.paused;
      setPaused(true);
      drawMap();
      global.BSAudio.play('map');
    } else if (!mapWasPaused) {
      setPaused(false);
    }
  }
  var mapWasPaused = false;
  BS.setMap = setMap;
  BS.isMapOpen = function () { return mapOpen; };

  var MAP_COLS = {
    grass: '#7ecb6a', water: '#5fbde8', sand: '#f0d79c',
    road: '#a8aebd', pave: '#e2e4ee', dirt: '#c6a074'
  };

  /* The bounds worth showing: the town, not the empty grass around it. */
  var MAP_X0 = -54, MAP_X1 = 54, MAP_Z0 = -38, MAP_Z1 = 54;

  function drawMap() {
    var cv = dom.mapCanvas;
    var frame = cv.parentNode.getBoundingClientRect();
    if (frame.width < 20 || frame.height < 20) return;

    // fit the paper to the town's own proportions inside whatever room there is
    var spanX = MAP_X1 - MAP_X0, spanZ = MAP_Z1 - MAP_Z0;
    var fit = Math.min(frame.width / spanX, frame.height / spanZ);
    var W = Math.round(spanX * fit), H = Math.round(spanZ * fit);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';

    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    var pad = 6;
    var scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanZ);
    var ox = W / 2 - (MAP_X0 + spanX / 2) * scale;
    var oz = H / 2 - (MAP_Z0 + spanZ / 2) * scale;
    function sx(x) { return ox + x * scale; }
    function sz(z) { return oz + z * scale; }
    var big = Math.min(W, H) > 520;

    g.clearRect(0, 0, W, H);
    g.fillStyle = MAP_COLS.grass;
    g.fillRect(0, 0, W, H);

    // the ground, sampled from the very function that built the real thing
    var step = 2, cell = step * scale + 1, x, z, i;
    for (x = MAP_X0; x < MAP_X1; x += step) {
      for (z = MAP_Z0; z < MAP_Z1; z += step) {
        var m = global.BSWorld.surfaceAt(x + step / 2, z + step / 2);
        g.fillStyle = MAP_COLS[m] || MAP_COLS.grass;
        g.fillRect(sx(x), sz(z), cell, cell);
      }
    }

    /* Building footprints. Without these the map is a colour wash and a child
     * cannot tell a street from a field — anything tall enough to be a wall,
     * a tree or a tower gets a shadow. */
    g.fillStyle = 'rgba(58,62,84,.30)';
    var sol = world.solids;
    for (i = 0; i < sol.length; i++) {
      var so = sol[i];
      if (so.y1 < 3.2 || so.tag === 'edge' || so.tag === 'hill') continue;
      if (so.x1 < MAP_X0 || so.x0 > MAP_X1 || so.z1 < MAP_Z0 || so.z0 > MAP_Z1) continue;
      g.fillRect(sx(so.x0), sz(so.z0), (so.x1 - so.x0) * scale, (so.z1 - so.z0) * scale);
    }

    // blocks the player built, so their own bridge is on their own map
    g.fillStyle = 'rgba(18,182,166,.9)';
    for (i = 0; i < BS.blocks.length; i++) {
      g.fillRect(sx(BS.blocks[i].x), sz(BS.blocks[i].z), Math.max(3, scale), Math.max(3, scale));
    }

    g.textAlign = 'center';
    g.textBaseline = 'middle';

    // landmark pins
    var lm = world.landmarks || [];
    var pinR = big ? 17 : 13;
    for (i = 0; i < lm.length; i++) {
      var L = lm[i];
      g.fillStyle = 'rgba(255,253,246,.95)';
      g.strokeStyle = 'rgba(36,48,74,.18)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(sx(L.x), sz(L.z), pinR, 0, 6.284);
      g.fill();
      g.stroke();
      g.font = (pinR + 5) + 'px system-ui, sans-serif';
      g.fillText(L.icon, sx(L.x), sz(L.z) + 1);
    }

    // badges already found. The ones still hidden stay hidden.
    for (i = 0; i < world.badges.length; i++) {
      var bg = world.badges[i];
      if (!BS.badgesFound[bg.id]) continue;
      g.fillStyle = '#ffd042';
      g.strokeStyle = '#fffdf6';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(sx(bg.x), sz(bg.z), big ? 8 : 6, 0, 6.284);
      g.fill();
      g.stroke();
    }

    // the buggy, in case it got left somewhere odd
    g.fillStyle = '#ff7f60';
    g.strokeStyle = '#fffdf6';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(sx(buggy.x), sz(buggy.z), big ? 13 : 10, 0, 6.284);
    g.fill();
    g.stroke();
    g.font = (big ? 16 : 12) + 'px system-ui, sans-serif';
    g.fillText('\uD83D\uDE99', sx(buggy.x), sz(buggy.z) + 1);

    // where you are going
    var mi = global.BSMissions.current();
    if (mi && mi.target) {
      var tx = sx(mi.target.x), tz = sz(mi.target.z);
      var pulse = (big ? 24 : 19) + Math.sin(Date.now() / 260) * 5;
      g.strokeStyle = '#ffc93c';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(tx, tz, pulse, 0, 6.284);
      g.stroke();
      g.fillStyle = '#ffc93c';
      g.strokeStyle = '#fffdf6';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(tx, tz, big ? 16 : 13, 0, 6.284);
      g.fill();
      g.stroke();
      g.font = (big ? 20 : 16) + 'px system-ui, sans-serif';
      g.fillText(mi.icon, tx, tz + 1);
    }

    /* And you: a big arrow pointing the way you are actually facing. It is the
     * one thing on here a child has to find instantly, so it is drawn last,
     * largest, and with a white ring so it never disappears into the town. */
    var px = sx(player.x), pz = sz(player.z);
    var ar = big ? 1 : 0.78;
    g.save();
    g.translate(px, pz);
    g.beginPath();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.arc(0, 0, 24 * ar, 0, 6.284);
    g.fill();
    g.rotate(-player.yaw + Math.PI);
    g.fillStyle = '#12b6a6';
    g.strokeStyle = '#fffdf6';
    g.lineWidth = 4 * ar;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(0, -19 * ar);
    g.lineTo(14 * ar, 15 * ar);
    g.lineTo(0, 8 * ar);
    g.lineTo(-14 * ar, 15 * ar);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();

    // underground the arrow would otherwise look like a lie
    if (player.y < -4) {
      g.fillStyle = 'rgba(36,48,74,.92)';
      var bw = 210, bh = 46;
      g.beginPath();
      if (g.roundRect) g.roundRect(W / 2 - bw / 2, H - bh - 12, bw, bh, 16);
      else g.rect(W / 2 - bw / 2, H - bh - 12, bw, bh);
      g.fill();
      g.font = '21px system-ui, sans-serif';
      g.fillStyle = '#fff';
      g.fillText('\uD83C\uDF00  underground', W / 2, H - bh / 2 - 12);
    }
  }

  /* ------------------------------------------------------------------ HUD */

  var markerPool = [];

  function project(x, y, z) {
    var m = R.vp;
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    var cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    var cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return { behind: true, x: cx, y: cy };
    return {
      behind: false,
      x: (cx / cw * 0.5 + 0.5) * R.cssW,
      y: (-cy / cw * 0.5 + 0.5) * R.cssH
    };
  }

  function getMarker(i) {
    if (!markerPool[i]) {
      var el = document.createElement('div');
      el.className = 'marker';
      dom.markers.appendChild(el);
      markerPool[i] = el;
    }
    return markerPool[i];
  }

  function updateHud() {
    var used = 0, i;

    var mission = global.BSMissions.current();
    if (mission) {
      dom.missionIcon.textContent = mission.icon;
      dom.missionText.textContent = mission.text;
      var pips = '';
      for (i = 0; i < mission.total; i++) pips += '<i class="' + (i < mission.done ? 'on' : '') + '"></i>';
      dom.missionPips.innerHTML = pips;
    }

    // the objective marker, and an arrow when it is off screen
    var target = mission && mission.target;
    if (target) {
      var p = project(target.x, target.y + 2.2, target.z);
      var onScreen = !p.behind && p.x > 40 && p.x < R.cssW - 40 && p.y > 40 && p.y < R.cssH - 40;
      if (onScreen) {
        var el = getMarker(used++);
        el.className = 'marker goal' + (BS.hintPulse > BS.t ? ' flare' : '');
        el.style.transform = 'translate(-50%,-50%) translate(' + p.x + 'px,' + p.y + 'px)';
        el.textContent = mission.icon;
        dom.chevron.classList.remove('show');
      } else {
        dom.chevron.classList.add('show');
        var ang = angleToScreenEdge(target);
        dom.chevron.style.transform = 'translate(-50%,-50%) translate(' + ang.x + 'px,' + ang.y + 'px) rotate(' + ang.rot + 'deg)';
        dom.chevron.textContent = mission.icon;
      }
    } else {
      dom.chevron.classList.remove('show');
    }

    // the nearest pressable thing
    var t = currentTarget();
    var icon = '👋';
    if (t) {
      icon = t.icon;
      var mx = t.x !== undefined ? t.x : t.kind === 'enter' ? buggy.x : player.x;
      var my = t.y !== undefined ? t.y : t.kind === 'enter' ? buggy.y + 2.4 : player.y + 2.4;
      var mz = t.z !== undefined ? t.z : t.kind === 'enter' ? buggy.z : player.z;
      if (t.kind !== 'exit') {
        var pp = project(mx, my + (t.kind === 'enter' ? 0 : 1.0), mz);
        if (!pp.behind) {
          var el2 = getMarker(used++);
          el2.className = 'marker near';
          el2.style.transform = 'translate(-50%,-50%) translate(' + pp.x + 'px,' + pp.y + 'px)';
          el2.textContent = icon;
        }
      }
    }
    dom.actionIcon.textContent = icon;
    dom.btnAction.classList.toggle('idle', !t);

    // speech bubbles pinned over whoever is talking
    for (i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].until < BS.t) { bubbles.splice(i, 1); continue; }
      var a = bubbles[i].actor;
      var bp = project(a.x, a.y + 2.55 * (a.scale || 1), a.z);
      if (bp.behind) continue;
      /* Stand nose to nose with a Bobble and their head is off the top of the
       * screen, taking the bubble with it. Keep it inside the play area and
       * below the objective card, the badge counter and any message. */
      var bx = clamp(bp.x, 80, R.cssW - 80);
      var by = clamp(bp.y - 26, hudSafeTop, Math.max(hudSafeTop + 10, R.cssH - 150));
      var be = getMarker(used++);
      be.className = 'marker bubble';
      be.style.transform = 'translate(-50%,-50%) translate(' + bx + 'px,' + by + 'px)';
      be.textContent = bubbles[i].icon;
    }

    for (i = used; i < markerPool.length; i++) markerPool[i].className = 'marker off';

    // build button only appears where building is allowed
    var canBuild = !player.inVehicle && !!inBuildZone(player.x, player.y, player.z);
    dom.btnBuild.classList.toggle('hidden', !canBuild);
    if (!canBuild && buildMode) setBuildMode(false);

    // the sniffer's hot/cold meter: rings, not colour alone
    if (scan.until > BS.t && BS.gadgets.sniffer) {
      var nearest = 999;
      for (i = 0; i < world.badges.length; i++) {
        var bg = world.badges[i];
        if (BS.badgesFound[bg.id]) continue;
        var d = Math.sqrt(dist2(player.x, player.y, player.z, bg.x, bg.y, bg.z));
        if (d < nearest) nearest = d;
      }
      for (i = 0; i < world.interactables.length; i++) {
        var it = world.interactables[i];
        if (!it.hidden || it.done) continue;
        var d2 = Math.sqrt(dist2(player.x, player.y, player.z, it.x, it.y, it.z));
        if (d2 < nearest) nearest = d2;
      }
      var level = nearest > 30 ? 0 : nearest > 18 ? 1 : nearest > 9 ? 2 : nearest > 4 ? 3 : 4;
      dom.scanMeter.classList.add('show');
      var s = '';
      for (i = 0; i < 4; i++) s += '<i class="' + (i < level ? 'on' : '') + '"></i>';
      dom.scanPips.innerHTML = s;
      if (level >= 2 && Math.random() < 0.06) global.BSAudio.play('ping', (level - 1) / 3);
    } else {
      dom.scanMeter.classList.remove('show');
    }

    if (toastUntil && BS.t > toastUntil) {
      dom.toast.classList.remove('show');
      toastUntil = 0;
    }
  }

  function angleToScreenEdge(target) {
    var w = R.cssW, h = R.cssH;
    var p = project(target.x, target.y + 2, target.z);
    var dx, dy;
    if (p.behind) {
      dx = -(p.x); dy = (p.y);
      var l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;
    } else {
      dx = p.x - w / 2; dy = p.y - h / 2;
      var l2 = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l2; dy /= l2;
    }
    var pad = 84;
    var mx = w / 2 + dx * Math.min(w / 2 - pad, h / 2 - pad);
    var my = h / 2 + dy * Math.min(w / 2 - pad, h / 2 - pad);
    return { x: mx, y: my, rot: 0 };
  }

  /* ----------------------------------------------------------- main loop */

  var last = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (!BS.ready) return;

    input.beginFrame();

    if (!BS.paused && BS.started) {
      BS.t += dt;

      if (input.pressed('pause')) setPaused(true);
      if (input.pressed('map')) setMap(!mapOpen);
      if (input.pressed('action')) doAction();
      if (input.pressed('build')) setBuildMode(!buildMode);
      if (input.pressed('gadget1') && BS.gadgets.sniffer) useSniffer();
      if (input.pressed('gadget2') && BS.gadgets.boots) useBoots();
      if (input.pressed('gadget3') && BS.gadgets.mitt) useMitt();
      if (buildMode) {
        if (input.pressed('place')) placeBlock();
        if (input.pressed('removeBlock')) removeBlock();
        if (input.pressed('buildDone')) setBuildMode(false);
      }

      if (player.inVehicle) updateBuggy(dt, true);
      else { updateBuggy(dt, false); updatePlayer(dt); }

      updateMovers(dt);
      updateActors(dt);
      updateParticles(dt);
      updateGhost();
      updateCamera(dt);
      global.BSMissions.update(dt);
    } else {
      // keep the world alive behind the menus so it never looks frozen
      BS.t += dt * 0.25;
      updateCamera(dt);
      if (mapOpen) drawMap();
    }

    render();
    updateHud();
    input.endFrame();
  }

  BS.save = save;
  BS.BLOCK_TYPES = BLOCK_TYPES;
  BS.places = function () { return world.places; };
  BS.puff = puff;
  BS.confetti = confetti;
  BS.groundYAt = groundYAt;
  global.BS = BS;

  window.addEventListener('DOMContentLoaded', function () {
    try {
      BS.init();
    } catch (err) {
      var el = document.getElementById('fatal');
      if (el) {
        el.classList.add('show');
        el.querySelector('.detail').textContent = String(err && err.message || err);
      }
      throw err;
    }
  });
})(window);
