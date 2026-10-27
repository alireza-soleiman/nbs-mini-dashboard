// Multi-criteria ranking of NbS (weighted sum, also called Simple Additive Weighting).
//
// 1. Each criterion becomes a value from 0 (worst) to 1 (best):
//      benefit (0-5 score)  ->  score / 5
//      cost (EUR)           ->  cheapest shown NbS = 1, most expensive = 0
// 2. Each value is multiplied by the user's weight for that criterion.
// 3. score = sum(weight x value) / sum(weights) x 100   ->   0 ... 100
//
// The cost is compared only among the NbS that are currently shown (after filters),
// so changing a filter can change the cost part of the scores.

export const CRITERIA = [
  { key: 'benefit_heat', label: 'Heat reduction', kind: 'benefit' },
  { key: 'benefit_flood', label: 'Flood & stormwater', kind: 'benefit' },
  { key: 'benefit_biodiversity', label: 'Biodiversity', kind: 'benefit' },
  { key: 'benefit_wellbeing', label: 'Health & wellbeing', kind: 'benefit' },
  { key: 'cost_eur', label: 'Low cost', kind: 'cost' },
];

export const BENEFIT_MAX = 5;      // benefit scores go from 0 to 5
export const DEFAULT_WEIGHT = 5;   // sliders go from 0 to 10

/** Value from 0 (worst) to 1 (best) for one criterion of one NbS. */
export function normalise(properties, criterion, costRange) {
  const value = properties[criterion.key];
  if (criterion.kind === 'benefit') {
    return value / BENEFIT_MAX;
  }
  // Cost: lower is better. If all shown NbS cost the same, nobody is worse.
  const { min, max } = costRange;
  return max === min ? 1 : (max - value) / (max - min);
}

/**
 * Score and sort GeoJSON NbS features.
 * weights: {benefit_heat: 5, ..., cost_eur: 5}
 * Returns [{feature, score, rank, parts}] with the best first.
 *   score: 0-100, or null if every weight is 0
 *   parts: how many score points each criterion contributed (they add up to score)
 */
export function rankNbs(features, weights) {
  const totalWeight = CRITERIA.reduce((sum, c) => sum + weights[c.key], 0);
  const costs = features.map((f) => f.properties.cost_eur);
  const costRange = { min: Math.min(...costs), max: Math.max(...costs) };

  const rows = features.map((feature) => {
    if (totalWeight === 0) {
      return { feature, score: null, parts: {} };
    }
    const parts = {};
    for (const c of CRITERIA) {
      parts[c.key] = (100 * weights[c.key] * normalise(feature.properties, c, costRange)) / totalWeight;
    }
    const score = Object.values(parts).reduce((a, b) => a + b, 0);
    return { feature, score, parts };
  });

  // Best score first; equal scores in alphabetical order, so the list is stable
  rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)
    || a.feature.properties.name.localeCompare(b.feature.properties.name));
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
}
