import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildM0Map, Surface, surfaceAt, TILE } from '../src/rules/map.ts';
import { rectCentre } from '../src/rules/math.ts';
import { nextWaypoint } from '../src/rules/route.ts';

const map = buildM0Map();
const checkpoint = rectCentre(map.lapCheckpoint.rect);
const bay = rectCentre(map.bay.rect);

test('on Station Road the arrow points at the Ticket Street junction, not through the ticket office', () => {
  // Where the owner's van hit the ticket office wall (tile 23,34), driving east.
  assert.deepEqual(nextWaypoint(map, { x: 370, y: 500 }, checkpoint), { x: 34.5 * TILE, y: 30.5 * TILE });
});

test('on the same road as the target the arrow points straight at it', () => {
  assert.deepEqual(nextWaypoint(map, { x: 560, y: 690 }, checkpoint), checkpoint);
  assert.deepEqual(nextWaypoint(map, { x: 130, y: 640 }, bay), bay);
});

test('standing in a junction, the arrow moves on to the next leg', () => {
  const inJunction = { x: 34.5 * TILE, y: 30.5 * TILE };
  assert.deepEqual(nextWaypoint(map, inJunction, checkpoint), checkpoint);
});

test('from anywhere on the roads, the arrow line never crosses a building', () => {
  const crossesBuilding = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
    for (let i = 0; i <= steps; i++) {
      const s = surfaceAt(map, a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
      if (s === Surface.Building || s === Surface.Void) return true;
    }
    return false;
  };
  let checked = 0;
  for (let y = map.region.y; y < map.region.y + map.region.h; y += 8) {
    for (let x = map.region.x; x < map.region.x + map.region.w; x += 8) {
      if (surfaceAt(map, x, y) !== Surface.Road) continue;
      for (const target of [checkpoint, bay]) {
        const wp = nextWaypoint(map, { x, y }, target);
        assert.ok(!crossesBuilding({ x, y }, wp), `from ${x},${y} the arrow crosses a building`);
        checked++;
      }
    }
  }
  assert.ok(checked > 500);
});
