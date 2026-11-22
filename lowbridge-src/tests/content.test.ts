import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Q01, TRUST_MAX, TRUST_MIN } from '../src/rules/content.ts';
import { initialProgress } from '../src/rules/progress.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/riverside-first-job.json', import.meta.url), 'utf8'));

test('Q01 ids and branches match the first-job fixture', () => {
  assert.equal(Q01.id, fixture.job.id);
  assert.equal(Q01.exclusiveOutcomeGroup, fixture.job.exclusiveOutcomeGroup);
  assert.equal(Q01.item, fixture.job.item);
  for (const b of fixture.job.branches) {
    const mine = Q01.branches[b.recipient as 'mo_vale' | 'nell_price'];
    assert.ok(mine, b.recipient);
    assert.equal(mine.location, b.location);
    assert.deepEqual(mine.trustDelta, b.trustDelta);
    assert.equal(mine.addsFlag, b.addsFlag);
    assert.equal(mine.nextJob, b.nextJob);
  }
});

test('a new save matches the fixture initial state', () => {
  const p = initialProgress();
  assert.deepEqual(p.team, fixture.initial.team);
  assert.deepEqual(p.roster, fixture.initial.roster);
  assert.deepEqual(p.crews, fixture.initial.trust);
  assert.deepEqual(p.flags, fixture.initial.flags);
  assert.deepEqual(p.cargo, fixture.initial.cargo);
  assert.equal(TRUST_MIN, -2);
  assert.equal(TRUST_MAX, 3);
});
