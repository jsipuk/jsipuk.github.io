import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Surface, TILE, buildRiverside, isBlocked, surfaceAt } from '../src/rules/map.ts';
import { nextWaypoint, roadDistance } from '../src/rules/route.ts';
import { boxOutline } from '../src/rules/math.ts';
import { VAN, walkerFits } from '../src/rules/vehicle.ts';

const map = buildRiverside();
const fixture = JSON.parse(readFileSync(new URL('../fixtures/riverside-first-job.json', import.meta.url), 'utf8'));
const shut = new Set<string>();
const open = new Set(['yard_shutter_open']);

test('every fixture node exists and sits on a road', () => {
  for (const id of Object.keys(fixture.nodes)) {
    const p = map.nodes[id];
    assert.ok(p, `missing node ${id}`);
    assert.equal(surfaceAt(map, p.x, p.y), Surface.Road, id);
  }
});

test('both destinations are reachable by the ring road with the shutter shut', () => {
  for (const who of ['mo_vale', 'nell_price'] as const) {
    const d = roadDistance(map, map.nodes.depot, map.people[who], shut);
    assert.ok(Number.isFinite(d), `${who} unreachable`);
  }
});

test('the yard is a real shortcut, and only once the shutter is open', () => {
  const ring = roadDistance(map, map.nodes.ticket_office, map.nodes.merge, shut);
  const yard = roadDistance(map, map.nodes.ticket_office, map.nodes.merge, open);
  assert.ok(yard < ring * 0.5, `yard ${yard.toFixed(0)} vs ring ${ring.toFixed(0)}`);
  // With the shutter shut the arrow from the ticket office heads east along Station Road, not into the yard.
  const wp = nextWaypoint(map, map.nodes.ticket_office, map.nodes.merge, shut);
  assert.ok(wp.x > map.nodes.ticket_office.x + 100);
});

test('a closed shutter blocks the yard gate; an open one does not', () => {
  const gate = { x: 22.5 * TILE, y: 26.5 * TILE };
  assert.equal(isBlocked(map, gate, false), true);
  assert.equal(isBlocked(map, gate, true), false);
});

test('the yard is fenced: no way into it from Station Road except the gate', () => {
  for (let x = 18 * TILE; x < 39 * TILE; x += 8) {
    const y = 26.5 * TILE;
    const insideGate = x >= 20 * TILE && x < 25 * TILE;
    if (!insideGate) assert.equal(isBlocked(map, { x, y }, true), true, `gap in the fence at x=${x}`);
  }
});

test('the footpath lets a walker through between the bollards but not a van', () => {
  assert.ok(walkerFits({ x: 743, y: 360 }, (p) => isBlocked(map, p)), 'walker fits beside a bollard');
  const vanFits = [745, 760, 776].some((x) =>
    boxOutline(x, 384, Math.PI / 2, VAN.halfLength, VAN.halfWidth).every((p) => !isBlocked(map, p)) &&
    boxOutline(x, 360, Math.PI / 2, VAN.halfLength, VAN.halfWidth).every((p) => !isBlocked(map, p)),
  );
  assert.equal(vanFits, false);
});

test('from anywhere on the roads the job arrow never points through a building', () => {
  const crosses = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
    for (let i = 0; i <= steps; i++) {
      const s = surfaceAt(map, a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
      if (s === Surface.Building || s === Surface.Void || s === Surface.Fence || s === Surface.Water) return true;
    }
    return false;
  };
  let checked = 0;
  for (let y = 0; y < map.h * TILE; y += 12) {
    for (let x = 0; x < map.w * TILE; x += 12) {
      if (surfaceAt(map, x, y) !== Surface.Road) continue;
      for (const gatesNow of [shut, open]) {
        if (isBlocked(map, { x, y }, gatesNow.size > 0)) continue; // Under the closed shutter.
        for (const target of [map.nodes.quay, map.nodes.market, map.nodes.depot]) {
          const wp = nextWaypoint(map, { x, y }, target, gatesNow);
          if (wp === target) continue; // Same road: final approach.
          assert.ok(!crosses({ x, y }, wp), `from ${x},${y} the arrow crosses a building`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 2000, `${checked}`);
});
