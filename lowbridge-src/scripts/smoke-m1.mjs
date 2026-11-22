// M1 smoke check in a real browser, using only the player's keyboard and the
// on-screen buttons. Each scenario runs in a fresh browser profile, so it
// starts from a new IndexedDB save.
//
//   npm run build && npm run preview      (in one terminal)
//   node scripts/smoke-m1.mjs [url]       (in another; needs Playwright + Chromium)
//
// Scenarios: ferry ending (then reload: welcome back), market ending, the crab
// and shutter (then reload: still open), the patrol (pause freezes it), a
// double-tapped handover, and storage failure (?failsave). State is read
// through window.lowbridge.snapshot(), which is read-only.

import { createRequire } from 'node:module';

const url = process.argv[2] ?? 'http://localhost:4173/lowbridge/';
const shots = process.env.SMOKE_SHOTS ?? '';
const only = process.env.SMOKE_ONLY?.split(',');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    console.error('Playwright is not available. Install it globally or set NODE_PATH to a folder that has it.');
    process.exit(2);
  }
}

const K = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', go: 'ShiftLeft', brake: 'Space' };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function player(page) {
  const held = new Set();
  const hold = async (want) => {
    for (const k of [...held]) if (!want.has(k)) {
      await page.keyboard.up(k);
      held.delete(k);
    }
    for (const k of want) if (!held.has(k)) {
      await page.keyboard.down(k);
      held.add(k);
    }
  };
  const snap = () => page.evaluate(() => window.lowbridge.snapshot());
  const dirKeys = (ang, threshold = 0.38) => {
    const want = new Set();
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    if (dx > threshold) want.add(K.right);
    if (dx < -threshold) want.add(K.left);
    if (dy > threshold) want.add(K.down);
    if (dy < -threshold) want.add(K.up);
    return want;
  };
  return {
    snap,
    hold,
    async press(key) {
      await hold(new Set());
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
    },
    async walkTo(target, done = () => false, maxMs = 40_000) {
      const t0 = Date.now();
      let last = null;
      let still = 0;
      let sidestep = 0;
      let side = 1;
      for (;;) {
        const s = await snap();
        if (done(s)) break;
        const d = Math.hypot(target.x - s.player.x, target.y - s.player.y);
        if (d < 4 || Date.now() - t0 > maxMs) break;
        let ang = Math.atan2(target.y - s.player.y, target.x - s.player.x);
        // Walked into something (a parked van): step round it, as a person would.
        still = last && Math.hypot(s.player.x - last.x, s.player.y - last.y) < 0.3 ? still + 1 : 0;
        last = s.player;
        if (still > 8) {
          sidestep = 20;
          side = -side;
          still = 0;
        }
        if (sidestep > 0) {
          sidestep--;
          ang += (side * Math.PI) / 2;
        }
        await hold(dirKeys(ang, 0.3));
        await page.waitForTimeout(25);
      }
      await hold(new Set());
    },
    /** Drive with steering C, following the job arrow (or the route to `toward`), until `arrived(snapshot)`. */
    async followArrow(arrived, maxMs = 120_000, toward = null) {
      const t0 = Date.now();
      let stuck = 0;
      let reversing = 0;
      for (;;) {
        const s = await snap();
        if (arrived(s) || Date.now() - t0 > maxMs) break;
        const v = s.vehicle;
        const aim = toward ? s.routes[toward] : s.arrow;
        if (!v || !aim || s.mode !== 'world') {
          await hold(new Set());
          await page.waitForTimeout(50);
          continue;
        }
        const ang = Math.atan2(aim.y - v.y, aim.x - v.x);
        const toArrow = Math.hypot(aim.x - v.x, aim.y - v.y);
        const turn = Math.abs(wrap(ang - v.heading));
        const limit = toArrow < 70 || turn > 0.5 ? 42 : 85;
        let want = dirKeys(ang);
        if (v.speed < limit) want.add(K.go);
        stuck = Math.abs(v.speed) < 3 && want.has(K.go) ? stuck + 1 : 0;
        if (stuck > 30) {
          reversing = 25;
          stuck = 0;
        }
        if (reversing > 0) {
          reversing--;
          want = new Set([K.brake]);
        }
        await hold(want);
        await page.waitForTimeout(20);
      }
      // Stop.
      for (let i = 0; i < 80; i++) {
        const s = await snap();
        if (!s.vehicle || Math.abs(s.vehicle.speed) < 1) break;
        await hold(s.vehicle.speed > 0 ? new Set([K.brake]) : new Set());
        await page.waitForTimeout(25);
      }
      await hold(new Set());
    },
  };
}

async function newPage(browser, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + query);
  await page.waitForFunction(() => window.lowbridge?.snapshot());
  await page.click('#resume-btn');
  return { ctx, page, errors, p: player(page) };
}

const MO = { x: 208, y: 41.6 };
const NELL = { x: 920, y: 43.2 };

async function answerAndBoard(p) {
  await p.walkTo({ x: 92, y: 566 }, (s) => s.action.kind === 'answer');
  await p.press('KeyE');
  let s = await p.snap();
  if (s.prompt?.kind !== 'line') throw new Error(`expected Mo's call, got ${JSON.stringify(s.prompt)}`);
  await p.press('KeyE'); // hang up
  s = await p.snap();
  if (!s.progress.cargo.includes('spare_battery')) throw new Error('no battery after answering');
  await p.walkTo({ x: 70, y: 664 }, (x) => x.action.kind === 'enter_van');
  await p.press('KeyE');
  s = await p.snap();
  if (s.locomotion !== 'van') throw new Error(`could not get in the van: player ${Math.round(s.player.x)},${Math.round(s.player.y)} action ${JSON.stringify(s.action)} mode ${s.mode}`);
}

async function deliver(page, p, who) {
  const at = who === 'mo_vale' ? MO : NELL;
  await p.followArrow((s) => s.vehicle && Math.hypot(s.vehicle.x - at.x, s.vehicle.y - (at.y + 60)) < 45, 120_000, who);
  await p.press('KeyE'); // get out
  let s = await p.snap();
  if (s.locomotion !== 'foot') throw new Error(`could not get out near ${who}: ${s.action.reason}`);
  await p.walkTo({ x: at.x, y: at.y + 20 }, (x) => x.action.kind === 'give');
  s = await p.snap();
  if (s.action.kind !== 'give') {
    throw new Error(`no handover next to ${who}: ${s.action.verb}; player ${Math.round(s.player.x)},${Math.round(s.player.y)} van ${Math.round(s.van.x)},${Math.round(s.van.y)} h ${s.van.heading.toFixed(2)}`);
  }
  await p.press('KeyE');
  await page.click('#prompt-choices button[data-choice="give"]');
  await page.waitForFunction(() => window.lowbridge.snapshot().prompt?.kind === 'result');
  return p.snap();
}

const scenarios = {
  async ferry(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await answerAndBoard(p);
    const s = await deliver(page, p, 'mo_vale');
    if (s.progress.recipient !== 'mo_vale' || s.progress.crews.ferry !== 1) throw new Error('wrong outcome');
    if (shots) await page.screenshot({ path: `${shots}/m1-ferry-result.png` });
    await page.click('#prompt-choices button[data-choice="park"]');
    await page.waitForSelector('#sheet:not([hidden])');
    const parked = await page.textContent('#sheet-eyebrow');
    await page.reload();
    await page.waitForFunction(() => window.lowbridge?.snapshot());
    const lede = await page.textContent('#sheet-lede');
    if (!/gave Mo the battery/.test(lede)) throw new Error(`no welcome back line: ${lede}`);
    if (shots) await page.screenshot({ path: `${shots}/m1-ferry-welcome-back.png` });
    await ctx.close();
    return `delivered to Mo at ${s.handoverAt.toFixed(0)} s; "${parked}" sheet; reload says “${lede.slice(0, 40)}…”; errors ${errors.length}`;
  },

  async market(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await answerAndBoard(p);
    const s = await deliver(page, p, 'nell_price');
    if (s.progress.recipient !== 'nell_price' || s.progress.crews.market !== 1 || s.progress.crews.ferry !== -1) throw new Error('wrong outcome');
    if (shots) await page.screenshot({ path: `${shots}/m1-market-result.png` });
    await page.click('#prompt-choices button[data-choice="next"]');
    await page.waitForFunction(() => window.lowbridge.snapshot().prompt?.kind === 'next_call');
    await p.press('KeyE');
    await ctx.close();
    return `delivered to Nell at ${s.handoverAt.toFixed(0)} s; next call shown; errors ${errors.length}`;
  },

  async crab(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await answerAndBoard(p);
    await p.followArrow((s) => s.vehicle && s.vehicle.x > 290 && s.vehicle.y < 500);
    await p.press('KeyE');
    await p.walkTo({ x: 300, y: 520 });
    await p.walkTo({ x: 314, y: 552 });
    await p.walkTo({ x: 326, y: 552 }, (s) => s.action.kind === 'inspect');
    await p.press('KeyE');
    await page.waitForSelector('#encounter:not([hidden])');
    if (shots) await page.screenshot({ path: `${shots}/m1-encounter.png` });
    await page.click('#enc-choices button[data-act="offer_washer"]');
    await page.waitForTimeout(150);
    let s = await p.snap();
    if (s.progress.encounter.turn !== 1) throw new Error('early washer did not cost a turn');
    await page.click('#enc-choices button[data-act="dim"]');
    await page.waitForTimeout(150);
    await page.click('#enc-choices button[data-act="offer_washer"]');
    await page.waitForSelector('#enc-choices button[data-act="continue"]:not([hidden])');
    await page.click('#enc-choices button[data-act="continue"]');
    await p.walkTo({ x: 314, y: 552 });
    await p.walkTo({ x: 314, y: 500 });
    await p.walkTo({ x: 352, y: 442 }, (x) => x.action.kind === 'lift');
    await p.press('KeyE');
    s = await p.snap();
    if (!s.progress.flags.includes('yard_shutter_open')) throw new Error('shutter did not open');
    await page.waitForTimeout(1300);
    if (shots) await page.screenshot({ path: `${shots}/m1-shutter-open.png` });
    await page.reload();
    await page.waitForFunction(() => window.lowbridge?.snapshot());
    s = await p.snap();
    const ok = s.progress.flags.includes('yard_shutter_open') && s.progress.roster.includes('clatterjack');
    if (!ok) throw new Error('shutter or recruit lost on reload');
    await ctx.close();
    return `recruited after one wasted turn, lifted the shutter; after reload: shutter open, Clatterjack in roster; errors ${errors.length}`;
  },

  async patrol(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await answerAndBoard(p);
    await p.followArrow((s) => s.vehicle && s.vehicle.x > 250 && s.vehicle.y < 500);
    await p.press('KeyE');
    let s = await p.snap();
    await p.walkTo({ x: s.express.x - 4, y: s.express.y - 18 }, (x) => x.action.kind === 'enter_express');
    await p.press('KeyE');
    s = await p.snap();
    if (!s.pursuit) throw new Error('no heat after taking the express car');
    await page.waitForTimeout(3500);
    const chip = await page.textContent('#heat');
    if (shots) await page.screenshot({ path: `${shots}/m1-patrol.png` });
    await p.press('Escape');
    const a = (await p.snap()).pursuit;
    await page.waitForTimeout(1500);
    const b = (await p.snap()).pursuit;
    if (a.x !== b.x || a.outOfSight !== b.outOfSight) throw new Error('pause did not freeze the chase');
    await page.click('#resume-btn');
    // Sit still: the patrol should box the car in and walk us back to the depot.
    await page.waitForFunction(() => window.lowbridge.snapshot().prompt?.kind === 'caught', null, { timeout: 40_000 });
    s = await p.snap();
    await p.press('KeyE');
    const back = await p.snap();
    if (!back.progress.cargo.includes('spare_battery')) throw new Error('battery lost on capture');
    await ctx.close();
    return `heat chip "${chip}"; pause froze the chase; caught and back at the depot on foot with the battery; errors ${errors.length}`;
  },

  async doubletap(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await answerAndBoard(p);
    await p.followArrow((s) => s.vehicle && Math.hypot(s.vehicle.x - MO.x, s.vehicle.y - (MO.y + 60)) < 45);
    await p.press('KeyE');
    await p.walkTo({ x: MO.x, y: MO.y + 20 }, (x) => x.action.kind === 'give');
    await p.press('KeyE');
    // Two taps in the same instant, as a fast finger would.
    await page.evaluate(() => {
      const b = document.querySelector('#prompt-choices button[data-choice="give"]');
      b.click();
      b.click();
    });
    await page.waitForTimeout(400);
    const s = await p.snap();
    if (s.progress.completed.length !== 1 || s.progress.crews.ferry !== 1) throw new Error('double tap paid twice');
    await ctx.close();
    return `one receipt, ferry trust +1; errors ${errors.length}`;
  },

  async interrupt(browser) {
    // A01: hold a key, lose focus, come back. Nothing may move until a fresh press.
    const { ctx, page, errors, p } = await newPage(browser);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const a = await p.snap();
    await page.click('#resume-btn');
    await page.waitForTimeout(600);
    const b = await p.snap();
    await page.keyboard.up('ArrowUp');
    const moved = Math.hypot(b.player.x - a.player.x, b.player.y - a.player.y);
    if (a.mode !== 'paused' || moved > 0.5) throw new Error(`moved ${moved.toFixed(1)} px after resume with the key still held`);
    await ctx.close();
    return `paused on blur; 0 px of movement after resume with the key held; errors ${errors.length}`;
  },

  async failsave(browser) {
    const { ctx, page, errors, p } = await newPage(browser, '?failsave=1');
    await p.walkTo({ x: 92, y: 566 }, (s) => s.action.kind === 'answer');
    await p.press('KeyE');
    await page.waitForSelector('#savebar:not([hidden])');
    const s = await p.snap();
    if (s.progress.story.stage !== 'offered') throw new Error('state changed without a save');
    if (shots) await page.screenshot({ path: `${shots}/m1-failsave.png` });
    await ctx.close();
    return `"Progress hasn’t saved" shown; nothing changed; errors ${errors.length}`;
  },
};

const browser = await chromium.launch();
let failed = 0;
for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !only.includes(name)) continue;
  const t0 = Date.now();
  try {
    console.log(`PASS ${name}: ${await fn(browser)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}: ${err.message}`);
  }
}
await browser.close();
console.log(failed ? `M1 smoke: ${failed} failed` : 'M1 smoke: pass');
process.exit(failed ? 1 : 0);
