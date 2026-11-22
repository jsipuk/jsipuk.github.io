// Browser play-through, using only the player's keyboard and the on-screen
// buttons. Each scenario runs in a fresh browser profile, so it starts from a
// new IndexedDB save (some import a saved file first, through the menu).
//
//   npm run build && npm run preview      (in one terminal)
//   node scripts/smoke.mjs [url]          (in another; needs Playwright + Chromium)
//   SMOKE_ONLY=shift,offline node scripts/smoke.mjs
//
// M1: ferry ending (reload: welcome back), market ending, crab and shutter
// (reload: still open), patrol (pause freezes it), double tap, held key
// through blur, storage failure (?failsave).
// M2: the Mo branch from an imported M1 save to the shift close, Last post,
// export and import, and offline relaunch. State is read through the
// read-only window.lowbridge.snapshot().

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

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

const FIXTURE = readFileSync(new URL('../tests/fixtures/save-v1-mo.json', import.meta.url), 'utf8');

/** Import a save file through the pause menu, as a player would, then resume. */
async function importThroughMenu(page, text) {
  await page.keyboard.press('Escape');
  await page.waitForSelector('#sheet:not([hidden])');
  await page.click('#import-btn');
  await page.fill('#import-text', text);
  await page.click('#import-check');
  await page.waitForSelector('#import-confirm:not([hidden])');
  await Promise.all([page.waitForEvent('load'), page.click('#import-yes')]);
  await page.waitForFunction(() => window.lowbridge?.snapshot());
  await page.click('#resume-btn');
}

/** Answer whatever card is up, choosing by id where it matters. */
async function clickChoice(page, id) {
  await page.click(`#prompt-choices button[data-choice="${id}"]`);
  await page.waitForTimeout(150);
}

/** Walk or drive to the current step's pin, then stand where its button appears. */
async function goToPin(page, p, want = 'step') {
  for (let attempt = 0; attempt < 3; attempt++) {
    let s = await p.snap();
    const pin = s.pin;
    if (!pin) throw new Error('no pin');
    const from = s.vehicle ?? s.player;
    const stand = { x: pin.x, y: pin.y + (pin.y < 70 ? 18 : pin.y > 540 && pin.y < 600 && pin.x > 300 ? -14 : pin.y < 340 ? 22 : 0) };
    if (s.locomotion === 'foot' && Math.hypot(pin.x - from.x, pin.y - from.y) < 170) {
      await p.walkTo(stand, (x) => x.action.kind === want);
      s = await p.snap();
      if (s.action.kind === want) return;
    }
    if (s.locomotion === 'foot') {
      // Step up to whichever side of the van is nearest, as a person would.
      const h = s.van.heading;
      const sides = [
        { x: s.van.x - Math.sin(h) * 20, y: s.van.y + Math.cos(h) * 20 },
        { x: s.van.x + Math.sin(h) * 20, y: s.van.y - Math.cos(h) * 20 },
        { x: s.van.x - Math.cos(h) * 26, y: s.van.y - Math.sin(h) * 26 },
        { x: s.van.x + Math.cos(h) * 26, y: s.van.y + Math.sin(h) * 26 },
      ].sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y));
      for (const side of sides) {
        await p.walkTo(side, (x) => x.action.kind === 'enter_van', 12_000);
        if ((await p.snap()).action.kind === 'enter_van') break;
      }
      await p.press('KeyE');
      if ((await p.snap()).locomotion !== 'van') throw new Error('could not get back in the van');
    }
    await p.followArrow((x) => x.vehicle && x.pin && Math.hypot(x.vehicle.x - x.pin.x, x.vehicle.y - x.pin.y) < 75);
    await p.press('KeyE');
    await p.walkTo(stand, (x) => x.action.kind === want);
    s = await p.snap();
    if (s.action.kind === want) return;
  }
  const s = await p.snap();
  throw new Error(`could not reach the pin at ${JSON.stringify(s.pin)}: player ${Math.round(s.player.x)},${Math.round(s.player.y)} action ${s.action.verb}`);
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
    await page.waitForFunction(() => window.lowbridge.snapshot().prompt?.kind === 'line');
    const caller = (await p.snap()).prompt;
    await p.press('KeyE');
    const after = await p.snap();
    if (after.progress.shift.active?.beat !== 'Q02M') throw new Error('next call did not start Under the stalls');
    await ctx.close();
    return `delivered to Nell at ${s.handoverAt.toFixed(0)} s; took the next call (${caller.title ?? 'Nell'}), Q02M active; errors ${errors.length}`;
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

  async shift(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await importThroughMenu(page, FIXTURE);
    let s = await p.snap();
    if (s.progress.shift.lead !== 'Q02F') throw new Error(`imported save has lead ${s.progress.shift.lead}`);
    await page.keyboard.press('Escape');
    await page.click('#board-btn');
    await clickChoice(page, 'take');
    const log = [];
    for (let guard = 0; guard < 40; guard++) {
      s = await p.snap();
      if (s.progress.shift.complete) break;
      if (s.prompt) {
        const ids = s.prompt.choices.map((c) => c.id);
        if (s.prompt.kind === 'puzzle') {
          await clickChoice(page, 'sym:waves');
          await clickChoice(page, 'sym:three_rings');
        } else if (s.prompt.kind === 'cutscene') await clickChoice(page, 'log');
        else if (s.prompt.kind === 'close_choice') await clickChoice(page, 'first:mo_vale');
        else if (ids.includes('take')) await clickChoice(page, 'take');
        else await clickChoice(page, ids[0]);
        continue;
      }
      if (s.mode !== 'world') {
        await page.waitForTimeout(200);
        continue;
      }
      const beat = s.progress.shift.active?.beat;
      await goToPin(page, p);
      s = await p.snap();
      log.push(`${beat}:${s.action.verb}`);
      await p.press('KeyE');
      await page.waitForTimeout(250);
    }
    s = await p.snap();
    if (!s.progress.shift.complete) throw new Error(`shift not complete; stopped after ${log.join(' > ')}`);
    if (shots) await page.screenshot({ path: `${shots}/m2-shift-complete.png` });
    while ((await p.snap()).prompt) {
      const pr = (await p.snap()).prompt;
      await clickChoice(page, pr.choices.some((c) => c.id === 'park') ? 'park' : pr.choices[0].id);
    }
    await page.reload();
    await page.waitForFunction(() => window.lowbridge?.snapshot());
    const lede = await page.textContent('#sheet-lede');
    if (!/Shift one is done/.test(lede)) throw new Error(`no shift-complete line on return: ${lede}`);
    await ctx.close();
    return `${log.length} steps: ${log.join(' > ')}; reload says “${lede.slice(0, 48)}…”; errors ${errors.length}`;
  },

  async lastpost(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await importThroughMenu(page, FIXTURE);
    await page.keyboard.press('Escape');
    await page.click('#board-btn');
    await clickChoice(page, 'quick:last_post');
    await goToPin(page, p, 'quick');
    await p.press('KeyE'); // collect the mail
    let s = await p.snap();
    if (!s.progress.cargo.includes('mail')) throw new Error('no mail collected');
    await goToPin(page, p, 'quick');
    await p.press('KeyE'); // post it
    await page.waitForFunction(() => window.lowbridge.snapshot().prompt?.kind === 'quick_result');
    s = await p.snap();
    const best = s.progress.quick.bests.quiet;
    if (best === null) throw new Error('no quiet best recorded');
    if (s.progress.crews.ferry !== 1 || s.progress.crews.market !== -1) throw new Error('quick job changed trust');
    await ctx.close();
    return `Last post quiet best ${best.toFixed(1)} s of simulation; trust unchanged; errors ${errors.length}`;
  },

  async saves(browser) {
    const { ctx, page, errors, p } = await newPage(browser);
    await importThroughMenu(page, FIXTURE);
    const before = (await p.snap()).progress;
    await page.keyboard.press('Escape');
    await page.click('#export-btn');
    const text = await page.inputValue('#export-text');
    const file = JSON.parse(text);
    if (file.format !== 'lowbridge-save' || file.envelope.schemaVersion !== 2) throw new Error('bad export');
    await page.click('#import-btn');
    await page.fill('#import-text', '{"format":"lowbridge-save","envelope":{"schemaVersion":99}}');
    await page.click('#import-check');
    const newer = await page.textContent('#import-result');
    await page.fill('#import-text', 'definitely not a save');
    await page.click('#import-check');
    const junk = await page.textContent('#import-result');
    const after = (await p.snap()).progress;
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('a refused import changed the save');
    // Round trip into a fresh profile.
    const second = await newPage(browser);
    await importThroughMenu(second.page, text);
    const moved = (await second.p.snap()).progress;
    if (JSON.stringify(moved) !== JSON.stringify(before)) throw new Error('round trip changed the save');
    await second.ctx.close();
    await ctx.close();
    return `export is schema 2; newer refused (“${newer.slice(0, 40)}…”); junk refused (“${junk.slice(0, 32)}…”); round trip identical; errors ${errors.length}`;
  },

  async offline(browser) {
    const { ctx, page, errors } = await newPage(browser);
    page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.waitForFunction(() => window.lowbridge.saveStatus().offlineReady === true, null, { timeout: 20_000 });
    const label = await page.textContent('#offline-state');
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.lowbridge?.snapshot(), null, { timeout: 15_000 }).catch(() => {
      throw new Error(`offline reload did not boot: ${errors.join(' | ').slice(0, 400)}`);
    });
    const build = await page.evaluate(() => window.lowbridge.build);
    const caches = await page.evaluate(async () => (await window.caches.keys()).filter((k) => k.startsWith('lowbridge-')));
    await ctx.close();
    return `“${label}”; reloaded offline into ${build}; caches ${caches.join(', ')}; errors ${errors.length}`;
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
console.log(failed ? `Smoke: ${failed} failed` : 'Smoke: pass');
process.exit(failed ? 1 : 0);
