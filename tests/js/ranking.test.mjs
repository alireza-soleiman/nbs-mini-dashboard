// Tests for the ranking logic in dashboard/static/dashboard/js/ranking.js (Milestone 8).
//
//   node --test tests/js/
//
// node:test and node:assert are built into Node.js (22 or newer): nothing to install.
// The file ends in .mjs, so Node reads it as a JavaScript module (import/export).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CRITERIA, PRESETS, normalise, rankNbs } from '../../dashboard/static/dashboard/js/ranking.js';

// One NbS as the API sends it, with only the properties the ranking reads
const nbs = (id, name, cost, heat, flood, biodiversity, wellbeing) => ({
  id,
  properties: {
    name, cost_eur: cost, benefit_heat: heat, benefit_flood: flood,
    benefit_biodiversity: biodiversity, benefit_wellbeing: wellbeing,
  },
});
const weightsOf = (key) => PRESETS.find((p) => p.key === key).weights;
const criterion = (key) => CRITERIA.find((c) => c.key === key);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('a benefit is divided by 5; cost goes from cheapest = 1 to most expensive = 0', () => {
  const range = { min: 1000, max: 3000 };
  assert.equal(normalise({ benefit_heat: 4 }, criterion('benefit_heat'), range), 0.8);
  assert.equal(normalise({ cost_eur: 1000 }, criterion('cost_eur'), range), 1);
  assert.equal(normalise({ cost_eur: 2000 }, criterion('cost_eur'), range), 0.5);
  assert.equal(normalise({ cost_eur: 3000 }, criterion('cost_eur'), range), 0);
});

test('when all shown NbS cost the same, nobody loses points for cost', () => {
  assert.equal(normalise({ cost_eur: 500 }, criterion('cost_eur'), { min: 500, max: 500 }), 1);
});

test('a hand-calculated example with balanced weights', () => {
  // C costs 2000 between 1000 and 3000 -> cost value 0.5.
  // Benefits 3, 4, 2, 1 -> 0.6, 0.8, 0.4, 0.2.
  // Balanced = all weights equal -> score = average of the five values x 100
  //   = (0.6 + 0.8 + 0.4 + 0.2 + 0.5) / 5 x 100 = 50
  const rows = rankNbs([
    nbs(1, 'A', 1000, 0, 0, 0, 0),
    nbs(2, 'B', 3000, 0, 0, 0, 0),
    nbs(3, 'C', 2000, 3, 4, 2, 1),
  ], weightsOf('balanced'));
  const c = rows.find((row) => row.feature.id === 3);
  close(c.score, 50);
  assert.equal(c.rank, 1);
});

test('the points per criterion add up to the score', () => {
  const rows = rankNbs([
    nbs(1, 'A', 1000, 5, 1, 3, 2),
    nbs(2, 'B', 4000, 2, 5, 1, 4),
  ], weightsOf('heat'));
  for (const row of rows) {
    close(Object.values(row.parts).reduce((a, b) => a + b, 0), row.score);
  }
});

test('weights change the order: Flood puts the flood NbS first, Heat the heat NbS', () => {
  const both = [nbs(1, 'Pond', 2000, 1, 5, 3, 2), nbs(2, 'Trees', 2000, 5, 1, 2, 4)];
  assert.equal(rankNbs(both, weightsOf('flood'))[0].feature.properties.name, 'Pond');
  assert.equal(rankNbs(both, weightsOf('heat'))[0].feature.properties.name, 'Trees');
});

test('all weights 0: no scores, and the list is in alphabetical order', () => {
  const zero = Object.fromEntries(CRITERIA.map((c) => [c.key, 0]));
  const rows = rankNbs([nbs(1, 'Zeta', 10, 5, 5, 5, 5), nbs(2, 'Alpha', 20, 0, 0, 0, 0)], zero);
  assert.deepEqual(rows.map((r) => r.score), [null, null]);
  assert.deepEqual(rows.map((r) => r.feature.properties.name), ['Alpha', 'Zeta']);
});

test('equal scores are sorted by name, so the list never jumps around', () => {
  const rows = rankNbs([nbs(1, 'Beta', 1000, 3, 3, 3, 3), nbs(2, 'Alpha', 1000, 3, 3, 3, 3)],
    weightsOf('balanced'));
  assert.deepEqual(rows.map((r) => [r.rank, r.feature.properties.name]), [[1, 'Alpha'], [2, 'Beta']]);
});

test('a filter changes the cost part: cost is compared only among the shown NbS', () => {
  // Documented behaviour (ranking.js): the same NbS can get a different score after
  // a filter, because the cheapest and most expensive shown NbS change.
  const cheap = nbs(1, 'Cheap', 1000, 2, 2, 2, 2);
  const mid = nbs(2, 'Mid', 2000, 2, 2, 2, 2);
  const dear = nbs(3, 'Dear', 3000, 2, 2, 2, 2);
  const all = rankNbs([cheap, mid, dear], weightsOf('budget')).find((r) => r.feature.id === 2);
  const withoutCheap = rankNbs([mid, dear], weightsOf('budget')).find((r) => r.feature.id === 2);
  assert.ok(withoutCheap.score > all.score);
});
