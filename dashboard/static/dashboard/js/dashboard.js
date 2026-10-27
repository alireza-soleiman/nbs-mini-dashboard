// The dashboard: map + filters + weight sliders + ranked list.
//
// Where the data comes from:
//   /api/nbs-types/                    -> type checkboxes              (once, at start)
//   /api/municipalities/               -> grey outlines + dropdown     (once, at start)
//   /api/nbs/?type=...&municipality=... -> NbS markers + list          (after every filter change)
//   weight sliders                     -> rankNbs() in the browser     (instant, no server call)

import { getJSON } from './api.js';
import { CRITERIA, DEFAULT_WEIGHT, rankNbs } from './ranking.js';

const API = document.body.dataset; // nbsUrl, municipalitiesUrl, typesUrl: written by Django
const MERANO = [46.6713, 11.1597]; // Leaflet order: [lat, lng]

// Score classes: one blue hue, light -> dark (a validated ordinal ramp). Darker = better.
// `ink` is the text colour for the rank number inside a marker of that colour.
const SCORE_CLASSES = [
  { from: 75, to: 100, color: '#104281', ink: '#ffffff' },
  { from: 50, to: 75, color: '#256abf', ink: '#ffffff' },
  { from: 25, to: 50, color: '#5598e7', ink: '#0b0b0b' },
  { from: 0, to: 25, color: '#86b6ef', ink: '#0b0b0b' },
];
const NO_SCORE = { color: '#898781', ink: '#ffffff' }; // when every weight is 0

const euro = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const state = {
  features: [],                   // NbS from the API (already filtered by the server)
  weights: Object.fromEntries(CRITERIA.map((c) => [c.key, DEFAULT_WEIGHT])),
  rows: [],                       // ranked NbS, best first (see ranking.js)
  rowById: new Map(),             // NbS id -> its row
  municipalityLayers: new Map(),  // ISTAT code -> polygon on the map
};

const el = {
  status: document.getElementById('status'),
  typeFilter: document.getElementById('type-filter'),
  municipalityFilter: document.getElementById('municipality-filter'),
  weights: document.getElementById('weights'),
  resetWeights: document.getElementById('reset-weights'),
  count: document.getElementById('result-count'),
  legend: document.getElementById('legend'),
  ranking: document.getElementById('ranking'),
};

// --- Map --------------------------------------------------------------

const map = L.map('map').setView(MERANO, 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const MUNICIPALITY_STYLE = { color: '#6b6a66', weight: 1, fillColor: '#6b6a66', fillOpacity: 0.03 };
const SELECTED_MUNICIPALITY_STYLE = { color: '#0b0b0b', weight: 3, fillOpacity: 0.06 };

const municipalities = L.geoJSON(null, {
  style: () => MUNICIPALITY_STYLE,
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    state.municipalityLayers.set(feature.id, layer); // feature.id = ISTAT code
    layer.bindTooltip(escapeHtml(p.name), { sticky: true });
    layer.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br>
      Area: ${p.area_km2} km²<br>NbS: ${p.nbs_count}<br>ISTAT code: ${feature.id}`);
  },
  attribution: 'Boundaries &copy; <a href="https://www.istat.it/">ISTAT</a> 2026',
}).addTo(map);

const nbsLayer = L.featureGroup().addTo(map); // all NbS markers
const markers = new Map();                    // NbS id -> marker

// --- Start ------------------------------------------------------------

async function init() {
  try {
    // Two requests at the same time: types and municipalities don't depend on each other
    const [types, municipalityData] = await Promise.all([
      getJSON(API.typesUrl),
      getJSON(API.municipalitiesUrl),
    ]);
    buildTypeFilter(types);
    municipalities.addData(municipalityData);
    buildMunicipalityFilter(municipalityData);
    buildWeightSliders();
    drawLegend();
    await loadNbs({ fit: true });
  } catch (error) {
    console.error(error);
    setStatus(`Could not load the data: ${error.message}`, true);
  }
}

// --- Filters (the server filters: /api/nbs/?type=...&municipality=...) --

function buildTypeFilter(types) {
  for (const t of types) {
    const label = document.createElement('label');
    label.className = 'check';
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(t.value)}" checked>
      ${escapeHtml(t.label)} <span class="count">${t.count}</span>`;
    el.typeFilter.append(label);
  }
  el.typeFilter.addEventListener('change', () => loadNbs({ fit: true }));
}

function buildMunicipalityFilter(collection) {
  const withNbs = collection.features
    .filter((f) => f.properties.nbs_count > 0)
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  for (const f of withNbs) {
    el.municipalityFilter.add(new Option(`${f.properties.name} (${f.properties.nbs_count})`, f.id));
  }
  el.municipalityFilter.addEventListener('change', () => {
    highlightSelectedMunicipality();
    loadNbs({ fit: true });
  });
}

function checkedTypes() {
  const boxes = [...el.typeFilter.querySelectorAll('input')];
  const checked = boxes.filter((box) => box.checked).map((box) => box.value);
  return { checked, all: checked.length === boxes.length };
}

let latestRequest = 0; // to ignore an older answer that arrives after a newer one

async function loadNbs({ fit = false } = {}) {
  const { checked, all } = checkedTypes();
  const request = ++latestRequest;
  setStatus('Loading NbS…');
  try {
    let features = [];
    if (checked.length > 0) {
      const data = await getJSON(API.nbsUrl, {
        type: all ? [] : checked,                 // all types checked -> no type filter
        municipality: el.municipalityFilter.value, // '' -> no municipality filter
      });
      features = data.features;
    }
    if (request !== latestRequest) return; // the user changed the filters meanwhile
    state.features = features;
    rebuildMarkers();
    rerank();
    if (fit) fitToResults();
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus(`Could not load the NbS: ${error.message}`, true);
  }
}

function highlightSelectedMunicipality() {
  municipalities.resetStyle(); // every polygon back to normal
  const layer = state.municipalityLayers.get(el.municipalityFilter.value);
  if (layer) layer.setStyle(SELECTED_MUNICIPALITY_STYLE);
}

function fitToResults() {
  const selected = state.municipalityLayers.get(el.municipalityFilter.value);
  if (selected) {
    map.fitBounds(selected.getBounds(), { padding: [20, 20] });
  } else if (nbsLayer.getLayers().length) {
    map.fitBounds(nbsLayer.getBounds(), { padding: [40, 40], maxZoom: 14 });
  }
}

// --- Weights (the browser ranks: no server call) ------------------------

function buildWeightSliders() {
  for (const c of CRITERIA) {
    const row = document.createElement('label');
    row.className = 'weight';
    row.innerHTML = `<span class="weight-name">${c.label}</span>
      <input type="range" min="0" max="10" step="1" value="${state.weights[c.key]}" data-key="${c.key}">
      <output></output><span class="share"></span>`;
    el.weights.append(row);
  }
  el.weights.addEventListener('input', (event) => {
    const key = event.target.dataset.key;
    if (!key) return;
    state.weights[key] = Number(event.target.value);
    showWeights();
    rerank();
  });
  el.resetWeights.addEventListener('click', () => {
    for (const c of CRITERIA) state.weights[c.key] = DEFAULT_WEIGHT;
    for (const slider of el.weights.querySelectorAll('input')) slider.value = DEFAULT_WEIGHT;
    showWeights();
    rerank();
  });
  showWeights();
}

function showWeights() {
  const total = CRITERIA.reduce((sum, c) => sum + state.weights[c.key], 0);
  for (const row of el.weights.querySelectorAll('.weight')) {
    const key = row.querySelector('input').dataset.key;
    const weight = state.weights[key];
    row.querySelector('output').textContent = weight;
    // The share is what the weight really means: its part of all weights together
    row.querySelector('.share').textContent = total ? `${Math.round((100 * weight) / total)} %` : '–';
  }
}

// --- Ranking: markers, list, legend -----------------------------------

function rerank() {
  state.rows = rankNbs(state.features, state.weights);
  state.rowById = new Map(state.rows.map((row) => [row.feature.id, row]));
  updateMarkers();
  drawRanking();
  if (state.features.length && state.rows[0].score === null) {
    setStatus('All weights are 0: move at least one slider to rank the NbS.');
  } else if (!el.status.classList.contains('error')) {
    setStatus('');
  }
}

/** New NbS from the API: one marker each. Colours and ranks come in updateMarkers(). */
function rebuildMarkers() {
  nbsLayer.clearLayers();
  markers.clear();
  for (const feature of state.features) {
    const [lon, lat] = feature.geometry.coordinates; // GeoJSON order: [lng, lat]
    const marker = L.marker([lat, lon], { keyboard: true });
    marker.bindTooltip('');
    // A function: the popup is built when it opens, so it always shows the current score
    marker.bindPopup(() => popupHtml(state.rowById.get(feature.id)), { maxWidth: 320 });
    nbsLayer.addLayer(marker);
    markers.set(feature.id, marker);
  }
}

/** New scores: recolour the markers in place (open popups stay open). */
function updateMarkers() {
  for (const row of state.rows) {
    const marker = markers.get(row.feature.id);
    marker.setIcon(markerIcon(row));
    marker.setZIndexOffset((state.rows.length - row.rank) * 100); // best on top
    marker.setTooltipContent(`${row.rank}. ${escapeHtml(row.feature.properties.name)} · score ${formatScore(row.score)}`);
    if (marker.isPopupOpen()) marker.getPopup().update();
  }
}

function markerIcon(row) {
  const { color, ink } = scoreClass(row.score);
  const label = row.rank <= 3 && row.score !== null ? row.rank : ''; // number only on the top 3
  return L.divIcon({
    className: 'nbs-marker',
    html: `<span style="background:${color};color:${ink}">${label}</span>`,
    iconSize: [28, 28], // the clickable area is bigger than the 20 px dot
  });
}

function popupHtml(row) {
  const p = row.feature.properties;
  const lines = CRITERIA.map((c) => {
    const value = c.kind === 'benefit' ? `${p[c.key]} / 5` : euro.format(p[c.key]);
    const points = row.score === null ? '–' : row.parts[c.key].toFixed(1);
    return `<tr><td>${c.label}</td><td>${value}</td><td class="num">${points}</td></tr>`;
  }).join('');
  return `<div class="popup">
    <strong>${escapeHtml(p.name)}</strong>
    <div class="muted">${escapeHtml(p.nbs_type_label)} · ${escapeHtml(p.municipality ?? 'no municipality')}</div>
    <p>${escapeHtml(p.description)}</p>
    <table>
      <thead><tr><th>Criterion</th><th>Value</th><th class="num">Points</th></tr></thead>
      <tbody>${lines}</tbody>
      <tfoot><tr><td colspan="2">Score · rank ${row.rank} of ${state.rows.length}</td>
        <td class="num">${formatScore(row.score)}</td></tr></tfoot>
    </table>
  </div>`;
}

function drawRanking() {
  el.count.textContent = `(${state.rows.length})`;
  if (!state.rows.length) {
    el.ranking.innerHTML = '<li class="empty">No NbS match the filters.</li>';
    return;
  }
  el.ranking.replaceChildren(...state.rows.map(rankingItem));
}

function rankingItem(row) {
  const p = row.feature.properties;
  const { color } = scoreClass(row.score);
  const item = document.createElement('li');
  item.innerHTML = `<button type="button">
      <span class="rank">${row.rank}</span>
      <span class="name">${escapeHtml(p.name)}
        <small>${escapeHtml(p.nbs_type_label)} · ${escapeHtml(p.municipality ?? '–')} · ${euro.format(p.cost_eur)}</small></span>
      <span class="score"><span class="bar"><span style="width:${row.score ?? 0}%;background:${color}"></span></span>
        ${formatScore(row.score)}</span>
    </button>`;
  const button = item.querySelector('button');
  const marker = markers.get(row.feature.id);
  button.addEventListener('click', () => {
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
    marker.openPopup();
  });
  // Hovering a list entry highlights its marker
  button.addEventListener('mouseenter', () => marker.getElement()?.classList.add('is-hover'));
  button.addEventListener('mouseleave', () => marker.getElement()?.classList.remove('is-hover'));
  return item;
}

function drawLegend() {
  const items = [...SCORE_CLASSES].reverse().map((c) =>
    `<span class="legend-item"><span class="swatch" style="background:${c.color}"></span>${c.from}–${c.to}</span>`);
  el.legend.innerHTML = `<span class="legend-title">Score</span>${items.join('')}
    <span class="legend-note">Darker = better for your weights. Numbers 1–3 = top three.</span>`;
}

// --- Small helpers ------------------------------------------------------

function scoreClass(score) {
  if (score === null) return NO_SCORE;
  return SCORE_CLASSES.find((c) => score >= c.from);
}

function formatScore(score) {
  return score === null ? '–' : Math.round(score);
}

function setStatus(text, isError = false) {
  el.status.textContent = text;
  el.status.hidden = !text;
  el.status.classList.toggle('error', isError);
}

/** Text from the database must never be read as HTML (someone could type <script> in the admin). */
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// For exploring in the browser console (F12): dashboard.state, dashboard.map
window.dashboard = { map, state };

init();
