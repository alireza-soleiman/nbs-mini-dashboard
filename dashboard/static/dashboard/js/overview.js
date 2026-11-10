// The overview page: key figures and charts about the whole NbS catalogue.
//
// Where the data comes from:
//   /api/summary/  -> key figures, NbS per type, cost per municipality, benefit profile, shapes
//                     (all added up in the database with SQL GROUP BY)
//   /api/nbs/      -> one dot per NbS in the cost/benefit chart, and the top 5
//
// Team demo: every section has an "Other options" button. It opens a side panel that
// shows the same numbers in other chart forms (mockup-charts.js), marked as mockups.

import { getJSON } from './api.js';
import { rampColor, scoreClass } from './colors.js';
import { escapeHtml, euro, euroShort, formatArea, formatLength, formatScore, formatSize, number } from './format.js';
import { criteriaLegend, donut, dotTable, quadrant, radar, splitBar } from './mockup-charts.js';
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
const $ = (id) => document.getElementById(id);
const averageBenefit = (p) => BENEFITS.reduce((s, [, , key]) => s + p[key], 0) / BENEFITS.length;

let summary = null;   // the answer of /api/summary/
let features = [];    // the NbS of /api/nbs/

async function init() {
  setupOptionsPanel();
  try {
    const [summaryData, nbs] = await Promise.all([getJSON(API.summaryUrl), getJSON(API.nbsUrl)]);
    summary = summaryData;
    features = nbs.features;
    drawKpis(summary.totals);
    typeBars($('chart-types'));
    costBars($('chart-municipalities'));
    const shapes = [
      { label: 'Areas (polygons)', count: summary.by_geometry.polygons, note: formatArea(summary.totals.polygon_area_m2) },
      { label: 'Lines', count: summary.by_geometry.lines, note: formatLength(summary.totals.line_length_m) },
      { label: 'Single sites (points)', count: summary.by_geometry.points, note: 'no size' },
    ];
    barChart($('chart-shapes'), shapes, {
      label: (s) => s.label, value: (s) => s.count, format: number.format,
      tooltip: (s) => `<strong>${s.label}</strong><br>${s.count} NbS · ${s.note}`,
    });
    heatmap($('chart-heatmap'));
    scatter($('chart-scatter'));
    topFive($('top-five'));
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
  $('kpis').innerHTML = tiles.map(([value, label]) =>
    `<div class="kpi"><span class="kpi-value">${value}</span><span class="kpi-label">${label}</span></div>`).join('');
}

// --- Horizontal bars (one series, so one colour and no legend) --------------------

function barChart(container, rows, { label, value, format, tooltip }) {
  const max = Math.max(...rows.map(value), 1);
  container.classList.add('bars');
  container.innerHTML = rows.map((row, i) => `
    <div class="bar-row" data-i="${i}">
      <span class="bar-label">${escapeHtml(label(row))}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${((100 * value(row)) / max).toFixed(1)}%"></span></span>
      <span class="bar-value">${format(value(row))}</span>
    </div>`).join('');
  attachTooltip(container, '.bar-row', (node) => tooltip(rows[node.dataset.i]));
}

function typeBars(container) {
  barChart(container, summary.by_type, {
    label: (t) => t.label, value: (t) => t.count, format: number.format,
    tooltip: (t) => `<strong>${escapeHtml(t.label)}</strong><br>${t.count} NbS · ${euro.format(t.cost_eur)}`,
  });
}

function costBars(container) {
  barChart(container, summary.by_municipality, {
    label: (m) => m.name, value: (m) => m.cost_eur, format: euroShort.format,
    tooltip: (m) => `<strong>${escapeHtml(m.name)}</strong><br>${m.count} NbS · ${euro.format(m.cost_eur)}`,
  });
}

// --- Heatmap: average benefit per type (one hue, light -> dark = 0 -> 5) ------------

function heatmap(container) {
  const byType = summary.by_type;
  container.classList.add('heatmap');
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

function scatter(container) {
  const W = 680; const H = 320;
  const m = { left: 44, right: 16, top: 14, bottom: 42 };
  const xTicks = [25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6];
  const [x0, x1] = [Math.log10(20e3), Math.log10(2e6)];
  const X = (cost) => m.left + ((Math.log10(cost) - x0) / (x1 - x0)) * (W - m.left - m.right);
  const Y = (score) => H - m.bottom - (score / 5) * (H - m.top - m.bottom);

  const grid = [0, 1, 2, 3, 4, 5].map((v) => `
    <line class="grid" x1="${m.left}" x2="${W - m.right}" y1="${Y(v)}" y2="${Y(v)}"/>
    <text class="tick" x="${m.left - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')
    + xTicks.map((v) => `
    <line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${m.top}" y2="${H - m.bottom}"/>
    <text class="tick" x="${X(v)}" y="${H - m.bottom + 16}" text-anchor="middle">${euroShort.format(v)}</text>`).join('');

  const dots = features.map((f, i) => {
    const p = f.properties;
    const cx = X(p.cost_eur).toFixed(1); const cy = Y(averageBenefit(p)).toFixed(1);
    // a bigger invisible circle makes the dot easy to hover and click
    return `<g class="dot" data-i="${i}" tabindex="0" role="link" aria-label="${escapeHtml(p.name)}">
      <circle class="hit" cx="${cx}" cy="${cy}" r="12"/>
      <circle class="mark" cx="${cx}" cy="${cy}" r="6"/></g>`;
  }).join('');

  container.classList.add('scatter');
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
      <br>${euro.format(p.cost_eur)} · average benefit ${averageBenefit(p).toFixed(2)}
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

/** split = false: the list as it is today · true: with a bar that shows what the score is made of */
function topFive(container, { split = false } = {}) {
  const rows = rankNbs(features, PRESETS[0].weights).slice(0, 5);
  container.classList.add('top-list');
  container.innerHTML = rows.map((row) => {
    const p = row.feature.properties;
    const { color, ink } = scoreClass(row.score);
    const second = split ? splitBar(row)
      : `<span class="card-meta">${escapeHtml(p.nbs_type_label)} · ${euro.format(p.cost_eur)}</span>`;
    return `<li><a href="${API.mapUrl}#nbs=${row.feature.id}">
      <span class="rank-badge" style="background:${color};color:${ink}">${row.rank}</span>
      <span class="card-main"><span class="card-name">${escapeHtml(p.name)}</span>${second}</span>
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

// --- Team demo: "Other options" for each section -----------------------------------
// One entry per section: the question it answers and the ways to draw the answer.
// The first way is what the page shows today; the others are ideas (mockups).

const OPTIONS = {
  types: {
    title: 'NbS per type',
    question: 'Which types of NbS do we have?',
    ways: [
      { name: 'Sorted bars', note: 'Easy to compare, also with many types.', draw: typeBars },
      {
        name: 'Donut chart',
        note: 'Shows parts of a whole. With many slices of similar size it is hard to read.',
        draw: (box) => {
          box.innerHTML = donut(summary.by_type.map((t) => ({ label: t.label, value: t.count })),
            { format: number.format, max: 9, centre: `${summary.totals.nbs} NbS` });
        },
      },
    ],
  },
  cost: {
    title: 'Estimated cost',
    question: 'What does it cost, and where does the money go?',
    ways: [
      { name: 'Bars per municipality', note: 'Compares amounts between places.', draw: costBars },
      {
        name: 'Budget share per type (donut)',
        note: 'Shows which kind of NbS takes which part of the total budget.',
        draw: (box) => {
          box.innerHTML = donut(summary.by_type.map((t) => ({ label: t.label, value: t.cost_eur })),
            { format: euroShort.format, max: 5, centre: euroShort.format(summary.totals.cost_eur) });
        },
      },
    ],
  },
  benefits: {
    title: 'Benefit profile per type',
    question: 'What does each type of NbS bring?',
    ways: [
      { name: 'Coloured table', note: 'Exact numbers; darker = higher.', draw: heatmap },
      {
        name: 'Table with dots',
        note: 'Like a product rating: no numbers to read, quick to scan.',
        draw: (box) => {
          box.innerHTML = dotTable(
            summary.by_type.map((t) => ({ label: t.label, values: BENEFITS.map(([key]) => t[key]) })),
            BENEFITS.map(([, label]) => label));
        },
      },
      {
        name: 'Radar charts',
        note: 'One shape per type. Attractive and good for a first impression; exact values are hard to read.',
        draw: (box) => {
          const axes = BENEFITS.map(([, label]) => label);
          const small = (t) => radar(
            [{ label: t.label, color: 'var(--series)', values: BENEFITS.map(([key]) => t[key] / 5) }],
            axes, { size: 150, labels: false });
          box.innerHTML = `<div class="radar-grid">${summary.by_type.map((t) =>
            `<figure>${small(t)}<figcaption>${escapeHtml(t.label)}</figcaption></figure>`).join('')}</div>
            <p class="option-hint">Top = heat · right = flood · bottom = biodiversity · left = wellbeing</p>`;
        },
      },
    ],
  },
  value: {
    title: 'Cost and benefit',
    question: 'Where do we get the most for our money?',
    ways: [
      { name: 'Dot chart', note: 'Shows every NbS, but needs explaining (the cost axis is not linear).', draw: scatter },
      {
        name: '“Benefit per euro” bars',
        note: 'One number per NbS: average benefit for every €100,000. Best value at the top.',
        draw: (box) => {
          const rows = features.map((f) => ({
            name: f.properties.name,
            value: (averageBenefit(f.properties) / f.properties.cost_eur) * 100000,
            p: f.properties,
          })).sort((a, b) => b.value - a.value);
          barChart(box, rows, {
            label: (r) => r.name, value: (r) => r.value, format: (v) => v.toFixed(1),
            tooltip: (r) => `<strong>${escapeHtml(r.name)}</strong><br>${euro.format(r.p.cost_eur)}
              · average benefit ${averageBenefit(r.p).toFixed(2)}`,
          });
        },
      },
      {
        name: 'Four fields',
        note: 'No numbers on the axes: each NbS falls into one of four simple groups.',
        draw: (box) => {
          box.innerHTML = quadrant(features.map((f) => ({
            label: f.properties.code, name: f.properties.name,
            cost: f.properties.cost_eur, benefit: averageBenefit(f.properties),
          })));
        },
      },
    ],
  },
  top: {
    title: 'Top 5',
    question: 'Which NbS come first, and why?',
    ways: [
      {
        name: 'Ranked list',
        note: 'Rank, name and score.',
        draw: (box) => {
          box.innerHTML = '<ol></ol>';
          topFive(box.querySelector('ol'));
        },
      },
      {
        name: 'List with the score split by criterion',
        note: 'The bar shows what each criterion gave to the score, so the ranking explains itself.',
        draw: (box) => {
          box.innerHTML = `${criteriaLegend()}<ol></ol>`;
          topFive(box.querySelector('ol'), { split: true });
        },
      },
    ],
  },
};

function setupOptionsPanel() {
  const panel = $('options-panel');
  let opener = null; // the button that opened the panel: focus goes back to it

  const close = () => {
    panel.hidden = true;
    opener?.focus();
  };
  for (const button of document.querySelectorAll('.options-button')) {
    button.addEventListener('click', () => {
      if (!summary) return; // the data are still loading
      opener = button;
      const { title, question, ways } = OPTIONS[button.dataset.options];
      $('options-title').textContent = title;
      $('options-question').textContent = question;
      $('options-body').replaceChildren(...ways.map((way, i) => {
        const section = document.createElement('section');
        section.className = 'option';
        section.innerHTML = `<header>
            <span class="option-tag ${i === 0 ? 'is-current' : ''}">${i === 0 ? 'Shown today' : `Option ${i + 1}`}</span>
            <h3>${way.name}</h3><p>${way.note}</p></header>
          <div class="option-chart"></div>`;
        way.draw(section.querySelector('.option-chart'));
        return section;
      }));
      panel.hidden = false;
      $('options-body').scrollTop = 0;
      $('options-close').focus();
    });
  }
  $('options-close').addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });
}

init();
