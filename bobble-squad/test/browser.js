/* Bobble Squad — the checks that need a real browser.
 *
 * These exist because two bugs got all the way to a phone before anyone found
 * them, and both were invisible to `test/run.js`:
 *
 *   1. The pause panel grew past the bottom of a phone screen once the "start
 *      again" confirmation appeared, so the "yes" button was off screen and
 *      the reset looked broken.
 *   2. The rotate-your-tablet card was a full-screen overlay that swallowed
 *      every touch, so in portrait you could not press anything at all.
 *
 * Neither is a logic error — both are layout — which is exactly the sort of
 * thing a node test cannot see. Everything here is checked at real phone and
 * tablet sizes.
 *
 * Needs Playwright, which is a development dependency only; nothing in the
 * shipped game uses it.
 *
 *   npx http-server . -p 8099 -c-1 &
 *   node test/browser.js
 */
'use strict';

var PORT = process.env.PORT || 8099;
var URL = 'http://127.0.0.1:' + PORT + '/index.html';

var chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  try {
    chromium = require('/opt/node22/lib/node_modules/playwright').chromium;
  } catch (e2) {
    console.log('Playwright is not installed — skipping the browser checks.');
    console.log('  npm i -D playwright && npx playwright install chromium');
    process.exit(0);
  }
}

var failures = [];
var count = 0;

function check(name, cond, extra) {
  count++;
  if (cond) console.log('  ok   ' + name + (extra ? '  — ' + extra : ''));
  else { console.log('  FAIL ' + name + (extra ? '  — ' + extra : '')); failures.push(name); }
}
function section(t) { console.log('\n' + t); }

/* The screen sizes that matter. The phone ones are here because that is where
 * both known bugs showed up. */
var SIZES = [
  ['iPhone landscape', 844, 390],
  ['iPhone portrait', 390, 844],
  ['iPad mini landscape', 1024, 768],
  ['iPad landscape', 1180, 820],
  ['iPad Pro landscape', 1366, 1024]
];

function press(page, sel) {
  return page.evaluate(function (s) {
    var el = document.querySelector(s);
    if (!el) throw new Error('no element ' + s);
    var r = el.getBoundingClientRect();
    var o = {
      pointerId: 7, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true
    };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
  }, sel);
}

async function main() {
  var browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });

  for (var i = 0; i < SIZES.length; i++) {
    var name = SIZES[i][0], w = SIZES[i][1], h = SIZES[i][2];
    section(name + '  ' + w + ' x ' + h);

    var ctx = await browser.newContext({
      viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2
    });
    var page = await ctx.newPage();
    var errors = [];
    var requests = [];
    page.on('pageerror', function (e) { errors.push(e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', function (r) { requests.push(r.url()); });

    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(900);

    check('game boots', await page.evaluate(function () { return !!(window.BS && window.BS.ready); }));

    /* ---- nothing may block the play button, in any orientation ---- */
    var blocked = await page.evaluate(function () {
      var b = document.getElementById('btnPlay').getBoundingClientRect();
      var el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { hit: el ? (el.id || el.className) : 'nothing' };
    });
    check('the play button is reachable', blocked.hit === 'btnPlay', blocked.hit);

    await page.click('#btnPlay');
    await page.waitForTimeout(500);

    /* ---- the rotate hint must never eat a touch ---- */
    var free = await page.evaluate(function () {
      var bad = [];
      ['btnAction', 'btnJump', 'btnPause'].forEach(function (id) {
        var e = document.getElementById(id);
        var r = e.getBoundingClientRect();
        if (!r.width) return;
        var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        var ok = hit && (hit.id === id || e.contains(hit) || (hit.closest && hit.closest('#' + id)));
        if (!ok) bad.push(id + ' blocked by ' + (hit ? (hit.id || hit.className) : 'nothing'));
      });
      // the joystick is deliberately pointer-events:none; its touches belong
      // to the canvas, so the canvas is the right answer there
      var sr = document.getElementById('stick').getBoundingClientRect();
      var sh = document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2);
      if (!sh || sh.id !== 'game') {
        bad.push('joystick area reaches ' + (sh ? (sh.id || sh.className) : 'nothing'));
      }
      return bad;
    });
    check('every control is reachable while playing', free.length === 0, free.join('; '));

    /* ---- HUD controls must not overlap or run off screen ---- */
    var layout = await page.evaluate(function () {
      var ids = ['missionCard', 'topRight', 'btnAction', 'btnJump', 'stick', 'buildBar', 'gadgetRow'];
      var boxes = ids.map(function (id) {
        var e = document.getElementById(id);
        var r = e ? e.getBoundingClientRect() : null;
        return { id: id, r: r, el: e, shown: r && r.width > 0 };
      });
      var bad = [];
      boxes.forEach(function (a, ai) {
        if (!a.shown) return;
        if (a.r.left < -1 || a.r.top < -1 ||
          a.r.right > window.innerWidth + 1 || a.r.bottom > window.innerHeight + 1) {
          bad.push(a.id + ' off screen');
        }
        boxes.forEach(function (b, bi) {
          if (bi <= ai || !b.shown) return;
          if (a.el.contains(b.el) || b.el.contains(a.el)) return;
          if (a.r.left < b.r.right && b.r.left < a.r.right &&
            a.r.top < b.r.bottom && b.r.top < a.r.bottom) bad.push(a.id + ' overlaps ' + b.id);
        });
      });
      var smallest = Math.min.apply(null,
        [].map.call(document.querySelectorAll('.btn:not(.hidden), .chip'), function (e) {
          var r = e.getBoundingClientRect();
          return r.width || 999;
        }));
      return { bad: bad, smallest: smallest };
    });
    check('no HUD control overlaps or runs off screen', layout.bad.length === 0, layout.bad.join('; '));

    /* a message must not sit on top of the objective or the badge counter */
    var toast = await page.evaluate(function () {
      window.BS.toast('🤖', 'Follow the arrow!', 6);
      return new Promise(function (done) {
        setTimeout(function () {
          function box(id) { return document.getElementById(id).getBoundingClientRect(); }
          function hit(a, b) {
            return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          }
          var t = box('toast'), bad = [];
          if (hit(t, box('missionCard'))) bad.push('the objective card');
          if (hit(t, box('topRight'))) bad.push('the badge counter');
          if (t.left < -1 || t.right > window.innerWidth + 1) bad.push('the screen edge');
          done(bad);
        }, 450);
      });
    });
    check('a message does not cover the objective or the badges',
      toast.length === 0, 'covers ' + toast.join(' and '));
    check('smallest visible touch target is at least 46px', layout.smallest >= 46, layout.smallest + 'px');

    /* ---- Start again: the whole flow, on screen, and it really resets ---- */
    await page.evaluate(function () {
      ['sniffer', 'boots', 'mitt'].forEach(function (g) { window.BS.unlockGadget(g); });
      window.BS.badgesFound.b1 = true;
      window.BS.stats.badges = 1;
      window.BS.playerColour = 2;
      window.BS.save();
    });
    await page.waitForTimeout(200);
    check('progress saved', !!(await page.evaluate(function () {
      return localStorage.getItem('bobblesquad:v1');
    })));

    await press(page, '#btnPause');
    await page.waitForTimeout(300);
    var fits = await page.evaluate(function () {
      var p = document.querySelector('#overlayPause .panel');
      return p.scrollHeight <= p.clientHeight + 2;
    });
    check('the pause menu fits without scrolling', fits);

    await page.click('#btnWipe');
    await page.waitForTimeout(250);
    var reachable = await page.evaluate(function () {
      var yes = document.getElementById('btnWipeYes').getBoundingClientRect();
      var panel = document.querySelector('#overlayPause .panel');
      var pr = panel.getBoundingClientRect();
      return {
        inViewport: yes.top >= 0 && yes.bottom <= window.innerHeight,
        insidePanel: yes.top >= pr.top - 1 && yes.bottom <= pr.bottom + 1,
        scrolls: panel.scrollHeight > panel.clientHeight + 2,
        tall: Math.round(yes.height)
      };
    });
    check('"yes, start again" is on screen without scrolling',
      reachable.inViewport && reachable.insidePanel && !reachable.scrolls, JSON.stringify(reachable));
    check('"yes, start again" is a usable size', reachable.tall >= 44, reachable.tall + 'px');

    await page.click('#btnWipeYes');
    await page.waitForTimeout(2200);
    var after = await page.evaluate(function () {
      return {
        save: localStorage.getItem('bobblesquad:v1'),
        ready: !!(window.BS && window.BS.ready),
        gadgets: window.BS && window.BS.gadgets,
        badges: window.BS && window.BS.stats.badges,
        colour: window.BS && window.BS.playerColour,
        mission: (window.BSMissions && window.BS && window.BS.ready)
          ? window.BSMissions.current().text : null,
        start: document.getElementById('overlayStart').classList.contains('show')
      };
    });
    check('the game restarted', after.ready === true);
    check('the save is gone', !after.save);
    check('gadgets are locked again',
      after.gadgets && !after.gadgets.sniffer && !after.gadgets.boots && !after.gadgets.mitt);
    check('badges are back to zero', after.badges === 0);
    check('hat colour is back to default', after.colour === 0);
    check('missions start from the beginning', /robots/.test(String(after.mission)), String(after.mission));
    check('the start screen is showing', after.start === true);

    var external = requests.filter(function (u) { return u.indexOf('http://127.0.0.1:' + PORT + '/') !== 0; });
    check('no request left the app', external.length === 0, external.join(', '));
    check('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    await ctx.close();
  }

  await browser.close();
  console.log('\n' + (count - failures.length) + '/' + count + ' checks passed');
  if (failures.length) {
    console.log('FAILED: ' + [].concat(failures).filter(function (v, i, a) {
      return a.indexOf(v) === i;
    }).join(', '));
    process.exit(1);
  }
}

main().catch(function (e) { console.error('harness failed:', e); process.exit(2); });
