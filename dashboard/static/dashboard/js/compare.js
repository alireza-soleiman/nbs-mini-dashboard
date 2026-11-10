// Team demo: the Compare page ("Mockup – sample data"). Two or three NbS side by side,
// as a table with bars or as a radar chart. It reads the real sample data from
// /api/nbs/ and uses the ranking code of the map, but it is an idea, not a decision.

import { getJSON } from './api.js';
import { escapeHtml, euro, formatScore, formatSize } from './format.js';
import { CATEGORY_COLORS, radar } from './mockup-charts.js';
import { CRITERIA, PRESETS, normalise, rankNbs } from './ranking.js';

const API = document.body.dataset;
const $ = (id) => document.getElementById(id);
const SLOTS = 3;

const state = {
  rows: [],          // all NbS, ranked with balanced weights
  costRange: null,   // cheapest and most expensive NbS of the catalogue (for "Low cost")
  picked: [],        // NbS ids in the three slots (null = empty)
  view: 'table',
};

async function init() {
  try {
    const { features } = await getJSON(API.nbsUrl);
    state.rows = rankNbs(features, PRESETS[0].weights);
    const costs = features.map((f) => f.properties.cost_eur);
    state.costRange = { min: Math.min(...costs), max: Math.max(...costs) };
    // Start with the best NbS and the next best ones of OTHER types: a real contrast
    const types = new Set();
    state.picked = state.rows.filter((row) => !types.has(row.feature.properties.nbs_type)
      && types.add(row.feature.properties.nbs_type)).slice(0, SLOTS).map((row) => row.feature.id);
    buildControls();
    draw();
    $('status').hidden = true;
  } catch (error) {
    console.error(error);
    $('status').textContent = `Could not load the data: ${error.message}`;
    $('status').classList.add('error');
  }
}

function buildControls() {
  const byName = [...state.rows].sort((a, b) => a.feature.properties.name.localeCompare(b.feature.properties.name));
  $('picks').innerHTML = Array.from({ length: SLOTS }, (_, slot) => `
    <label class="compare-pick">
      <span class="field-label"><span class="swatch" style="background:${CATEGORY_COLORS[slot]}"></span> NbS ${slot + 1}</span>
      <select data-slot="${slot}">
        ${slot === SLOTS - 1 ? '<option value="">— none —</option>' : ''}
        ${byName.map((row) => `<option value="${row.feature.id}" ${row.feature.id === state.picked[slot] ? 'selected' : ''}>
          ${escapeHtml(row.feature.properties.name)}</option>`).join('')}
      </select>
    </label>`).join('');
  $('picks').addEventListener('change', (event) => {
    state.picked[event.target.dataset.slot] = Number(event.target.value) || null;
    draw();
  });

  for (const [key, label] of [['table', 'Table with bars'], ['radar', 'Radar chart']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(key === state.view));
    button.addEventListener('click', () => {
      state.view = key;
      for (const other of $('view').children) other.setAttribute('aria-pressed', String(other === button));
      draw();
    });
    $('view').append(button);
  }
}

/** The picked NbS with their slot colour (an NbS picked twice is shown once). */
function picked() {
  const seen = new Set();
  return state.picked
    .map((id, slot) => ({ row: state.rows.find((r) => r.feature.id === id), color: CATEGORY_COLORS[slot] }))
    .filter(({ row }) => row && !seen.has(row.feature.id) && seen.add(row.feature.id));
}

function draw() {
  const items = picked();
  $('comparison').innerHTML = state.view === 'table' ? tableHtml(items) : radarHtml(items);
}

// --- Table: one column per NbS, one row per criterion, the best value marked --------

function tableHtml(items) {
  const head = items.map(({ row, color }) => {
    const p = row.feature.properties;
    return `<th scope="col"><span class="swatch" style="background:${color}"></span>
      <span class="compare-name">${escapeHtml(p.name)}</span>
      <span class="card-meta">${escapeHtml(p.nbs_type_label)} · ${escapeHtml(p.municipality ?? '–')}</span></th>`;
  }).join('');

  const maxCost = Math.max(...items.map(({ row }) => row.feature.properties.cost_eur));
  const lines = CRITERIA.map((c) => {
    const values = items.map(({ row }) => row.feature.properties[c.key]);
    // Benefits: more is better. Cost: less is better.
    const best = c.kind === 'benefit' ? Math.max(...values) : Math.min(...values);
    const cells = items.map(({ row, color }) => {
      const value = row.feature.properties[c.key];
      const width = c.kind === 'benefit' ? (100 * value) / 5 : (100 * value) / maxCost;
      const text = c.kind === 'benefit' ? `${value} / 5` : euro.format(value);
      const isBest = value === best && items.length > 1 && values.filter((v) => v === best).length < items.length;
      return `<td class="${isBest ? 'is-best' : ''}">
        <span class="compare-value">${text}${isBest ? ' <span class="best-mark">best</span>' : ''}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${width.toFixed(1)}%;background:${color}"></span></span></td>`;
    }).join('');
    const label = c.kind === 'cost' ? 'Estimated cost' : c.label;
    return `<tr><th scope="row">${label}</th>${cells}</tr>`;
  }).join('');

  const size = items.map(({ row }) => `<td>${formatSize(row.feature.properties)}</td>`).join('');
  const score = items.map(({ row }) => `<td><strong class="compare-score">${formatScore(row.score)}</strong>
    <span class="card-meta">rank ${row.rank} of ${state.rows.length}</span></td>`).join('');
  const links = items.map(({ row }) =>
    `<td><a href="${API.mapUrl}#nbs=${row.feature.id}">Show on the map →</a></td>`).join('');

  return `<div class="compare-scroll"><table class="compare-table">
    <thead><tr><th></th>${head}</tr></thead>
    <tbody>${lines}
      <tr><th scope="row">Size</th>${size}</tr>
      <tr class="compare-total"><th scope="row">Score (balanced)</th>${score}</tr>
      <tr><th></th>${links}</tr>
    </tbody></table></div>`;
}

// --- Radar: the NbS as shapes on top of each other -------------------------------

function radarHtml(items) {
  const series = items.map(({ row, color }) => ({
    label: row.feature.properties.name,
    color,
    values: CRITERIA.map((c) => normalise(row.feature.properties, c, state.costRange)),
  }));
  const legend = items.map(({ row, color }) => `<li><span class="swatch" style="background:${color}"></span>
    ${escapeHtml(row.feature.properties.name)} <span class="card-meta">score ${formatScore(row.score)}</span></li>`).join('');
  return `<div class="compare-radar">
    ${radar(series, CRITERIA.map((c) => c.label), { size: 420 })}
    <div><ul class="compare-legend">${legend}</ul>
      <p class="option-hint">Further out = better. “Low cost” is measured against the cheapest and the
        most expensive NbS of the whole catalogue.</p></div></div>`;
}

init();
