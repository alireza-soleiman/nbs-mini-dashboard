// Chart ideas for the team demo ("Mockup – sample data"): other ways to show the same
// numbers. They draw the real sample data, but they are proposals, not decided features.
// Used by the overview's "Other options" panel, the Compare page and the map popup.
// Every function returns an HTML string (plain HTML and SVG, no chart library).

import { escapeHtml } from './format.js';
import { CRITERIA } from './ranking.js';

// Colours for things that are different KINDS (types, compared NbS), not amounts
export const CATEGORY_COLORS = ['#2a78d6', '#e08a00', '#2e9e6b', '#c0507a', '#7a5cc8',
  '#3bb0c4', '#b5562a', '#8a8d3a', '#7a7f87'];
// One fixed colour per criterion, so "orange = heat" everywhere
export const CRITERION_COLORS = {
  benefit_heat: '#e08a00',
  benefit_flood: '#2a78d6',
  benefit_biodiversity: '#2e9e6b',
  benefit_wellbeing: '#c0507a',
  cost_eur: '#7a7f87',
};

/**
 * Donut chart with a legend: shares of a whole.
 * items: [{label, value}] · format(value) -> text · slices after `max` become "Other".
 */
export function donut(items, { format, max = 6, centre = '' }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, max);
  const rest = sorted.slice(max);
  if (rest.length) shown.push({ label: `Other (${rest.length})`, value: rest.reduce((s, i) => s + i.value, 0) });
  const total = shown.reduce((s, i) => s + i.value, 0) || 1;

  // A circle with radius 15.915 has a circumference of 100, so a dash of length 30
  // is a 30 % slice. The offset turns each slice to where the one before ended.
  let done = 0;
  const slices = shown.map((item, i) => {
    const share = (100 * item.value) / total;
    const circle = `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}"
      stroke-width="7" stroke-dasharray="${share.toFixed(2)} ${(100 - share).toFixed(2)}"
      stroke-dashoffset="${(25 - done).toFixed(2)}"/>`;
    done += share;
    return circle;
  }).join('');
  const legend = shown.map((item, i) => `<li>
      <span class="swatch" style="background:${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}"></span>
      <span class="donut-label">${escapeHtml(item.label)}</span>
      <span class="donut-value">${format(item.value)} · ${Math.round((100 * item.value) / total)} %</span>
    </li>`).join('');
  return `<div class="donut">
    <svg viewBox="0 0 42 42" role="img" aria-label="Donut chart">${slices}
      <text x="21" y="22.5" text-anchor="middle" class="donut-centre">${centre}</text></svg>
    <ul class="donut-legend">${legend}</ul></div>`;
}

/**
 * Table with 1–5 dots: a rating that needs no numbers.
 * rows: [{label, values: [0–5, …]}] · columns: column titles
 */
export function dotTable(rows, columns) {
  const dots = (value) => {
    const full = Math.round(value);
    return `<span class="dots" title="${value.toFixed(1)} of 5" aria-label="${value.toFixed(1)} of 5">${
      [1, 2, 3, 4, 5].map((n) => `<i class="${n <= full ? 'on' : ''}"></i>`).join('')}</span>`;
  };
  return `<table class="dot-table"><thead><tr><th></th>${columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr><th>${escapeHtml(row.label)}</th>${
    row.values.map((v) => `<td>${dots(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/**
 * Radar ("spider") chart. axes: labels around the circle ·
 * series: [{label, color, values: [0–1 per axis]}] drawn on top of each other.
 */
export function radar(series, axes, { size = 260, labels = true } = {}) {
  const c = size / 2;
  const r = c - (labels ? 46 : 8);
  const point = (i, value) => {
    const angle = (2 * Math.PI * i) / axes.length - Math.PI / 2; // start at the top
    return [c + r * value * Math.cos(angle), c + r * value * Math.sin(angle)];
  };
  const ring = (value) => axes.map((_, i) => point(i, value).map((n) => n.toFixed(1)).join(',')).join(' ');
  const grid = [0.2, 0.4, 0.6, 0.8, 1].map((v) => `<polygon class="radar-ring" points="${ring(v)}"/>`).join('')
    + axes.map((_, i) => { const [x, y] = point(i, 1); return `<line class="radar-ring" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const names = !labels ? '' : axes.map((axis, i) => {
    const [x, y] = point(i, 1.16);
    const anchor = Math.abs(x - c) < 4 ? 'middle' : (x > c ? 'start' : 'end');
    return `<text class="radar-axis" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}">${axis}</text>`;
  }).join('');
  const shapes = series.map((s) => `<polygon points="${
    s.values.map((v, i) => point(i, v).map((n) => n.toFixed(1)).join(',')).join(' ')}"
    style="fill:${s.color};stroke:${s.color}" fill-opacity="0.16" stroke-width="2" stroke-linejoin="round">
    <title>${escapeHtml(s.label)}</title></polygon>`).join('');
  return `<svg class="radar" viewBox="0 0 ${size} ${size}" role="img"
    aria-label="Radar chart: ${escapeHtml(series.map((s) => s.label).join(', '))}">${grid}${shapes}${names}</svg>`;
}

/** One bar split by criterion: how a score (0–100) is made up. row: from rankNbs(). */
export function splitBar(row) {
  if (row.score === null) return '<div class="split"></div>';
  return `<div class="split" role="img" aria-label="Score ${Math.round(row.score)} of 100">${
    CRITERIA.map((c) => `<span style="width:${row.parts[c.key].toFixed(1)}%;background:${CRITERION_COLORS[c.key]}"
      title="${c.label}: ${row.parts[c.key].toFixed(1)} points"></span>`).join('')}</div>`;
}

/** The colour key for splitBar(). */
export function criteriaLegend() {
  return `<div class="legend criteria-legend">${CRITERIA.map((c) => `<span class="legend-item">
    <span class="swatch" style="background:${CRITERION_COLORS[c.key]}"></span>${c.label}</span>`).join('')}</div>`;
}

/**
 * Four fields: cheap or costly, small or large benefit. No numbers on the axes:
 * the dividing lines are the middle (median) cost and the middle benefit.
 * points: [{label, name, cost, benefit (0–5)}]
 */
export function quadrant(points) {
  const W = 520; const H = 330;
  const m = { left: 30, right: 12, top: 12, bottom: 30 };
  const median = (values) => { const s = [...values].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const logs = points.map((p) => Math.log10(p.cost));
  const [x0, x1] = [Math.min(...logs) - 0.15, Math.max(...logs) + 0.15];
  const X = (cost) => m.left + ((Math.log10(cost) - x0) / (x1 - x0)) * (W - m.left - m.right);
  const Y = (benefit) => H - m.bottom - ((benefit - 1) / 4) * (H - m.top - m.bottom); // 1–5 fills the height
  const mx = X(10 ** median(logs));
  const my = Y(median(points.map((p) => p.benefit)));
  const field = (x, y, w, h, cls, text, tx, ty, anchor) => `<rect class="quad-field ${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>
    <text class="quad-name" x="${tx}" y="${ty}" text-anchor="${anchor}">${text}</text>`;
  const right = W - m.right; const bottom = H - m.bottom;
  return `<svg class="quadrant" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cost and benefit in four fields">
    ${field(m.left, m.top, mx - m.left, my - m.top, 'good', 'Good value', m.left + 8, m.top + 16, 'start')}
    ${field(mx, m.top, right - mx, my - m.top, '', 'Big benefit, big cost', right - 8, m.top + 16, 'end')}
    ${field(m.left, my, mx - m.left, bottom - my, '', 'Small and cheap', m.left + 8, bottom - 8, 'start')}
    ${field(mx, my, right - mx, bottom - my, 'weak', 'Costly for its benefit', right - 8, bottom - 8, 'end')}
    <text class="quad-axis" x="${(W + m.left) / 2}" y="${H - 8}" text-anchor="middle">cheaper  ←  cost  →  more expensive</text>
    <text class="quad-axis" x="12" y="${bottom / 2}" text-anchor="middle" transform="rotate(-90 12 ${bottom / 2})">benefit  →  more</text>
    ${points.map((p) => `<g><title>${escapeHtml(p.name)}</title>
      <circle class="quad-dot" cx="${X(p.cost).toFixed(1)}" cy="${Y(p.benefit).toFixed(1)}" r="6"/>
      <text class="quad-label" x="${(X(p.cost) + 9).toFixed(1)}" y="${(Y(p.benefit) + 4).toFixed(1)}">${escapeHtml(p.label)}</text></g>`).join('')}
  </svg>`;
}
