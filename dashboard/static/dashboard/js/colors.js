// Data colours, shared by both pages. One blue hue, light -> dark = low -> high.
// (Validated with the dataviz palette checker: monotone lightness, single hue,
// the lightest step still visible on a light background.)

// Score classes for the ranking (0-100). `ink` = text colour on top of that colour.
export const SCORE_CLASSES = [
  { from: 75, to: 100, color: '#104281', ink: '#ffffff' },
  { from: 50, to: 75, color: '#256abf', ink: '#ffffff' },
  { from: 25, to: 50, color: '#5598e7', ink: '#0b0b0b' },
  { from: 0, to: 25, color: '#86b6ef', ink: '#0b0b0b' },
];
export const NO_SCORE = { color: '#898781', ink: '#ffffff' }; // every weight is 0

export function scoreClass(score) {
  if (score === null) return NO_SCORE;
  return SCORE_CLASSES.find((c) => score >= c.from);
}

// Continuous ramp for magnitudes (the benefit heatmap): steps 100 ... 700, without
// step 450 (#2a78d6), where neither dark nor white text reaches 4.5:1 contrast.
// With the ink rule below, every cell has at least 5.4:1.
const RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
  '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];

/** Colour for a value between 0 and 1, with a readable text colour on top. */
export function rampColor(fraction) {
  const i = Math.round(Math.min(Math.max(fraction, 0), 1) * (RAMP.length - 1));
  return { color: RAMP[i], ink: i <= 6 ? '#0b0b0b' : '#ffffff' };
}
