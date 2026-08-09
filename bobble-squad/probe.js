/* Bobble Squad — Test Kit.
 *
 * A monitored mode for real-device testing. It is dormant until somebody
 * presses and holds the pause button for two and a half seconds and answers a
 * sum, so a child will not find it.
 *
 * Once armed it quietly records, for the length of the session:
 *   - frame rate, stutters and the worst frame
 *   - JavaScript errors and WebGL context loss
 *   - every game event (missions, gadgets, blocks, badges, vehicle, falls)
 *   - how long each mission step took
 *   - times the player stood still in one spot for 45 seconds (probably stuck)
 *   - times ⭐ was pressed with nothing to press (probably confused)
 *   - times a button was hammered (probably not responding)
 *   - orientation changes and the size of the safe-area insets
 *
 * It also carries the 54-check iPad test plan so results can be ticked off on
 * the device itself, and marking a check as failed grabs a screenshot of the
 * 3D view plus the exact on-screen position of every HUD control.
 *
 * Everything stays on the device. Nothing is transmitted anywhere, ever. The
 * report is written out as one self-contained HTML file the tester saves and
 * sends on themselves.
 */
(function (global) {
  'use strict';

  var LS_KEY = 'bobblesquad:probe';
  var LS_SHOTS = 'bobblesquad:probe:shots';
  var MAX_EVENTS = 400;
  var MAX_SHOTS = 10;

  /* ------------------------------------------------------- the test plan */

  var SECTIONS = {
    A: 'Launch and install',
    B: 'Offline',
    C: 'Layout and orientation',
    D: 'Touch controls',
    E: 'Camera',
    F: 'Mission 1 — Wake the Fizzbots',
    G: 'Mission 2 — The Missing Slide',
    H: 'Mission 3 — The Bubble Cog',
    I: 'Gadgets',
    J: 'Vehicle',
    K: 'Building',
    L: 'World and secrets',
    M: 'Performance and stability',
    N: 'Audio',
    O: 'Save',
    P: 'With a child'
  };

  /* Keep these in step with TEST-PLAN-IPAD.md — test/run.js checks that the
   * two lists have exactly the same IDs. */
  var CASES = [
    ['A1', 'Open the URL in Safari', 'Start screen appears, hat colours and play button visible', 1],
    ['A2', 'Add to Home Screen, launch from the icon', 'Opens full screen with no address bar', 1],
    ['A3', 'Pick a hat, press play', 'Game starts in the square, facing the fountain', 1],
    ['A4', 'Check all four corners of the screen', 'Nothing important under the corners, camera housing or home bar', 0],

    ['B1', 'Aeroplane mode on, force-quit, relaunch', 'Loads and plays exactly as before', 1],
    ['B2', 'Offline, play two minutes and finish a mission step', 'No difference from being online', 0],
    ['B3', 'Offline, force-quit and relaunch', 'Progress exactly where you left it', 0],

    ['C1', 'Landscape: look at every control', 'Nothing overlaps, everything fully on screen', 1],
    ['C2', 'Rotate to portrait while playing', 'Rotate card appears, game keeps running behind it', 0],
    ['C3', 'Rotate back to landscape', 'Controls return correctly, nothing stretched or off screen', 0],

    ['D1', 'Thumb down anywhere in the bottom-left quarter', 'Stick appears under your thumb wherever you put it', 1],
    ['D2', 'Walk forwards, back, left, right', 'Moves the way you push, relative to the camera', 1],
    ['D3', 'Tap jump repeatedly, including just as you land', 'Jumps every time, early or late presses still work', 0],
    ['D4', 'Walk with the left thumb and drag the camera with the right', 'Both work at once', 1],
    ['D5', 'Walk up to a doorbell, the fountain, a bird, the buggy', 'Action icon changes, small icon floats over the thing', 0],
    ['D6', 'Try to scroll, pinch, double-tap zoom, long-press for a menu', 'None of them happen, the page never moves', 1],

    ['E1', 'Drag around, look up and down', 'Smooth, never flips or sticks at the limits', 0],
    ['E2', 'Walk in a straight line without touching the camera', 'Camera swings behind you after about a second', 0],
    ['E3', 'Walk inside the café, the shop and HQ', 'Camera never inside a wall, goes first-person if very close', 0],

    ['F1', 'Follow the arrow, press the action button at all three robots', 'Each giggles and follows, the three pips fill in', 1],
    ['F2', 'Follow the arrow to the café, press the swirl', 'Whoosh, you are underground in HQ', 0],
    ['F3', 'Press the glowing gift box on the bench', 'Confetti, the magnifier button appears', 1],

    ['G1', 'Go back up and walk to the playground', 'Objective changes to the magnifier', 0],
    ['G2', 'Stand near the big rock, press the magnifier', 'Ring sweeps out, a panel on the rock lights up', 1],
    ['G3', 'Press the panel, take the swirl down, press the slide', 'Boots unlock, slide is back in the playground', 0],

    ['H1', 'Walk to the buggy and press the action button', 'You get in, the camera pulls back', 1],
    ['H2', 'Drive to the Build Yard', 'Steerable, objective updates on arrival', 0],
    ['H3', 'Get onto the tower roof, by bridge or by bouncing', 'Either route works, neither feels impossible', 1],
    ['H4', 'On the roof, sniff, then open the crate', 'Crate appears, opens, confetti', 0],
    ['H5', 'Return to the fountain and press the action button', 'Bubbles erupt, Grumbo arrives, magnet unlocks', 0],

    ['I1', 'Sniff, then walk towards and away from a hidden thing', 'Bar meter grows and shrinks, beeps speed up when closer', 0],
    ['I2', 'Boots on, jump; boots off, jump', 'Obviously higher with them on, button clearly looks on', 0],
    ['I3', 'Press the magnet near something out of reach', 'It activates from a distance', 0],

    ['J1', 'Drive around the streets for a minute', 'A child could steer this, it does not spin or run away', 1],
    ['J2', 'Drive into walls, kerbs, lamp posts, the fountain', 'Soft bonk and wobble, never stuck or launched', 0],
    ['J3', 'Get out in several different places', 'Always end up standing on something solid', 0],

    ['K1', 'Walk on and off the coloured pads', 'Build button appears only on the pads', 0],
    ['K2', 'Open build, try all three blocks, place several, remove one', 'Ghost shows where it goes, plus and minus both work', 1],
    ['K3', 'Walk out over the gap on blocks you placed', 'They hold you up, the bridge is level not a staircase', 0],

    ['L1', 'Try trampolines, musical steps, a doorbell, the noticeboard, the lift, a bird', 'Every one does something immediately', 1],
    ['L2', 'Find at least three badges', 'Confetti and a noise each time, counter goes up', 0],
    ['L3', 'Jump off the tower, and off the edge of the map', 'Gentle noise, put back on safe ground, nothing lost', 0],

    ['M1', 'Stand in the busy square and turn on the spot', 'Smooth, no stutter as things come into view', 1],
    ['M2', 'Play continuously for 20 minutes', 'No slowdown building up, no crash, no reload', 0],
    ['M3', 'Home button, another app, back. Then lock, unlock, back', 'Resumes, does not reload, sound still works', 0],

    ['N1', 'Play with sound, mute in pause, quit and relaunch', 'Sounds work, mute sticks after relaunch', 0],
    ['N2', 'Play a whole mission on mute', 'Nothing impossible to work out without sound', 0],

    ['O1', 'Force-quit mid-mission and relaunch', 'Same step, badges, gadgets and hat', 1],
    ['O2', 'Pause, start again, confirm', 'Everything resets, nothing else on the iPad affected', 0],

    ['P1', 'Did they start moving within a minute, unprompted?', 'Yes', 1],
    ['P2', 'Did they work out the camera, or get lost facing the wrong way?', 'Worked it out', 0],
    ['P3', 'Did they finish mission 1 unaided? If not, where exactly did they stall?', 'Finished it', 0],
    ['P4', 'Did they wander off and explore things that were not the mission?', 'Yes', 0],
    ['P5', 'What did they try that did not work?', 'Note anything they expected to be a button', 0]
  ];

  /* ------------------------------------------------------------- state */

  var st = { results: {}, notes: {}, issues: [], device: null, startedAt: 0, armed: false, sessions: 0 };

  var m = {
    frames: 0, worstFrame: 0, jank: 0, fps: [], lastFrame: 0, bucketStart: 0,
    bucketFrames: 0, bucketWorst: 0,
    errors: [], events: [], steps: [],
    deadTaps: 0, rageTaps: 0, respawns: 0, stuck: 0, orientation: 0, contextLost: 0
  };

  var ui = {};
  var pendingShot = null;
  var posRing = [], posIdx = 0, stuckMuteUntil = 0;
  var tapLog = {};
  var lastStep = null, lastStepAt = 0;
  var gateOkUntil = 0;

  function now() { return Date.now(); }
  function since() { return st.startedAt ? Math.round((now() - st.startedAt) / 1000) : 0; }

  function logEvent(kind, detail) {
    m.events.push({ t: since(), k: kind, d: detail === undefined ? '' : detail });
    if (m.events.length > MAX_EVENTS) m.events.shift();
  }

  /* --------------------------------------------------- always-on capture */

  window.addEventListener('error', function (e) {
    m.errors.push({
      t: since(), kind: 'error',
      msg: String(e.message || e.type),
      where: (e.filename || '').split('/').pop() + ':' + (e.lineno || '?'),
      stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 900) : ''
    });
    logEvent('ERROR', String(e.message || '').slice(0, 120));
  });

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    m.errors.push({
      t: since(), kind: 'promise',
      msg: String(r && r.message ? r.message : r).slice(0, 300),
      where: '', stack: r && r.stack ? String(r.stack).slice(0, 900) : ''
    });
    logEvent('ERROR', 'unhandled promise');
  });

  window.addEventListener('orientationchange', function () {
    m.orientation++;
    logEvent('orientation', window.innerWidth + 'x' + window.innerHeight);
  });

  /* ------------------------------------------------------- device facts */

  function readDevice() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
      'env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
    var cs = getComputedStyle(probe);
    var insets = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' / ');
    document.body.removeChild(probe);

    var gl = null, renderer = '';
    try {
      var c = document.getElementById('game');
      gl = c && (c.getContext('webgl') || c.getContext('experimental-webgl'));
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      }
    } catch (e) { renderer = 'unavailable'; }

    return {
      ua: navigator.userAgent,
      viewport: window.innerWidth + ' x ' + window.innerHeight,
      screen: (screen.width || '?') + ' x ' + (screen.height || '?'),
      dpr: window.devicePixelRatio || 1,
      insets: insets,
      standalone: !!(navigator.standalone || (window.matchMedia &&
        window.matchMedia('(display-mode: standalone)').matches)),
      touch: (navigator.maxTouchPoints || 0),
      renderer: String(renderer),
      memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'not reported',
      online: navigator.onLine,
      lang: navigator.language,
      when: new Date().toISOString()
    };
  }

  /* ------------------------------------------------------------ storage */

  /* Sections B, M and O all involve force-quitting the app, so everything a
   * report needs has to survive a relaunch. Screenshots live in their own key
   * and are dropped oldest-first if the browser refuses the write, so a full
   * quota costs pictures rather than results. */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        results: st.results, notes: st.notes, armed: st.armed,
        startedAt: st.startedAt, sessions: st.sessions,
        errors: m.errors.slice(-50),
        issues: st.issues.map(function (i) {
          return { t: i.t, id: i.id, note: i.note, ctx: i.ctx, hud: i.hud, recent: i.recent };
        })
      }));
    } catch (e) { /* storage full or blocked — the session still works */ }
    saveShots();
  }

  function saveShots() {
    var shots = st.issues.map(function (i) { return i.shot || ''; });
    for (var attempt = 0; attempt <= shots.length; attempt++) {
      try {
        localStorage.setItem(LS_SHOTS, JSON.stringify(shots));
        return;
      } catch (e) {
        var oldest = -1;
        for (var i = 0; i < shots.length; i++) { if (shots[i]) { oldest = i; break; } }
        if (oldest < 0) {
          try { localStorage.removeItem(LS_SHOTS); } catch (e2) { /* give up quietly */ }
          return;
        }
        shots[oldest] = '';
      }
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      st.results = d.results || {};
      st.notes = d.notes || {};
      st.armed = !!d.armed;
      st.startedAt = d.startedAt || 0;
      st.sessions = d.sessions || 0;
      if (d.issues) st.issues = d.issues;
      if (d.errors) m.errors = d.errors;
      try {
        var shots = JSON.parse(localStorage.getItem(LS_SHOTS) || '[]');
        for (var i = 0; i < st.issues.length; i++) {
          if (shots[i]) st.issues[i].shot = shots[i];
        }
      } catch (e) { /* no screenshots kept — results still stand */ }
    } catch (e) { /* corrupt — start clean */ }
  }

  /* ---------------------------------------------------------- snapshots */

  /* Grabs the 3D view. Must run in the same animation frame as the draw,
   * because the drawing buffer is not preserved — hence the rAF hook below. */
  function takeShot(cb) { pendingShot = cb; }

  function doShot() {
    var cb = pendingShot;
    pendingShot = null;
    var src = document.getElementById('game');
    if (!src || !cb) { if (cb) cb(''); return; }
    try {
      var w = Math.min(880, src.width);
      var h = Math.round(src.height * (w / src.width));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(src, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.55));
    } catch (e) { cb(''); }
  }

  /* The HUD is DOM, so it cannot be drawn into the screenshot. Recording where
   * every control actually was is more useful anyway — it catches overlaps and
   * off-screen controls exactly. */
  function hudSnapshot() {
    var ids = ['missionCard', 'topRight', 'scanMeter', 'toast', 'chevron', 'stick',
      'btnAction', 'btnJump', 'btnBuild', 'btnG1', 'btnG2', 'btnG3', 'btnPause',
      'buildBar', 'swatches', 'btnPlace', 'btnRemove', 'btnDone'];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      out.push({
        id: ids[i],
        shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0,
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        cls: el.className || '',
        txt: (el.textContent || '').trim().slice(0, 40)
      });
    }
    // anything sticking out of the viewport, or overlapping another control
    var problems = [];
    var vw = window.innerWidth, vh = window.innerHeight;
    out.forEach(function (a) {
      if (!a.shown) return;
      var r = a.rect;
      if (r[0] < -1 || r[1] < -1 || r[0] + r[2] > vw + 1 || r[1] + r[3] > vh + 1) {
        problems.push(a.id + ' is partly off screen');
      }
      out.forEach(function (b) {
        if (a === b || !b.shown || a.id > b.id) return;
        // a control sitting inside its own container is not a problem
        var ea = document.getElementById(a.id), eb = document.getElementById(b.id);
        if (ea && eb && (ea.contains(eb) || eb.contains(ea))) return;
        var s = b.rect;
        if (r[0] < s[0] + s[2] && s[0] < r[0] + r[2] &&
          r[1] < s[1] + s[3] && s[1] < r[1] + r[3]) {
          problems.push(a.id + ' overlaps ' + b.id);
        }
      });
    });
    return { elements: out, problems: problems, viewport: vw + 'x' + vh };
  }

  function gameContext() {
    var g = global.BS;
    if (!g || !g.player) return { note: 'game not running' };
    var mi = null;
    try { mi = global.BSMissions.current(); } catch (e) { /* not ready */ }
    return {
      at: [Math.round(g.player.x), Math.round(g.player.y * 10) / 10, Math.round(g.player.z)],
      mission: mi ? (mi.icon + ' ' + mi.text + ' (' + mi.done + '/' + mi.total + ')') : 'none',
      gadgets: Object.keys(g.gadgets).filter(function (k) { return g.gadgets[k]; }).join(', ') || 'none',
      badges: g.stats.badges,
      blocks: g.blocks.length,
      inVehicle: !!g.player.inVehicle,
      building: g.isBuilding ? g.isBuilding() : false,
      paused: !!g.paused
    };
  }

  function recordIssue(caseId, note, then) {
    takeShot(function (shot) {
      var issue = {
        t: since(), id: caseId || '', note: note || '',
        ctx: gameContext(), hud: hudSnapshot(),
        recent: m.events.slice(-40), shot: shot
      };
      var shots = st.issues.filter(function (i) { return i.shot; }).length;
      if (shots >= MAX_SHOTS) issue.shot = '';
      st.issues.push(issue);
      logEvent('ISSUE', caseId || 'ad hoc');
      save();
      if (then) then(issue);
    });
  }

  /* ------------------------------------------------------- the watchers */

  function startWatchers() {
    // frame timing, and the screenshot hook. Registering the next frame at the
    // END of this callback keeps it behind the game's own render.
    function tick(t) {
      if (m.lastFrame) {
        var dt = t - m.lastFrame;
        m.frames++; m.bucketFrames++;
        if (dt > m.worstFrame) m.worstFrame = dt;
        if (dt > m.bucketWorst) m.bucketWorst = dt;
        if (dt > 50) { m.jank++; }
        if (dt > 250 && st.armed) logEvent('freeze', Math.round(dt) + 'ms');
      }
      m.lastFrame = t;
      if (!m.bucketStart) m.bucketStart = t;
      if (t - m.bucketStart >= 5000) {
        m.fps.push({
          t: since(),
          fps: Math.round(m.bucketFrames / ((t - m.bucketStart) / 1000)),
          worst: Math.round(m.bucketWorst)
        });
        m.bucketStart = t; m.bucketFrames = 0; m.bucketWorst = 0;
      }
      if (pendingShot) doShot();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // WebGL context loss is silent and fatal — worth knowing about
    var c = document.getElementById('game');
    if (c) {
      c.addEventListener('webglcontextlost', function () {
        m.contextLost++;
        m.errors.push({ t: since(), kind: 'gl', msg: 'WebGL context lost', where: '', stack: '' });
        logEvent('ERROR', 'WebGL context lost');
      });
    }

    // dead taps and hammered buttons
    document.addEventListener('pointerdown', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('button,.btn,.chip') : null;
      if (!el) return;
      var id = el.id || el.className;
      var arr = tapLog[id] || (tapLog[id] = []);
      var t = now();
      arr.push(t);
      while (arr.length && t - arr[0] > 2500) arr.shift();
      if (arr.length >= 6) {
        m.rageTaps++;
        logEvent('hammered', id);
        arr.length = 0;
      }
      if (el.id === 'btnAction' && el.classList.contains('idle')) {
        m.deadTaps++;
        logEvent('pressed-nothing', '');
      }
    }, true);

    // game events
    if (global.BS && global.BS.on) {
      ['fizzbot', 'npc', 'fountain', 'tube', 'panel', 'crate', 'bench', 'enterVehicle',
        'exitVehicle', 'placeBlock', 'buildMode', 'scan', 'bounce', 'note', 'badge',
        'respawn'].forEach(function (name) {
          global.BS.on(name, function (d) {
            logEvent(name, d && d.id ? d.id : '');
            if (name === 'respawn') m.respawns++;
          });
        });
    }

    // half-second sampler: mission steps, and standing-still detection
    setInterval(function () {
      var g = global.BS;
      if (!g || !g.ready || !g.started) return;

      try {
        var cur = global.BSMissions.current();
        var key = cur ? cur.icon + cur.text : '';
        if (key !== lastStep) {
          if (lastStep !== null) {
            m.steps.push({ step: lastStep, seconds: Math.round((now() - lastStepAt) / 1000) });
          }
          lastStep = key; lastStepAt = now();
          if (st.armed) logEvent('objective', cur ? cur.text : '');
        }
      } catch (e) { /* missions not ready */ }

      if (g.paused || ui.kitOpen) return;
      posRing[posIdx % 90] = [g.player.x, g.player.z];
      posIdx++;
      if (posIdx >= 90 && now() > stuckMuteUntil) {
        var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
        for (var i = 0; i < 90; i++) {
          var p = posRing[i];
          if (!p) return;
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minZ) minZ = p[1];
          if (p[1] > maxZ) maxZ = p[1];
        }
        if (maxX - minX < 2 && maxZ - minZ < 2) {
          m.stuck++;
          stuckMuteUntil = now() + 60000;
          logEvent('not-moving', '45s at ' + Math.round(g.player.x) + ',' + Math.round(g.player.z));
        }
      }
    }, 500);
  }

  /* -------------------------------------------------------------- the UI */

  var CSS = [
    '#probeFab{position:fixed;left:calc(env(safe-area-inset-left,0px) + 14px);',
    'top:calc(env(safe-area-inset-top,0px) + 92px);',
    'width:56px;height:56px;border-radius:18px;border:0;',
    'background:#e0483c;color:#fff;font-size:26px;z-index:40;display:none;place-items:center;',
    'box-shadow:0 5px 0 #a02f26,0 8px 16px rgba(0,0,0,.3);touch-action:none;opacity:.85}',
    '#probeFab.on{display:grid}',
    '#probeKit{position:fixed;inset:0;z-index:60;background:#101828;color:#e8edf6;',
    'display:none;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;',
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ',
    'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}',
    '#probeKit.on{display:flex}',
    '#probeKit *{box-sizing:border-box}',
    '.pk-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#182238;flex:none}',
    '.pk-head b{font-size:17px;margin-right:auto}',
    '.pk-tab{flex:none;padding:12px 14px;border:0;border-radius:12px;background:#243350;',
    'color:#cfd8ea;font-size:15px;font-weight:600;min-height:46px}',
    '.pk-tab.sel{background:#3b6fe0;color:#fff}',
    '.pk-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 12px 40px}',
    '.pk-sec{margin:16px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8fa3c8}',
    '.pk-case{background:#1a2438;border-radius:14px;padding:10px 12px;margin-bottom:8px}',
    '.pk-case .id{font-size:12px;color:#7f93b8;font-weight:700}',
    '.pk-case .do{font-size:15px;margin:2px 0 2px;line-height:1.3}',
    '.pk-case .ex{font-size:13px;color:#93a6c9;line-height:1.3}',
    '.pk-case .smoke{display:inline-block;background:#8a5a12;color:#ffd88a;border-radius:6px;',
    'padding:1px 6px;font-size:11px;margin-left:6px;vertical-align:1px}',
    '.pk-btns{display:flex;gap:8px;margin-top:8px}',
    '.pk-btns button{flex:1;min-height:48px;border:0;border-radius:11px;background:#26324e;',
    'color:#cfd8ea;font-size:19px;font-weight:700}',
    '.pk-btns button.on-pass{background:#1e8a52;color:#fff}',
    '.pk-btns button.on-fail{background:#c23b30;color:#fff}',
    '.pk-btns button.on-skip{background:#5b6478;color:#fff}',
    '.pk-note{width:100%;margin-top:8px;min-height:56px;border-radius:11px;border:0;padding:9px;',
    'background:#0d1524;color:#e8edf6;font-size:15px;font-family:inherit}',
    '.pk-line{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #22304c;font-size:14px}',
    '.pk-line span:last-child{color:#9fb2d4;text-align:right;margin-left:12px}',
    '.pk-big{display:block;width:100%;min-height:56px;margin-top:12px;border:0;border-radius:14px;',
    'background:#3b6fe0;color:#fff;font-size:17px;font-weight:700}',
    '.pk-big.grey{background:#3a4560}',
    '.pk-ev{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#a9bbdc;line-height:1.5}',
    '.pk-ev b{color:#ffd88a;font-weight:600}',
    '.pk-warn{background:#43220f;color:#ffcf9a;border-radius:10px;padding:9px 11px;font-size:13px;margin:8px 0}',
    '#probeGate{position:fixed;inset:0;z-index:70;background:rgba(10,16,28,.94);display:none;',
    'place-items:center;font-family:system-ui,sans-serif;color:#e8edf6}',
    '#probeGate.on{display:grid}',
    '#probeGate .box{background:#182238;border-radius:20px;padding:20px;text-align:center;width:280px}',
    '#probeGate .q{font-size:24px;font-weight:700;margin-bottom:10px}',
    '#probeGate .ans{font-size:30px;min-height:40px;letter-spacing:3px;color:#ffd88a}',
    '#probeGate .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}',
    '#probeGate .pad button{min-height:52px;border:0;border-radius:12px;background:#26324e;',
    'color:#e8edf6;font-size:20px;font-weight:700}'
  ].join('');

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function buildUi() {
    if (ui.kit) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var fab = el('button', '', '🐞');
    fab.id = 'probeFab';
    fab.setAttribute('aria-label', 'Report something odd');
    fab.addEventListener('click', function (e) {
      e.preventDefault();
      fab.textContent = '…';
      recordIssue('', '', function () {
        fab.textContent = '✓';
        setTimeout(function () { fab.textContent = '🐞'; }, 900);
      });
    });
    document.body.appendChild(fab);
    ui.fab = fab;

    var kit = el('div');
    kit.id = 'probeKit';
    var head = el('div', 'pk-head');
    var title = el('b', '', 'Test Kit');
    head.appendChild(title);
    ['Checks', 'Live', 'Report'].forEach(function (name, i) {
      var b = el('button', 'pk-tab' + (i === 0 ? ' sel' : ''), name);
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(head.querySelectorAll('.pk-tab'), function (x) {
          x.classList.remove('sel');
        });
        b.classList.add('sel');
        showTab(i);
      });
      head.appendChild(b);
    });
    var close = el('button', 'pk-tab', '✕');
    close.addEventListener('click', closeKit);
    head.appendChild(close);
    kit.appendChild(head);

    var body = el('div', 'pk-body');
    kit.appendChild(body);
    document.body.appendChild(kit);
    ui.kit = kit; ui.body = body; ui.title = title;

    var gate = el('div');
    gate.id = 'probeGate';
    gate.innerHTML = '<div class="box"><div class="q"></div><div class="ans"></div>' +
      '<div class="pad"></div></div>';
    document.body.appendChild(gate);
    ui.gate = gate;
    var pad = gate.querySelector('.pad');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', 'OK'].forEach(function (k) {
      var b = el('button', '', k);
      b.addEventListener('click', function () { gateKey(k); });
      pad.appendChild(b);
    });
  }

  /* ------------------------------------------------------------- the gate */

  var gateSum = 0, gateTyped = '';

  function openGate() {
    buildUi();
    if (now() < gateOkUntil) { openKit(); return; }
    var a = 11 + Math.floor(Math.random() * 40);
    var b = 11 + Math.floor(Math.random() * 40);
    gateSum = a + b; gateTyped = '';
    ui.gate.querySelector('.q').textContent = 'Grown-ups:  ' + a + ' + ' + b + ' = ?';
    ui.gate.querySelector('.ans').textContent = '';
    ui.gate.classList.add('on');
  }

  function gateKey(k) {
    if (k === '←') gateTyped = gateTyped.slice(0, -1);
    else if (k === 'OK') {
      if (parseInt(gateTyped, 10) === gateSum) {
        ui.gate.classList.remove('on');
        gateOkUntil = now() + 10 * 60 * 1000;
        openKit();
      } else {
        gateTyped = '';
        ui.gate.querySelector('.ans').textContent = '✕';
        return;
      }
    } else if (gateTyped.length < 4) gateTyped += k;
    ui.gate.querySelector('.ans').textContent = gateTyped;
  }

  /* ----------------------------------------------------------- kit views */

  /* Captured when the long press STARTS, because the pause button's own
   * handler fires on pointer-down and will have paused the game by the time
   * the kit opens. Without this, closing the kit leaves the tester staring at
   * the pause menu. */
  var wasPaused = false;

  function openKit() {
    buildUi();
    if (!st.startedAt) { st.startedAt = now(); }
    if (!st.device) st.device = readDevice();
    if (!st.armed) {
      st.armed = true;
      st.sessions = (st.sessions || 0) + 1;
      ui.fab.classList.add('on');
      startWatchers();
      logEvent('test-kit', 'armed');
    }
    if (global.BS && global.BS.setPaused) global.BS.setPaused(true);
    ui.kitOpen = true;
    ui.kit.classList.add('on');
    showTab(ui.tab || 0);
  }

  function closeKit() {
    ui.kit.classList.remove('on');
    ui.kitOpen = false;
    save();
    if (global.BS && global.BS.setPaused && !wasPaused) global.BS.setPaused(false);
  }

  function counts() {
    var p = 0, f = 0, s = 0;
    CASES.forEach(function (c) {
      var r = st.results[c[0]];
      if (r === 'pass') p++; else if (r === 'fail') f++; else if (r === 'skip') s++;
    });
    return { pass: p, fail: f, skip: s, total: CASES.length, left: CASES.length - p - f - s };
  }

  function showTab(i) {
    ui.tab = i;
    var b = ui.body;
    b.innerHTML = '';
    if (i === 0) viewChecks(b);
    else if (i === 1) viewLive(b);
    else viewReport(b);
    b.scrollTop = 0;
    var c = counts();
    ui.title.textContent = 'Test Kit  ' + c.pass + '✓ ' + c.fail + '✗ ' + c.left + ' left';
  }

  function viewChecks(b) {
    var sec = '';
    CASES.forEach(function (c) {
      var id = c[0], s = id.charAt(0);
      if (s !== sec) {
        sec = s;
        b.appendChild(el('div', 'pk-sec', s + ' · ' + SECTIONS[s]));
      }
      var box = el('div', 'pk-case');
      var idLine = el('div', 'id');
      idLine.textContent = id;
      if (c[3]) {
        var sm = el('span', 'smoke', 'SMOKE');
        idLine.appendChild(sm);
      }
      box.appendChild(idLine);
      box.appendChild(el('div', 'do', c[1]));
      box.appendChild(el('div', 'ex', '→ ' + c[2]));

      var row = el('div', 'pk-btns');
      [['pass', '✓'], ['fail', '✗'], ['skip', '–']].forEach(function (pair) {
        var btn = el('button', '', pair[1]);
        if (st.results[id] === pair[0]) btn.classList.add('on-' + pair[0]);
        btn.addEventListener('click', function () {
          st.results[id] = st.results[id] === pair[0] ? undefined : pair[0];
          if (st.results[id] === undefined) delete st.results[id];
          if (st.results[id] === 'fail') {
            recordIssue(id, st.notes[id] || '');
          }
          save();
          showTab(0);
        });
        row.appendChild(btn);
      });
      box.appendChild(row);

      if (st.results[id] === 'fail' || st.notes[id]) {
        var ta = el('textarea', 'pk-note');
        ta.placeholder = 'What happened? (optional)';
        ta.value = st.notes[id] || '';
        ta.addEventListener('input', function () { st.notes[id] = ta.value; });
        ta.addEventListener('blur', save);
        box.appendChild(ta);
      }
      b.appendChild(box);
    });
  }

  function viewLive(b) {
    var c = gameContext();
    b.appendChild(el('div', 'pk-sec', 'Right now'));
    line(b, 'Where', c.at ? c.at.join(', ') : '—');
    line(b, 'Objective', c.mission || '—');
    line(b, 'Gadgets', c.gadgets || '—');
    line(b, 'Badges', String(c.badges === undefined ? '—' : c.badges));
    line(b, 'Blocks placed', String(c.blocks === undefined ? '—' : c.blocks));

    b.appendChild(el('div', 'pk-sec', 'This session'));
    var mins = Math.round(since() / 60);
    line(b, 'Playing for', mins + ' min');
    line(b, 'Average frame rate', avgFps() + ' fps');
    line(b, 'Stutters over 50ms', String(m.jank));
    line(b, 'Worst single frame', Math.round(m.worstFrame) + ' ms');
    line(b, 'Errors', String(m.errors.length));
    line(b, 'Falls and respawns', String(m.respawns));
    line(b, 'Stood still 45s+', String(m.stuck));
    line(b, 'Pressed ⭐ with nothing there', String(m.deadTaps));
    line(b, 'Buttons hammered', String(m.rageTaps));
    line(b, 'Rotations', String(m.orientation));
    line(b, 'Issues logged', String(st.issues.length));

    var hud = hudSnapshot();
    if (hud.problems.length) {
      var w = el('div', 'pk-warn', 'Layout: ' + hud.problems.join('; '));
      b.appendChild(w);
    }

    if (m.errors.length) {
      b.appendChild(el('div', 'pk-sec', 'Errors'));
      m.errors.slice(-6).forEach(function (e) {
        b.appendChild(el('div', 'pk-warn', '[' + e.t + 's] ' + e.msg + ' ' + e.where));
      });
    }

    b.appendChild(el('div', 'pk-sec', 'Last 30 things that happened'));
    var log = el('div', 'pk-ev');
    log.innerHTML = m.events.slice(-30).reverse().map(function (e) {
      return '<b>' + e.t + 's</b> ' + e.k + (e.d ? ' · ' + e.d : '');
    }).join('<br>') || 'nothing yet';
    b.appendChild(log);

    var refresh = el('button', 'pk-big grey', 'Refresh');
    refresh.addEventListener('click', function () { showTab(1); });
    b.appendChild(refresh);
  }

  function line(parent, k, v) {
    var d = el('div', 'pk-line');
    d.appendChild(el('span', '', k));
    d.appendChild(el('span', '', v));
    parent.appendChild(d);
  }

  function avgFps() {
    if (!m.fps.length) {
      // no five-second bucket has closed yet — show the one in progress
      var ms = m.lastFrame - m.bucketStart;
      if (m.bucketFrames > 5 && ms > 400) return Math.round(m.bucketFrames / (ms / 1000));
      return '—';
    }
    var t = 0;
    m.fps.forEach(function (f) { t += f.fps; });
    return Math.round(t / m.fps.length);
  }

  function viewReport(b) {
    var c = counts();
    b.appendChild(el('div', 'pk-sec', 'Summary'));
    line(b, 'Passed', String(c.pass));
    line(b, 'Failed', String(c.fail));
    line(b, 'Skipped', String(c.skip));
    line(b, 'Not yet done', String(c.left));
    line(b, 'Issues with screenshots', String(st.issues.filter(function (i) { return i.shot; }).length));

    var dl = el('button', 'pk-big', '⤓  Save report to Files');
    dl.addEventListener('click', function () { saveReport(); });
    b.appendChild(dl);

    var cp = el('button', 'pk-big grey', '⧉  Copy report as text');
    cp.addEventListener('click', function () {
      var txt = textReport();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { cp.textContent = '✓ Copied'; },
          function () { showFallback(txt); });
      } else showFallback(txt);
    });
    b.appendChild(cp);

    var reset = el('button', 'pk-big grey', 'Clear all test results');
    reset.addEventListener('click', function () {
      if (reset.dataset.sure) {
        st.results = {}; st.notes = {}; st.issues = []; st.startedAt = now();
        m.errors = [];
        try { localStorage.removeItem(LS_SHOTS); } catch (e) { /* fine */ }
        save(); showTab(2);
      } else {
        reset.dataset.sure = '1';
        reset.textContent = 'Tap again to clear everything';
      }
    });
    b.appendChild(reset);

    b.appendChild(el('div', 'pk-warn',
      'Everything stays on this iPad. The report is a file you save and send yourself — ' +
      'nothing is uploaded anywhere.'));

    function showFallback(txt) {
      var ta = el('textarea', 'pk-note');
      ta.style.minHeight = '220px';
      ta.value = txt;
      b.appendChild(ta);
      ta.select();
    }
  }

  /* --------------------------------------------------------- the report */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function textReport() {
    var c = counts();
    var out = ['Bobble Squad — iPad test report', new Date().toISOString(), '',
      'Passed ' + c.pass + '  Failed ' + c.fail + '  Skipped ' + c.skip + '  Not done ' + c.left, ''];
    out.push('Device: ' + (st.device ? st.device.ua : '?'));
    out.push('Viewport ' + (st.device ? st.device.viewport : '?') +
      ' · dpr ' + (st.device ? st.device.dpr : '?') +
      ' · standalone ' + (st.device ? st.device.standalone : '?'));
    out.push('Renderer: ' + (st.device ? st.device.renderer : '?'));
    out.push('Safe areas (t/r/b/l): ' + (st.device ? st.device.insets : '?'));
    out.push('');
    out.push('Average ' + avgFps() + ' fps · ' + m.jank + ' stutters · worst frame ' +
      Math.round(m.worstFrame) + 'ms · ' + m.errors.length + ' errors');
    out.push(m.respawns + ' respawns · ' + m.stuck + ' stuck · ' + m.deadTaps +
      ' dead taps · ' + m.rageTaps + ' hammered · ' + m.orientation + ' rotations');
    out.push('');
    CASES.forEach(function (cs) {
      var r = st.results[cs[0]] || '—';
      out.push(cs[0] + '  ' + r.toUpperCase() + '  ' + cs[1] +
        (st.notes[cs[0]] ? '\n      note: ' + st.notes[cs[0]] : ''));
    });
    out.push('');
    st.issues.forEach(function (i, n) {
      out.push('Issue ' + (n + 1) + ' [' + i.t + 's] ' + (i.id || 'ad hoc') + ' — ' + (i.note || 'no note'));
      if (i.ctx && i.ctx.at) out.push('   at ' + i.ctx.at.join(',') + ' · ' + i.ctx.mission);
      if (i.hud && i.hud.problems && i.hud.problems.length) out.push('   layout: ' + i.hud.problems.join('; '));
    });
    return out.join('\n');
  }

  function htmlReport() {
    var c = counts();
    var d = st.device || {};
    var h = [];
    h.push('<!doctype html><meta charset="utf-8"><title>Bobble Squad — iPad test report</title>');
    h.push('<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:24px auto;' +
      'padding:0 16px;color:#1b2436;line-height:1.5}h1{margin:0 0 4px}h2{margin:28px 0 8px;font-size:19px;' +
      'border-bottom:2px solid #e3e8f2;padding-bottom:4px}table{border-collapse:collapse;width:100%;font-size:14px}' +
      'td,th{padding:6px 8px;border-bottom:1px solid #eef1f7;text-align:left;vertical-align:top}' +
      '.pass{color:#137a45;font-weight:700}.fail{color:#c0342a;font-weight:700}.skip{color:#7a8296}' +
      '.none{color:#b9c0cf}.k{display:flex;gap:24px;flex-wrap:wrap;margin:10px 0}' +
      '.k div{background:#f4f6fb;border-radius:10px;padding:8px 14px;font-size:14px}' +
      '.k b{display:block;font-size:22px}img{max-width:100%;border-radius:10px;border:1px solid #dfe4ee}' +
      '.iss{background:#fff8f4;border:1px solid #f2d6c8;border-radius:12px;padding:12px;margin:12px 0}' +
      'code{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:#f4f6fb;padding:1px 5px;border-radius:4px}' +
      'pre{background:#f4f6fb;padding:10px;border-radius:8px;overflow:auto;font-size:12px}' +
      '.warn{background:#fff3e0;border-radius:8px;padding:8px 10px;font-size:13px}</style>');
    h.push('<h1>Bobble Squad — iPad test report</h1>');
    h.push('<p>' + esc(new Date().toString()) + ' · session ' + Math.round(since() / 60) + ' minutes</p>');

    h.push('<div class="k">' +
      '<div><b>' + c.pass + '</b>passed</div>' +
      '<div><b>' + c.fail + '</b>failed</div>' +
      '<div><b>' + c.skip + '</b>skipped</div>' +
      '<div><b>' + c.left + '</b>not done</div>' +
      '<div><b>' + avgFps() + '</b>avg fps</div>' +
      '<div><b>' + m.jank + '</b>stutters</div>' +
      '<div><b>' + m.errors.length + '</b>errors</div>' +
      '</div>');

    h.push('<h2>Device</h2><table>');
    [['User agent', d.ua], ['Viewport', d.viewport], ['Screen', d.screen],
    ['Pixel ratio', d.dpr], ['Safe areas (t/r/b/l)', d.insets],
    ['Home-screen app', d.standalone], ['Touch points', d.touch],
    ['GPU', d.renderer], ['Memory', d.memory], ['Online at start', d.online]
    ].forEach(function (r) {
      h.push('<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1] === undefined ? '?' : r[1]) + '</td></tr>');
    });
    h.push('</table>');

    h.push('<h2>Behaviour signals</h2><table>');
    [['Falls and respawns', m.respawns],
    ['Stood still for 45s or more', m.stuck],
    ['Pressed the action button with nothing there', m.deadTaps],
    ['Buttons hammered (6+ taps in 2.5s)', m.rageTaps],
    ['Orientation changes', m.orientation],
    ['Worst single frame', Math.round(m.worstFrame) + ' ms'],
    ['WebGL context lost', m.contextLost]
    ].forEach(function (r) {
      h.push('<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>');
    });
    h.push('</table>');

    if (m.steps.length) {
      h.push('<h2>Time on each objective</h2><table><tr><th>Objective</th><th>Seconds</th></tr>');
      m.steps.forEach(function (s) {
        h.push('<tr><td>' + esc(s.step) + '</td><td>' + s.seconds + '</td></tr>');
      });
      h.push('</table>');
    }

    if (m.errors.length) {
      h.push('<h2>Errors</h2>');
      m.errors.forEach(function (e) {
        h.push('<div class="iss"><b>[' + e.t + 's] ' + esc(e.msg) + '</b> <code>' +
          esc(e.where) + '</code>' + (e.stack ? '<pre>' + esc(e.stack) + '</pre>' : '') + '</div>');
      });
    }

    h.push('<h2>Checks</h2><table><tr><th>ID</th><th>What was done</th><th>Result</th><th>Note</th></tr>');
    CASES.forEach(function (cs) {
      var r = st.results[cs[0]];
      var cls = r === 'pass' ? 'pass' : r === 'fail' ? 'fail' : r === 'skip' ? 'skip' : 'none';
      h.push('<tr><td>' + cs[0] + (cs[3] ? ' ★' : '') + '</td><td>' + esc(cs[1]) +
        '<br><small style="color:#7a8296">→ ' + esc(cs[2]) + '</small></td>' +
        '<td class="' + cls + '">' + (r ? r.toUpperCase() : '—') + '</td><td>' +
        esc(st.notes[cs[0]] || '') + '</td></tr>');
    });
    h.push('</table>');

    if (st.issues.length) {
      h.push('<h2>Issues</h2>');
      st.issues.forEach(function (i, n) {
        h.push('<div class="iss"><b>Issue ' + (n + 1) + '</b> — ' +
          (i.id ? 'check ' + esc(i.id) : 'spotted while playing') +
          ' at ' + i.t + 's<p>' + esc(i.note || '(no note)') + '</p>');
        if (i.ctx && i.ctx.at) {
          h.push('<p><code>at ' + i.ctx.at.join(', ') + '</code> · ' + esc(i.ctx.mission) +
            ' · gadgets: ' + esc(i.ctx.gadgets) + ' · blocks: ' + i.ctx.blocks +
            (i.ctx.inVehicle ? ' · in the buggy' : '') + '</p>');
        }
        if (i.hud && i.hud.problems && i.hud.problems.length) {
          h.push('<div class="warn">Layout problems: ' + esc(i.hud.problems.join('; ')) + '</div>');
        }
        if (i.shot) h.push('<img alt="screenshot" src="' + i.shot + '">');
        if (i.hud && i.hud.elements) {
          h.push('<details><summary>Where every control was</summary><table>' +
            '<tr><th>Control</th><th>Shown</th><th>x, y, w, h</th><th>Classes</th></tr>' +
            i.hud.elements.map(function (e) {
              return '<tr><td>' + e.id + '</td><td>' + (e.shown ? 'yes' : 'no') + '</td><td><code>' +
                e.rect.join(', ') + '</code></td><td><small>' + esc(e.cls) + '</small></td></tr>';
            }).join('') + '</table></details>');
        }
        if (i.recent && i.recent.length) {
          h.push('<details><summary>What happened just before</summary><pre>' +
            esc(i.recent.map(function (e) {
              return e.t + 's  ' + e.k + (e.d ? '  ' + e.d : '');
            }).join('\n')) + '</pre></details>');
        }
        h.push('</div>');
      });
    }

    if (m.fps.length) {
      h.push('<h2>Frame rate over time</h2><pre>' +
        esc(m.fps.map(function (f) {
          var bars = '';
          for (var i = 0; i < Math.min(60, f.fps); i += 2) bars += '#';
          return String(f.t).padStart(5) + 's  ' + String(f.fps).padStart(3) + ' fps  ' + bars;
        }).join('\n')) + '</pre>');
    }

    h.push('<h2>Full event log</h2><pre>' +
      esc(m.events.map(function (e) {
        return String(e.t).padStart(5) + 's  ' + e.k + (e.d ? '  ' + e.d : '');
      }).join('\n')) + '</pre>');

    h.push('<p style="color:#7a8296;font-size:13px;margin-top:30px">' +
      'Recorded entirely on the device. No data was sent anywhere.<br>' +
      'Check results, notes, issues, screenshots and errors survive relaunching the app. ' +
      'Frame rate, the event log and the behaviour counters cover the current run only — ' +
      'this is run ' + (st.sessions || 1) + '.</p>');
    return h.join('\n');
  }

  function saveReport() {
    try {
      var blob = new Blob([htmlReport()], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var when = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      a.href = url;
      a.download = 'bobble-squad-test-' + when + '.html';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);
    } catch (e) {
      var w = window.open('', '_blank');
      if (w) { w.document.write(htmlReport()); w.document.close(); }
    }
  }

  /* ------------------------------------------------------------ wiring */

  function armLongPress() {
    var btn = document.getElementById('btnPause');
    if (!btn) return;
    var timer = null;
    function start() {
      clearTimeout(timer);
      wasPaused = !!(global.BS && global.BS.paused);
      timer = setTimeout(openGate, 2500);
    }
    function stop() { clearTimeout(timer); }
    btn.addEventListener('pointerdown', start, true);
    btn.addEventListener('pointerup', stop, true);
    btn.addEventListener('pointercancel', stop, true);
    btn.addEventListener('pointerleave', stop, true);
  }

  function boot() {
    load();
    armLongPress();
    // the tester will force-quit several times; do not lose anything
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') save();
    });
    if (/[?&]probe=1/.test(location.search)) {
      gateOkUntil = now() + 3600000;
      setTimeout(openGate, 300);
    } else if (st.armed) {
      // a test run already in progress before a reload — keep recording
      buildUi();
      st.device = st.device || readDevice();
      if (!st.startedAt) st.startedAt = now();
      st.sessions = (st.sessions || 0) + 1;
      ui.fab.classList.add('on');
      startWatchers();
      logEvent('test-kit', 'resumed after relaunch, run ' + st.sessions);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }

  global.BSProbe = {
    open: openKit,
    cases: CASES,
    metrics: m,
    state: st,
    report: htmlReport,
    issue: recordIssue
  };
})(window);
