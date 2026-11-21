// M0 smoke check in a real browser, using only the player's keyboard controls:
// a full lap with the wheel preset (walk, get in, drive, park, get out, answer),
// a short pad-preset drive, and a held key through a lost-focus interruption.
// SMOKE_LAPS=pad,wheel also tries a full keyboard lap with the pad preset.
//
//   npm run build && npm run preview      (in one terminal)
//   node scripts/smoke-m0.mjs [url]       (in another; needs Playwright + Chromium)
//
// It reads state through window.lowbridge.snapshot(), which is read-only.

import { createRequire } from 'node:module';

const url = process.argv[2] ?? 'http://localhost:4173/lowbridge/';
const shots = process.env.SMOKE_SHOTS ?? '';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    // A global install is found through NODE_PATH, which only require() honours.
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    console.error('Playwright is not available. Install it globally or set NODE_PATH to a folder that has it.');
    process.exit(2);
  }
}

const PATH = [
  { x: 104, y: 680 },
  { x: 132, y: 640 },
  { x: 132, y: 500 },
  { x: 180, y: 506 },
  { x: 540, y: 506 },
  { x: 572, y: 550 },
  { x: 572, y: 712 },
  { x: 530, y: 730 },
  { x: 160, y: 730 },
  { x: 130, y: 690 },
  { x: 128, y: 620 },
];
const BAY = { x: 128, y: 570 };
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', brake: 'Space' };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function pursuit(path, seg, from, ahead) {
  const proj = (a, b) => {
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    return ((from.x - a.x) * (b.x - a.x) + (from.y - a.y) * (b.y - a.y)) / len2;
  };
  let i = seg;
  while (i < path.length - 1 && proj(path[i], path[i + 1]) >= 1) i++;
  if (i >= path.length - 1) return { seg: i, target: path[path.length - 1] };
  const a = path[i];
  const b = path[i + 1];
  let remaining = ahead + Math.max(0, proj(a, b)) * Math.hypot(b.x - a.x, b.y - a.y);
  for (let j = i; j < path.length - 1; j++) {
    const p = path[j];
    const q = path[j + 1];
    const l = Math.hypot(q.x - p.x, q.y - p.y);
    if (remaining <= l) return { seg: i, target: { x: p.x + ((q.x - p.x) * remaining) / l, y: p.y + ((q.y - p.y) * remaining) / l } };
    remaining -= l;
  }
  return { seg: i, target: path[path.length - 1] };
}

async function lap(page, preset) {
  const held = new Set();
  const hold = async (want) => {
    for (const k of held) if (!want.has(k)) await page.keyboard.up(k);
    for (const k of want) if (!held.has(k)) await page.keyboard.down(k);
    held.clear();
    for (const k of want) held.add(k);
  };
  const snap = () => page.evaluate(() => window.lowbridge.snapshot());
  const walkTo = async (target, until) => {
    for (let i = 0; i < 400; i++) {
      const s = await snap();
      if (until(s)) break;
      const dx = target.x - s.player.x;
      const dy = target.y - s.player.y;
      const want = new Set();
      if (dx > 3) want.add(KEYS.right);
      if (dx < -3) want.add(KEYS.left);
      if (dy > 3) want.add(KEYS.down);
      if (dy < -3) want.add(KEYS.up);
      await hold(want);
      await page.waitForTimeout(30);
    }
    await hold(new Set());
  };

  await page.keyboard.press(preset === 'pad' ? 'Digit1' : 'Digit2');
  let s = await snap();
  await walkTo({ x: s.van.x + 8, y: s.van.y - 17 }, (x) => x.action.kind === 'enter');
  await page.keyboard.press('KeyE');
  const t0 = Date.now();

  // Follow the path with a 40 px look-ahead, then stop on the bay.
  const route = [...PATH, BAY];
  let seg = 0;
  let stuck = 0;
  let reversing = 0;
  for (let i = 0; i < 6000 && Date.now() - t0 < 120_000; i++) {
    s = await snap();
    if (s.run.parked) break;
    const v = s.van;
    if (process.env.SMOKE_TRACE && i % 25 === 0) {
      console.log(`  ${preset} seg ${seg} van ${Math.round(v.x)},${Math.round(v.y)} h ${Math.round((v.heading * 180) / Math.PI)} v ${Math.round(v.speed)}`);
    }
    const near = seg >= route.length - 3;
    const toBay = Math.hypot(BAY.x - v.x, BAY.y - v.y);
    const want = new Set();
    // Nosed into a wall: back out with Brake/Reverse, as a player would.
    stuck = Math.abs(v.speed) < 3 && !(near && v.y - BAY.y < 3) ? stuck + 1 : 0;
    if (stuck > 40) {
      reversing = 30;
      stuck = 0;
    }
    if (reversing > 0) {
      reversing--;
      want.add(KEYS.brake);
    } else if (near && v.y - BAY.y < 3) {
      if (v.speed > 0) want.add(KEYS.brake);
    } else {
      const next = pursuit(route, seg, v, near ? 24 : preset === 'pad' ? 60 : 40);
      seg = next.seg;
      // Slow down before each corner, as a driver would.
      const end = route[Math.min(seg + 1, route.length - 1)];
      const corner = Math.hypot(end.x - v.x, end.y - v.y) < 90;
      const limit = toBay < 60 ? 22 : near ? 40 : corner ? 38 : 95;
      const ang = Math.atan2(next.target.y - v.y, next.target.x - v.x);
      if (preset === 'pad') {
        if (v.speed < limit) {
          // Up to eight directions from the arrow keys.
          const dx = Math.cos(ang);
          const dy = Math.sin(ang);
          // Diagonals only for big corrections; they mean "turn 45°" to the pad.
          if (dx > 0.5) want.add(KEYS.right);
          if (dx < -0.5) want.add(KEYS.left);
          if (dy > 0.5) want.add(KEYS.down);
          if (dy < -0.5) want.add(KEYS.up);
        }
      } else {
        const diff = wrap(ang - v.heading);
        if (diff > 0.1) want.add(KEYS.right);
        if (diff < -0.1) want.add(KEYS.left);
        if (v.speed < (Math.abs(diff) > 0.6 ? Math.min(limit, 55) : limit)) want.add(KEYS.up);
      }
    }
    await hold(want);
    await page.waitForTimeout(16);
  }
  await hold(new Set());
  s = await snap();
  if (!s.run.parked) throw new Error(`${preset}: did not park (van ${Math.round(s.van.x)},${Math.round(s.van.y)})`);
  if (shots) await page.screenshot({ path: `${shots}/smoke-${preset}-parked.png` });

  await page.keyboard.press('KeyE'); // get out
  s = await snap();
  if (s.locomotion !== 'foot') throw new Error(`${preset}: could not get out (${s.action.reason ?? s.action.verb})`);
  await walkTo({ x: 100, y: 560 }, (x) => x.action.kind === 'answer');
  await page.keyboard.press('KeyE'); // answer
  s = await snap();
  if (s.mode !== 'dialogue') throw new Error(`${preset}: phone not answered`);
  if (shots) await page.screenshot({ path: `${shots}/smoke-${preset}-call.png` });
  await page.keyboard.press('KeyE'); // hang up
  const record = s.log.at(-1);
  return record;
}

// Pad preset, short check: drive north, let go and roll to a stop, pull back to
// reverse, reverse on the Brake button, get out.
// The 8-way keyboard pad weaves on long runs, so full pad laps are covered by
// `npm test` with analogue input instead.
async function padCheck(page) {
  const snap = () => page.evaluate(() => window.lowbridge.snapshot());
  await page.keyboard.press('Digit1');
  let s = await snap();
  for (let i = 0; i < 300 && s.action.kind !== 'enter'; i++) {
    const tx = s.van.x - 18;
    const ty = s.van.y;
    const keys = [];
    if (tx - s.player.x > 3) keys.push(KEYS.right);
    if (tx - s.player.x < -3) keys.push(KEYS.left);
    if (ty - s.player.y > 3) keys.push(KEYS.down);
    if (ty - s.player.y < -3) keys.push(KEYS.up);
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(40);
    for (const k of keys) await page.keyboard.up(k);
    s = await snap();
  }
  await page.keyboard.press('KeyE');
  s = await snap();
  if (s.locomotion !== 'van') throw new Error('pad check: could not get in');
  const start = s.van;
  await page.keyboard.down(KEYS.up);
  await page.waitForTimeout(900);
  await page.keyboard.up(KEYS.up);
  const moving = (await snap()).van;
  await page.waitForTimeout(1500);
  const rolled = (await snap()).van;
  // Pull the pad back (down, with the van facing north): it should reverse.
  await page.keyboard.down(KEYS.down);
  await page.waitForTimeout(700);
  const pulledBack = (await snap()).van;
  await page.keyboard.up(KEYS.down);
  await page.waitForTimeout(1200);
  await page.keyboard.down(KEYS.brake);
  await page.waitForTimeout(900);
  const reversing = (await snap()).van;
  await page.keyboard.up(KEYS.brake);
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE');
  const out = await snap();
  const checks = {
    'drove north': start.y - moving.y > 30,
    'let go and rolled to a stop': rolled.speed === 0,
    'pulled the pad back and reversed': pulledBack.speed < 0 && pulledBack.y > rolled.y,
    'reversed on Brake': reversing.speed < 0,
    'got out': out.locomotion === 'foot',
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`pad check failed: ${failed.join(', ')}`);
  console.log(`pad: drove ${Math.round(start.y - moving.y)} px north, rolled to a stop, pulled back to reverse ${Math.round(pulledBack.y - rolled.y)} px, reversed on Brake, got out`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.click('#resume-btn');
const results = [];
for (const preset of (process.env.SMOKE_LAPS ?? 'wheel').split(',')) {
  const r = await lap(page, preset);
  results.push(r);
  console.log(`${preset}: parked and answered · lap ${r.lapSeconds.toFixed(1)} s · ${r.bumps} bump(s) · logged as ${r.preset}`);
}
await padCheck(page);

// Interruption: hold the throttle, lose focus, come back. Nothing may move until a fresh press.
await page.keyboard.press('Digit2');
await page.keyboard.down('ArrowUp');
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
const s = await page.evaluate(() => window.lowbridge.snapshot());
const paused = s.mode;
await page.click('#resume-btn');
await page.waitForTimeout(600);
const after = await page.evaluate(() => window.lowbridge.snapshot());
await page.keyboard.up('ArrowUp');
const moved = Math.hypot(after.player.x - s.player.x, after.player.y - s.player.y);
console.log(`interruption: mode after blur = ${paused}; moved ${moved.toFixed(1)} px after resume with the key still held`);
if (paused !== 'paused' || moved > 0.5) throw new Error('held input survived an interruption');

if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
await browser.close();
console.log('M0 smoke: pass');
