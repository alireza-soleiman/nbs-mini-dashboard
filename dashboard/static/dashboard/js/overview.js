// The overview page: key figures and charts about the whole NbS catalogue.
//
// Where the data comes from:
//   /api/summary/  -> key figures, NbS per type, cost per municipality, benefit profile, shapes
//                     (all added up in the database with SQL GROUP BY)
//   /api/nbs/      -> one dot per NbS in the cost/benefit chart, and the top 5

import { getJSON } from './api.js';
import { rampColor, scoreClass } from './colors.js';
import { escapeHtml, euro, euroShort, formatArea, formatLength, formatScore, formatSize, number } from './format.js';
import { PRESETS, rankNbs } from './ranking.js';

const API = document.body.dataset;
const BENEFITS = [
  ['heat', 'Heat', 'benefit_heat'],
  ['flood', 'Flood', 'benefit_flood'],
  ['biodiversity', 'Biodiversity', 'benefit_biodiversity'],
  ['wellbeing', 'Wellbeing', 'benefit_wellbeing'],
];
const status = document.getElementById('status');
const tip = document.getElementById('tooltip');

async function init() {
  try {
    const [summary, nbs] = await Promise.all([getJSON(API.summaryUrl), getJSON(API.nbsUrl)]);
    drawKpis(summary.totals);
    barChart('chart-types', summary.by_type, {
      label: (t) => t.label, value: (t) => t.count, format: number.format,
      tooltip: (t) => `<strong>${escapeHtml(t.label)}</strong><br>${t.count} NbS · ${euro.format(t.cost_eur)}`,
    });
    barChart('chart-municipalities', summary.by_municipality, {
      label: (m) => m.name, value: (m) => m.cost_eur, format: euroShort.format,
      tooltip: (m) => `<strong>${escapeHtml(m.name)}</strong><br>${m.count} NbS · ${euro.format(m.cost_eur)}`,
    });
    const shapes = [
      { label: 'Areas (polygons)', count: summary.by_geometry.polygons, note: formatArea(summary.totals.polygon_area_m2) },
      { label: 'Lines', count: summary.by_geometry.lines, note: formatLength(summary.totals.line_length_m) },
      { label: 'Single sites (points)', count: summary.by_geometry.points, note: 'no size' },
    ];
    barChart('chart-shapes', shapes, {
      label: (s) => s.label, value: (s) => s.count, format: number.format,
      tooltip: (s) => `<strong>${s.label}</strong><br>${s.count} NbS · ${s.note}`,
    });
    heatmap(summary.by_type);
    scatter(nbs.features);
    topFive(nbs.features);
    status.hidden = true;
  } catch (error) {
    console.error(error);
    status.textContent = `Could not load the data: ${error.message}`;
    status.classList.add('error');
  }
}

// --- Key figures ------------------------------------------------------------------

function drawKpis(t) {
  const tiles = [
    [number.format(t.nbs), 'NbS in the catalogue'],
    [euroShort.format(t.cost_eur), 'total estimated cost'],
    [`${t.municipalities_with_nbs} <small>of ${t.municipalities}</small>`, 'municipalities with NbS'],
    [formatArea(t.polygon_area_m2), 'of green and blue areas'],
    [formatLength(t.line_length_m), 'of tree rows, facades and rivers'],
  ];
  document.getElementById('kpis').innerHTML = tiles.map(([value, label]) =>
    `<div class="kpi"><span class="kpi-value">${value}</span><span class="kpi-label">${label}</span></div>`).join('');
}

// --- Horizontal bars (one series, so one colour and no legend) --------------------

function barChart(id, rows, { label, value, format, tooltip }) {
  const container = document.getElementById(id);
  const max = Math.max(...rows.map(value), 1);
  container.innerHTML = rows.map((row, i) => `
    <div class="bar-row" data-i="${i}">
      <span class="bar-label">${escapeHtml(label(row))}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${((100 * value(row)) / max).toFixed(1)}%"></span></span>
      <span class="bar-value">${format(value(row))}</span>
    </div>`).join('');
  attachTooltip(container, '.bar-row', (node) => tooltip(rows[node.dataset.i]));
}

// --- Heatmap: average benefit per type (one hue, light -> dark = 0 -> 5) ------------

function heatmap(byType) {
  const container = document.getElementById('chart-heatmap');
  let html = '<span></span>' + BENEFITS.map(([, label]) => `<span class="hm-col">${label}</span>`).join('');
  byType.forEach((type, r) => {
    html += `<span class="hm-row">${escapeHtml(type.label)} <small>(${type.count})</small></span>`;
    for (const [key] of BENEFITS) {
      const { color, ink } = rampColor(type[key] / 5);
      html += `<span class="hm-cell" data-r="${r}" data-k="${key}"
        style="background:${color};color:${ink}">${type[key].toFixed(1)}</span>`;
    }
  });
  container.innerHTML = html;
  attachTooltip(container, '.hm-cell', (node) => {
    const type = byType[node.dataset.r];
    const [, label] = BENEFITS.find(([key]) => key === node.dataset.k);
    return `<strong>${escapeHtml(type.label)}</strong><br>${label}: ${type[node.dataset.k].toFixed(2)} / 5
      <br><span class="muted">average of ${type.count} NbS</span>`;
  });
}

// --- Scatter: cost (log scale) against average benefit -----------------------------

function scatter(features) {
  const container = document.getElementById('chart-scatter');
  const W = 680; const H = 320;
  const m = { left: 44, right: 16, top: 14, bottom: 42 };
  const xTicks = [25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6];
  const [x0, x1] = [Math.log10(20e3), Math.log10(2e6)];
  const X = (cost) => m.left + ((Math.log10(cost) - x0) / (x1 - x0)) * (W - m.left - m.right);
  const Y = (score) => H - m.bottom - (score / 5) * (H - m.top - m.bottom);
  const avg = (p) => BENEFITS.reduce((s, [, , key]) => s + p[key], 0) / BENEFITS.length;

  const grid = [0, 1, 2, 3, 4, 5].map((v) => `
    <line class="grid" x1="${m.left}" x2="${W - m.right}" y1="${Y(v)}" y2="${Y(v)}"/>
    <text class="tick" x="${m.left - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')
    + xTicks.map((v) => `
    <line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${m.top}" y2="${H - m.bottom}"/>
    <text class="tick" x="${X(v)}" y="${H - m.bottom + 16}" text-anchor="middle">${euroShort.format(v)}</text>`).join('');

  const dots = features.map((f, i) => {
    const p = f.properties;
    const cx = X(p.cost_eur).toFixed(1); const cy = Y(avg(p)).toFixed(1);
    // a bigger invisible circle makes the dot easy to hover and click
    return `<g class="dot" data-i="${i}" tabindex="0" role="link" aria-label="${escapeHtml(p.name)}">
      <circle class="hit" cx="${cx}" cy="${cy}" r="12"/>
      <circle class="mark" cx="${cx}" cy="${cy}" r="6"/></g>`;
  }).join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Cost and average benefit of each NbS">
    ${grid}
    <text class="axis-title" x="${(W + m.left) / 2}" y="${H - 6}" text-anchor="middle">Estimated cost (log scale)</text>
    <text class="axis-title" x="12" y="${(H - m.bottom) / 2}" text-anchor="middle"
          transform="rotate(-90 12 ${(H - m.bottom) / 2})">Average benefit (0–5)</text>
    ${dots}</svg>`;

  attachTooltip(container, '.dot', (node) => {
    const p = features[node.dataset.i].properties;
    return `<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.nbs_type_label)} · ${formatSize(p)}
      <br>${euro.format(p.cost_eur)} · average benefit ${avg(p).toFixed(2)}
      <br><span class="muted">click to open on the map</span>`;
  });
  const open = (node) => { location.href = `${API.mapUrl}#nbs=${features[node.dataset.i].id}`; };
  container.addEventListener('click', (e) => { const n = e.target.closest('.dot'); if (n) open(n); });
  container.addEventListener('keydown', (e) => {
    const n = e.target.closest('.dot');
    if (n && e.key === 'Enter') open(n);
  });
}

// --- Top 5 with equal weights (the same ranking code as the map) ------------------

function topFive(features) {
  const rows = rankNbs(features, PRESETS[0].weights).slice(0, 5);
  document.getElementById('top-five').innerHTML = rows.map((row) => {
    const p = row.feature.properties;
    const { color, ink } = scoreClass(row.score);
    return `<li><a href="${API.mapUrl}#nbs=${row.feature.id}">
      <span class="rank-badge" style="background:${color};color:${ink}">${row.rank}</span>
      <span class="card-main"><span class="card-name">${escapeHtml(p.name)}</span>
        <span class="card-meta">${escapeHtml(p.nbs_type_label)} · ${euro.format(p.cost_eur)}</span></span>
      <span class="card-score">${formatScore(row.score)}</span></a></li>`;
  }).join('');
}

// --- Tooltip shared by all charts -------------------------------------------------

function attachTooltip(container, selector, html) {
  container.addEventListener('mousemove', (event) => {
    const node = event.target.closest(selector);
    if (!node) { tip.hidden = true; return; }
    tip.innerHTML = html(node);
    tip.hidden = false;
    const x = Math.min(event.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(event.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  });
  container.addEventListener('mouseleave', () => { tip.hidden = true; });
}

init();
