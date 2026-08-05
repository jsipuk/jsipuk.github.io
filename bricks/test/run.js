/* Dependency-free checks for the Brick Lab system.
   Run with:  node bricks/test/run.js

   Covers the parts that would be silently wrong rather than loudly broken:
   the part catalogue's shape, collision and support maths, the share format's
   round trip and its tolerance of rubbish, the generator's promise that it
   only ever produces buildable models, and the compiler's promise that no step
   places a part before whatever holds it up. */

const fs = require('fs');
const path = require('path');

const sys = fs.readFileSync(path.join(__dirname, '..', 'system', 'system.js'), 'utf8');
const stp = fs.readFileSync(path.join(__dirname, '..', 'system', 'steps.js'), 'utf8');

const S = new Function(sys + '\n' + stp + '\n;return {' +
  'COLOURS, COLOUR, PARTS, PART, PLATE_U, STUD_MM, PLATE_MM, BRICK_PLATES,' +
  'place, footprint, topOf, cellsOf, occupancy, collides, overlapsXZ,' +
  'supportersOf, floatingParts, boundsOf, bom, validate, newModel,' +
  'rotateParts, encode, decode, rngFrom, generate, hasStuds, shortName, Steps };')();

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) pass++;
  else { fail++; console.error('  ✗ ' + msg); }
};
const group = (name) => console.log('\n' + name);

/* ── Units ───────────────────────────────────────────────────────────────── */
group('Units');
ok(S.PLATE_U === 0.4, 'a plate is 0.4 of a stud width');
ok(Math.abs(S.PLATE_MM * S.BRICK_PLATES - 9.6) < 1e-9, 'a brick is three plates, 9.6mm');

/* ── Catalogue ───────────────────────────────────────────────────────────── */
group('Part catalogue');
const ids = new Set();
S.PARTS.forEach((p) => {
  ok(!ids.has(p.id), 'unique part id: ' + p.id);
  ids.add(p.id);
  ok(p.w >= 1 && p.d >= 1 && p.h >= 1, p.id + ' has a real size');
  ok(['brick', 'plate', 'tile', 'slope', 'round'].includes(p.kind), p.id + ' has a known kind');
  ok(typeof p.name === 'string' && p.name.length > 2, p.id + ' has a name');
  if (p.kind === 'brick' || p.kind === 'slope') ok(p.h === 3, p.id + ' is a brick height');
  if (p.kind === 'plate' || p.kind === 'tile') ok(p.h === 1, p.id + ' is a plate height');
  if (p.kind === 'slope') ok(p.flat >= 1 && p.flat < p.w, p.id + ' has a sane flat top');
});
ok(S.PARTS.length >= 24, 'enough parts to build something worth building');
ok(S.hasStuds('b2x4') && !S.hasStuds('t2x2'), 'tiles are the only thing with no studs on top');
ok(S.shortName('b2x4') === '2×4', 'a plain brick shortens to just its size');
ok(S.shortName('p2x4') === '2×4 plate', 'anything that is not a brick says what it is');
ok(S.shortName('t1x2') === '1×2 tile' && S.shortName('s2x1') === '2×1 slope', 'tiles and slopes too');
ok(S.shortName('nope') === 'nope', 'an unknown part shortens to itself rather than crashing');

/* Names match dimensions, or the bill of materials lies to the reader. */
S.PARTS.forEach((p) => {
  const m = p.name.match(/(\d+)×(\d+)/);
  if (m) ok(Number(m[1]) === p.w && Number(m[2]) === p.d, p.id + ' name matches its footprint');
});

/* ── Colours ─────────────────────────────────────────────────────────────── */
group('Colours');
const cids = new Set();
S.COLOURS.forEach((c) => {
  ok(!cids.has(c.id), 'unique colour id: ' + c.id);
  cids.add(c.id);
  ok(/^#[0-9a-f]{6}$/.test(c.hex), c.id + ' has a six-digit hex');
});
ok(S.COLOURS.length >= 12, 'a usable palette');

/* ── Footprints and rotation ─────────────────────────────────────────────── */
group('Footprints');
ok(S.footprint('b2x4', 0).w === 2 && S.footprint('b2x4', 0).d === 4, '2×4 unrotated');
ok(S.footprint('b2x4', 1).w === 4 && S.footprint('b2x4', 1).d === 2, '2×4 quarter turned swaps');
ok(S.footprint('b2x4', 2).w === 2 && S.footprint('b2x4', 2).d === 4, 'half turn is the same footprint');
ok(S.cellsOf(S.place('b2x4', 'red', 0, 0, 0, 0)).length === 24, 'a 2×4 brick fills 24 plate cells');
ok(S.cellsOf(S.place('p2x4', 'red', 0, 0, 0, 0)).length === 8, 'a 2×4 plate fills 8');
ok(S.topOf(S.place('b1x1', 'red', 0, 0, 0, 0)) === 3, 'a brick offers a surface 3 plates up');
ok(S.topOf(S.place('p1x1', 'red', 0, 4, 0, 0)) === 5, 'a plate at 4 tops out at 5');

/* ── Collision ───────────────────────────────────────────────────────────── */
group('Collision');
const twoBricks = [S.place('b2x4', 'red', 0, 0, 0, 0)];
ok(S.collides(twoBricks, S.place('b1x1', 'blue', 0, 0, 0, 0), -1), 'a brick inside a brick collides');
ok(S.collides(twoBricks, S.place('b1x1', 'blue', 1, 2, 3, 0), -1), 'the top plate of a brick is still solid');
ok(!S.collides(twoBricks, S.place('b1x1', 'blue', 0, 3, 0, 0), -1), 'stacking directly on top is clear');
ok(!S.collides(twoBricks, S.place('b1x1', 'blue', 2, 0, 0, 0), -1), 'sitting alongside is clear');
ok(!S.collides(twoBricks, S.place('b2x4', 'blue', 0, 0, 0, 0), 0), 'a part never collides with itself');

/* ── Support ─────────────────────────────────────────────────────────────── */
group('Support and stability');
const stack = [
  S.place('b2x4', 'red', 0, 0, 0, 0),
  S.place('b2x4', 'blue', 0, 3, 0, 0),
  S.place('p1x2', 'white', 0, 6, 0, 0),
];
ok(S.supportersOf(stack, 1).includes(0), 'the second brick rests on the first');
ok(S.supportersOf(stack, 2).includes(1), 'the plate rests on the second brick');
ok(S.floatingParts(stack).length === 0, 'a clean stack has nothing floating');

const gap = [S.place('b2x4', 'red', 0, 0, 0, 0), S.place('b1x1', 'blue', 0, 9, 0, 0)];
ok(S.floatingParts(gap).length === 1, 'a brick hovering above a gap is caught');

const sideways = [S.place('b2x4', 'red', 0, 0, 0, 0), S.place('b1x1', 'blue', 9, 3, 9, 0)];
ok(S.floatingParts(sideways).length === 1, 'a brick at the right height but nowhere near is caught');

const onTile = [S.place('t2x2', 'red', 0, 0, 0, 0), S.place('b1x1', 'blue', 0, 1, 0, 0)];
ok(S.floatingParts(onTile).length === 1, 'nothing clips onto a smooth tile');

const chain = [
  S.place('b1x2', 'red', 0, 0, 0, 0),
  S.place('b1x2', 'blue', 0, 3, 1, 0),      /* overhangs, still held */
  S.place('b1x2', 'white', 0, 6, 2, 0),
];
ok(S.floatingParts(chain).length === 0, 'support carries along a chain of overhangs');

/* ── Bounds ──────────────────────────────────────────────────────────────── */
group('Bounds');
const b = S.boundsOf(stack);
ok(b.x0 === 0 && b.x1 === 2, 'bounds span the footprint width');
ok(b.z0 === 0 && b.z1 === 4, 'bounds span the footprint depth');
ok(b.y0 === 0 && b.y1 === 7, 'bounds run to the top of the tallest part');
ok(S.boundsOf([]).x1 === 0, 'an empty model has empty bounds rather than infinities');

/* ── Rotation of a whole model ───────────────────────────────────────────── */
group('Model rotation');
const L = [S.place('b1x4', 'red', 0, 0, 0, 0), S.place('b1x1', 'blue', 0, 3, 0, 0)];
const r4 = S.rotateParts(S.rotateParts(S.rotateParts(S.rotateParts(L, 1), 1), 1), 1);
ok(JSON.stringify(r4) === JSON.stringify(L), 'four quarter turns return the original');
const r1 = S.rotateParts(L, 1);
const rb = S.boundsOf(r1);
ok(rb.x1 - rb.x0 === 4 && rb.z1 - rb.z0 === 1, 'a quarter turn swaps the bounding box');
ok(S.floatingParts(r1).length === 0, 'rotation preserves what rests on what');
ok(S.boundsOf(r1).x0 === 0 && S.boundsOf(r1).z0 === 0, 'rotation keeps the model in the positive quadrant');

/* ── Bill of materials ───────────────────────────────────────────────────── */
group('Bill of materials');
const list = S.bom([
  S.place('b2x4', 'red', 0, 0, 0, 0),
  S.place('b2x4', 'red', 2, 0, 0, 0),
  S.place('b1x1', 'blue', 0, 3, 0, 0),
]);
ok(list.length === 2, 'identical parts in the same colour merge into one line');
ok(list[0].n === 2 && list[0].part === 'b2x4', 'the commonest part leads');
ok(S.bom([S.place('b2x4', 'red', 0, 0, 0, 0), S.place('b2x4', 'blue', 2, 0, 0, 0)]).length === 2,
  'the same part in two colours stays two lines');

/* ── Share format ────────────────────────────────────────────────────────── */
group('Share format');
const m = S.newModel('Cottage');
m.parts = stack.slice();
const round = S.decode(S.encode(m));
ok(round.name === 'Cottage', 'the name survives the round trip');
ok(JSON.stringify(round.parts) === JSON.stringify(m.parts), 'every placement survives the round trip');
ok(S.decode('').parts.length === 0, 'an empty string decodes to an empty model');
ok(S.decode('total nonsense').parts.length === 0, 'rubbish decodes to an empty model');
ok(S.decode('1|X|nosuchpart,red,0,0,0,0').parts.length === 0, 'an unknown part is dropped');
ok(S.decode('1|X|b1x1,nosuchcolour,0,0,0,0').parts[0].c === 'lgrey', 'an unknown colour falls back');
ok(S.decode('1|X|b1x1,red,0,0,0').parts.length === 0, 'a short row is dropped');
ok(S.decode('1|X|b1x1,red,0,x,0,0').parts.length === 0, 'a non-numeric coordinate is dropped');
const piped = S.newModel('a|b;c');
piped.parts = [S.place('b1x1', 'red', 0, 0, 0, 0)];
ok(S.decode(S.encode(piped)).parts.length === 1, 'a name full of separators does not break the format');

/* ── Seeded randomness ───────────────────────────────────────────────────── */
group('Seeded randomness');
const ra = S.rngFrom(4821), rbb = S.rngFrom(4821), rc = S.rngFrom(4822);
const seqA = [ra(), ra(), ra()], seqB = [rbb(), rbb(), rbb()], seqC = [rc(), rc(), rc()];
ok(JSON.stringify(seqA) === JSON.stringify(seqB), 'the same seed gives the same sequence');
ok(JSON.stringify(seqA) !== JSON.stringify(seqC), 'a different seed gives a different sequence');
ok(seqA.every((n) => n >= 0 && n < 1), 'values land in [0,1)');

/* ── Generator ───────────────────────────────────────────────────────────── */
group('Generator');
const g1 = S.generate({ seed: 4821, count: 8 });
const g2 = S.generate({ seed: 4821, count: 8 });
ok(S.encode(g1) === S.encode(g2), 'a seed reproduces a model exactly');
ok(S.generate({ seed: 99, count: 8 }).parts.length > 0, 'the generator produces something');

let genChecked = 0;
for (let seed = 1; seed <= 60; seed++) {
  const g = S.generate({
    seed: seed,
    count: 9,
    parts: ['b1x1', 'b1x2', 'b2x2', 'b2x4', 'p2x4', 's2x1', 't1x2', 'r1x1'],
    colours: ['red', 'blue', 'yellow', 'white', 'green'],
  });
  const issues = S.validate(g.parts);
  ok(issues.length === 0, 'seed ' + seed + ' generates a buildable model' +
    (issues.length ? ' (' + issues[0].kind + ')' : ''));
  const gb = S.boundsOf(g.parts);
  ok(gb.x0 === 0 && gb.z0 === 0, 'seed ' + seed + ' is shifted to the corner');
  ok(g.parts.every((p) => p.y >= 0), 'seed ' + seed + ' puts nothing underground');
  genChecked++;
}
ok(genChecked === 60, 'the generator was checked across 60 seeds');
ok(S.generate({ count: 5, parts: ['nosuchpart'] }).parts.length === 0, 'an empty pool generates nothing');

/* ── Validation ──────────────────────────────────────────────────────────── */
group('Validation');
ok(S.validate([]).some((i) => i.kind === 'empty'), 'an empty model is reported as empty');
ok(S.validate(stack).length === 0, 'a good model has no issues');
ok(S.validate(gap).some((i) => i.kind === 'floating'), 'floating parts are reported');
const clash = [S.place('b2x4', 'red', 0, 0, 0, 0), S.place('b2x4', 'blue', 0, 0, 0, 0)];
const clashIssues = S.validate(clash).filter((i) => i.kind === 'collision');
ok(clashIssues.length === 1, 'a collision is reported once, not once per shared cell');
ok(S.validate([S.place('b1x1', 'red', 0, -1, 0, 0)]).some((i) => i.kind === 'underground'),
  'a part below the ground is reported');

/* ── The instruction compiler ────────────────────────────────────────────── */
group('Instruction compiler');
const bigModel = S.generate({
  seed: 7, count: 26,
  parts: ['b1x1', 'b1x2', 'b1x4', 'b2x2', 'b2x4', 'p2x4', 'p1x2', 's2x1'],
  colours: ['red', 'blue', 'yellow', 'white'],
});
const steps = S.Steps.compile(bigModel);

ok(steps.length > 0, 'a model compiles to at least one step');

const placed = new Set();
steps.forEach((s) => s.parts.forEach((i) => placed.add(i)));
ok(placed.size === bigModel.parts.length, 'every part is placed exactly once across the steps');

let stepCounted = 0;
steps.forEach((s) => { stepCounted += s.parts.length; });
ok(stepCounted === bigModel.parts.length, 'no part is placed twice');

ok(steps.every((s) => s.parts.length <= 4), 'no step exceeds the maximum parts');
ok(steps.every((s) => s.parts.every((i) => bigModel.parts[i].y >= s.y)), 'a step is labelled with its lowest part');
ok(steps.every((s, i) => s.n === i + 1), 'steps are numbered from one');

/* Merging is only safe while nothing in a step rests on anything else in the
   same step — otherwise the reader is handed parts in an order that cannot be
   built and has to work it out for themselves. */
ok(steps.every((s) => {
  const inStep = new Set(s.parts);
  return s.parts.every((i) => !S.supportersOf(bigModel.parts, i).some((j) => inStep.has(j)));
}), 'no step contains a part resting on another part from the same step');

/* Merging has to actually earn its keep on a tall, thin model — the case that
   motivated it, where every part sits at its own height. */
const spindly = S.newModel('spindly');
for (let i = 0; i < 12; i++) spindly.parts.push(S.place('b1x2', i % 2 ? 'red' : 'blue', 0, i * 3, 0, 0));
const spindlySteps = S.Steps.compile(spindly);
ok(spindlySteps.length === 12, 'a pure stack still needs one step per brick, because each rests on the last');

const sideBySide = S.newModel('row');
for (let i = 0; i < 12; i++) sideBySide.parts.push(S.place('b1x1', 'red', i * 2, 0, 0, 0));
ok(S.Steps.compile(sideBySide).length === 3, 'twelve independent bricks group into three steps of four');

const stairs = S.newModel('stairs');
for (let i = 0; i < 8; i++) stairs.parts.push(S.place('b1x1', 'red', i * 3, i, 0, 0));
const stairSteps = S.Steps.compile(stairs);
ok(stairSteps.length < 8, 'parts at different heights that do not touch merge into fewer steps ('
  + stairSteps.length + ')');
ok(stairSteps.every((s, i) => i === 0 || s.y >= stairSteps[i - 1].y), 'merged steps still work upwards');

/* The promise the whole compiler exists to keep. */
let orderOk = true;
steps.forEach((s, si) => {
  const before = S.Steps.builtBy(steps, si - 1);
  s.parts.forEach((i) => {
    const pl = bigModel.parts[i];
    if (pl.y === 0) return;
    const sup = S.supportersOf(bigModel.parts, i);
    if (!sup.some((j) => before.has(j))) orderOk = false;
  });
});
ok(orderOk, 'no step ever places a part before something that holds it up');

let heightsAscend = true;
for (let i = 1; i < steps.length; i++) if (steps[i].y < steps[i - 1].y) heightsAscend = false;
ok(heightsAscend, 'the build works upwards and never comes back down');

const s0 = steps[0];
ok(s0.bom.reduce((a, l) => a + l.n, 0) === s0.parts.length, 'a step callout accounts for all of its parts');
ok(steps.every((s) => s.bom.every((l) => S.PART[l.part] && S.COLOUR[l.c])), 'callouts reference real parts');

ok(S.Steps.builtBy(steps, steps.length - 1).size === bigModel.parts.length, 'the last step completes the model');
ok(S.Steps.builtBy(steps, -1).size === 0, 'nothing is built before the first step');
ok(S.Steps.addedBy(steps, 0).size === steps[0].parts.length, 'the first step adds its own parts');
ok(S.Steps.compile(S.newModel('empty')).length === 0, 'an empty model compiles to no steps');

const sum = S.Steps.summarise(bigModel, steps);
ok(sum.parts === bigModel.parts.length, 'the summary counts the parts');
ok(sum.steps === steps.length, 'the summary counts the steps');
ok(sum.layers > 0 && sum.colours > 0, 'the summary reports layers and colours');

/* A step should not be scattered across the model. */
let clustered = true;
steps.forEach((s) => {
  if (s.parts.length < 2) return;
  const xs = s.parts.map((i) => bigModel.parts[i].x);
  const zs = s.parts.map((i) => bigModel.parts[i].z);
  if (Math.max(...xs) - Math.min(...xs) > 14) clustered = false;
  if (Math.max(...zs) - Math.min(...zs) > 14) clustered = false;
});
ok(clustered, 'the parts in a step stay near each other');

/* Ordering must hold for every model the generator can produce, not one. */
let allOrdered = true;
for (let seed = 100; seed < 130; seed++) {
  const mm = S.generate({ seed: seed, count: 16, parts: ['b1x2', 'b2x2', 'b2x4', 'p1x4', 's2x2'] });
  const st = S.Steps.compile(mm);
  const total = st.reduce((a, s) => a + s.parts.length, 0);
  if (total !== mm.parts.length) allOrdered = false;
  st.forEach((s, si) => {
    const before = S.Steps.builtBy(st, si - 1);
    s.parts.forEach((i) => {
      if (mm.parts[i].y === 0) return;
      if (!S.supportersOf(mm.parts, i).some((j) => before.has(j))) allOrdered = false;
    });
  });
}
ok(allOrdered, 'the build order holds across 30 generated models');

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
