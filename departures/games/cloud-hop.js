/* Cloud Hop — one-tap endless flyer. Tap anywhere to climb, slip through the
 * gaps in the cloud banks, grab the stars. Two difficulties so a four-year-old
 * and a competitive adult can share the same high-score list.
 */
(function () {
  'use strict';

  var STORE_BEST = 'cloudhop:best';
  var STORE_MODE = 'cloudhop:mode';

  var MODES = {
    easy: { label: 'Gentle', gap: 0.42, speed: 0.46, ramp: 0.10, spawn: 1.55 },
    normal: { label: 'Proper', gap: 0.31, speed: 0.58, ramp: 0.16, spawn: 1.25 }
  };

  function mount(root, api) {
    var h = api.h;
    var best = api.store.get(STORE_BEST, { easy: 0, normal: 0 });
    var modeKey = api.store.get(STORE_MODE, 'easy');
    if (!MODES[modeKey]) modeKey = 'easy';

    var stage = h('div.hop-stage');
    var canvas = h('canvas');
    var hud = h('div.hop-hud', null,
      h('span', { id: 'hop-score', text: '0' }),
      h('span', { id: 'hop-best', text: 'Best ' + best[modeKey] }));
    var overlay = h('div.hop-overlay');
    stage.appendChild(canvas);
    stage.appendChild(hud);
    stage.appendChild(overlay);

    var modeSeg = h('div.seg', null, Object.keys(MODES).map(function (key) {
      return h('button.seg-btn', {
        'aria-pressed': key === modeKey ? 'true' : 'false',
        onclick: function () {
          modeKey = key;
          api.store.set(STORE_MODE, key);
          api.sfx.tap();
          Array.prototype.forEach.call(modeSeg.children, function (b, i) {
            b.setAttribute('aria-pressed', Object.keys(MODES)[i] === key ? 'true' : 'false');
          });
          reset();
        }
      }, MODES[key].label);
    }));

    api.append(root, [
      stage,
      h('div.option-group', { style: { marginTop: '0.9rem' } },
        h('span.option-label', { text: 'Difficulty' }), modeSeg),
      h('p.pill-note', { text: 'Gentle has big gaps and a slow pace for small hands. Proper is the one to argue over.' })
    ]);

    // ------------------------------------------------------------ sizing
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;

    function resize() {
      var available = window.innerHeight - stage.getBoundingClientRect().top - 190;
      var width = stage.clientWidth || root.clientWidth || 320;
      var height = api.clamp(available, 300, Math.min(width * 1.45, 620));
      stage.style.height = Math.round(height) + 'px';
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      W = stage.clientWidth;
      H = Math.round(height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    // -------------------------------------------------------------- state
    var state = 'ready'; // ready | playing | dead
    var plane, pillars, stars, puffs, score, elapsed, spawnTimer, raf = 0, lastTime = 0;

    function reset() {
      state = 'ready';
      plane = { x: 0, y: 0, vy: 0, tilt: 0 };
      pillars = [];
      stars = [];
      puffs = [];
      for (var i = 0; i < 8; i++) {
        puffs.push({ x: Math.random(), y: Math.random(), r: 0.05 + Math.random() * 0.08, s: 0.1 + Math.random() * 0.2 });
      }
      score = 0;
      elapsed = 0;
      spawnTimer = 0.6;
      plane.x = 0.28;
      plane.y = 0.45;
      updateHud();
      showOverlay('ready');
      draw();
    }

    function updateHud() {
      hud.children[0].textContent = String(score);
      hud.children[1].textContent = 'Best ' + (best[modeKey] || 0);
    }

    function showOverlay(kind) {
      overlay.innerHTML = '';
      overlay.hidden = false;
      if (kind === 'ready') {
        api.append(overlay, h('div', null,
          h('h3', { text: '☁️ Cloud Hop' }),
          h('p', { text: 'Tap anywhere to flap. Fly through the gaps and collect the stars.' }),
          h('button.btn', { onclick: start }, 'Start flying')));
      } else if (kind === 'dead') {
        var isBest = score > 0 && score >= (best[modeKey] || 0);
        api.append(overlay, h('div', null,
          h('h3', { text: isBest ? '🏆 New best!' : 'Bumped a cloud' }),
          h('p', { text: 'You scored ' + score + '. Best on ' + MODES[modeKey].label.toLowerCase() + ' is ' + (best[modeKey] || 0) + '.' }),
          h('button.btn', { onclick: start }, 'Fly again')));
      }
    }

    function hideOverlay() { overlay.hidden = true; overlay.innerHTML = ''; }

    function start() {
      hideOverlay();
      state = 'playing';
      plane.y = 0.45;
      plane.vy = 0;
      pillars = [];
      stars = [];
      score = 0;
      elapsed = 0;
      spawnTimer = 0.55;
      updateHud();
      flap();
      lastTime = 0;
      loop(performance.now());
    }

    function flap() {
      if (state !== 'playing') return;
      plane.vy = -0.95;
      api.sfx.flip();
    }

    function die() {
      state = 'dead';
      api.sfx.lose();
      api.buzz([18, 40, 24]);
      if (score > (best[modeKey] || 0)) {
        best[modeKey] = score;
        api.store.set(STORE_BEST, best);
      }
      updateHud();
      showOverlay('dead');
    }

    // ------------------------------------------------------------- physics
    function step(dt) {
      var mode = MODES[modeKey];
      elapsed += dt;
      var speed = mode.speed + Math.min(elapsed * mode.ramp * 0.06, mode.ramp);

      plane.vy += 2.6 * dt;
      plane.y += plane.vy * dt;
      plane.tilt = api.clamp(plane.vy * 0.5, -0.5, 0.9);

      if (plane.y < 0.04) { plane.y = 0.04; plane.vy = 0; }
      if (plane.y > 0.97) { plane.y = 0.97; die(); return; }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = mode.spawn * (0.9 + Math.random() * 0.2);
        var gap = mode.gap;
        var centre = 0.2 + Math.random() * 0.6;
        centre = api.clamp(centre, gap / 2 + 0.08, 1 - gap / 2 - 0.08);
        pillars.push({ x: 1.12, gapY: centre, gap: gap, passed: false });
        if (Math.random() < 0.55) {
          stars.push({ x: 1.12, y: centre + (Math.random() - 0.5) * gap * 0.4, taken: false });
        }
      }

      var planeR = 0.036;
      var i;
      for (i = pillars.length - 1; i >= 0; i--) {
        var p = pillars[i];
        p.x -= speed * dt;
        if (p.x < -0.25) { pillars.splice(i, 1); continue; }
        if (!p.passed && p.x + 0.06 < plane.x) {
          p.passed = true;
          score += 1;
          api.sfx.tap();
          updateHud();
        }
        // pillar is a vertical band 0.12 wide in x, solid except the gap
        if (plane.x + planeR > p.x - 0.06 && plane.x - planeR < p.x + 0.06) {
          var top = p.gapY - p.gap / 2;
          var bottom = p.gapY + p.gap / 2;
          if (plane.y - planeR * 0.7 < top || plane.y + planeR * 0.7 > bottom) {
            die();
            return;
          }
        }
      }

      for (i = stars.length - 1; i >= 0; i--) {
        var s = stars[i];
        s.x -= speed * dt;
        if (s.x < -0.1) { stars.splice(i, 1); continue; }
        if (!s.taken && Math.abs(s.x - plane.x) < 0.055 && Math.abs(s.y - plane.y) < 0.06) {
          s.taken = true;
          score += 5;
          api.sfx.good();
          api.buzz(10);
          updateHud();
        }
      }

      for (i = 0; i < puffs.length; i++) {
        puffs[i].x -= speed * puffs[i].s * dt;
        if (puffs[i].x < -0.2) {
          puffs[i].x = 1.2;
          puffs[i].y = Math.random();
        }
      }
    }

    // ------------------------------------------------------------- drawing
    function draw() {
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);

      // drifting background puffs
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      puffs.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r * H, 0, Math.PI * 2);
        ctx.fill();
      });

      pillars.forEach(function (p) {
        var cx = p.x * W;
        var half = 0.06 * W;
        var top = (p.gapY - p.gap / 2) * H;
        var bottom = (p.gapY + p.gap / 2) * H;
        drawCloudBank(cx, half, 0, top);
        drawCloudBank(cx, half, bottom, H - bottom);
      });

      stars.forEach(function (s) {
        if (s.taken) return;
        drawStar(s.x * W, s.y * H, 0.026 * H);
      });

      drawPlane(plane.x * W, plane.y * H, 0.05 * H, plane.tilt);
    }

    // A bank is one solid column with bobbles down both sides, so it reads as
    // cloud rather than pipe. The bobbles stay inside the collision box.
    function drawCloudBank(cx, half, y, height) {
      if (height <= 0) return;
      var r = half * 0.95;
      var core = half * 0.55;
      ctx.save();
      ctx.fillStyle = 'rgba(247,251,255,0.96)';
      ctx.beginPath();
      ctx.rect(cx - core, y - 2, core * 2, height + 4);
      // a stack of overlapping puffs, nudged side to side so the column of
      // cloud has lobes rather than a straight edge
      var lobe = 0;
      for (var yy = y + r * 0.35; yy <= y + height; yy += r * 1.05) {
        var ox = (lobe % 2 === 0 ? -1 : 1) * half * 0.06;
        var rr = r * (lobe % 3 === 0 ? 1 : 0.88);
        ctx.moveTo(cx + ox + rr, yy);
        ctx.arc(cx + ox, yy, rr, 0, Math.PI * 2);
        lobe++;
      }
      ctx.fill();
      ctx.restore();
    }

    function drawStar(cx, cy, r) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#ffce4d';
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var radius = i % 2 === 0 ? r : r * 0.45;
        var angle = (Math.PI / 5) * i - Math.PI / 2;
        var px = Math.cos(angle) * radius;
        var py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawPlane(cx, cy, size, tilt) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt * 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.8, -size * 0.62);
      ctx.lineTo(-size * 0.45, 0);
      ctx.lineTo(-size * 0.8, size * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(20,40,80,0.28)';
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.45, 0);
      ctx.lineTo(-size * 0.8, size * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ---------------------------------------------------------------- loop
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!lastTime) lastTime = now;
      var dt = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      if (state === 'playing') step(dt);
      draw();
      if (state !== 'playing') {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    // ------------------------------------------------------------- inputs
    function onPointer(event) {
      if (event.target.closest && event.target.closest('button')) return;
      event.preventDefault();
      if (state === 'playing') flap();
      else if (state === 'ready') start();
    }

    function onKey(event) {
      if (event.code !== 'Space' && event.key !== 'ArrowUp') return;
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      event.preventDefault();
      if (state === 'playing') flap(); else if (state !== 'dead') start();
    }

    function onHide() {
      if (document.hidden && state === 'playing') {
        state = 'dead';
        if (score > (best[modeKey] || 0)) {
          best[modeKey] = score;
          api.store.set(STORE_BEST, best);
        }
        updateHud();
        showOverlay('dead');
      }
    }

    stage.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onHide);

    reset();
    resize();

    return function teardown() {
      if (raf) cancelAnimationFrame(raf);
      stage.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onHide);
    };
  }

  window.Departures.register({
    id: 'cloud-hop',
    title: 'Cloud Hop',
    emoji: '☁️',
    accent: 'sky',
    players: '1 player',
    ages: 'Ages 4+',
    blurb: 'Tap to flap a paper plane through the clouds. One thumb, no reading.',
    howTo: [
      '<strong>Tap anywhere on the sky</strong> to flap upwards. Stop tapping and you drift down.',
      'Fly through the gaps in the cloud banks. <strong>Each gap is one point</strong>, each star is five.',
      '<strong>Gentle mode</strong> has big gaps and a slow pace — it is the one for small children. <strong>Proper mode</strong> is the one to argue over.',
      'Your best score for each mode is kept on this phone.'
    ],
    summary: function (api) {
      var best = api.store.get(STORE_BEST, {});
      var top = Math.max(best.easy || 0, best.normal || 0);
      return top ? 'Best ' + top : '';
    },
    mount: mount
  });
})();
