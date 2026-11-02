// The map page: NbS shapes + markers, filters, priorities (weights) and the ranking.
//
// Where the data comes from:
//   /api/nbs-types/                     -> type chips                    (once, at start)
//   /api/municipalities/                -> grey outlines + search list   (once, at start)
//   /api/nbs/?type=...&municipality=... -> shapes, markers, list         (after every filter change)
//   priorities (presets, sliders)       -> rankNbs() in the browser      (instant, no server call)

import { getJSON } from './api.js';
import { scoreClass } from './colors.js';
import { escapeHtml, formatScore } from './format.js';
import { legendHtml, markSelectedCard, renderRanking, summaryHtml } from './panel.js';
import { popupHtml } from './popup.js';
import { CRITERIA, PRESETS, rankNbs } from './ranking.js';

const API = document.body.dataset;  // nbsUrl, municipalitiesUrl, typesUrl: written by Django
const MERANO = [46.6713, 11.1597];  // Leaflet order: [lat, lng]
const POINT_ZOOM = 17;              // zoom level when flying to a single point

const state = {
  features: [],                     // NbS from the API (already filtered by the server)
  weights: { ...PRESETS[0].weights },
  rows: [],                         // ranked NbS, best first (see ranking.js)
  rowById: new Map(),
  selectedId: null,                 // the NbS whose popup is open
  municipalities: new Map(),        // ISTAT code -> { layer, name, count }
  municipality: '',                 // ISTAT code of the municipality filter ('' = all)
};

const el = Object.fromEntries([
  'layout', 'sidebar', 'sidebar-toggle', 'sheet-handle', 'summary', 'status',
  'filter-note', 'type-filter', 'types-all', 'types-none', 'municipality-search',
  'municipality-options', 'preset-note', 'presets', 'weights', 'legend', 'ranking',
].map((id) => [id.replace(/-(\w)/g, (_, c) => c.toUpperCase()), document.getElementById(id === 'layout' ? 'map-layout' : id)]));

// --- Map and layers -----------------------------------------------------

const map = L.map('map', { zoomControl: false }).setView(MERANO, 11);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Municipalities get their own pane BELOW the NbS shapes (overlay pane = 400)
map.createPane('municipalities').style.zIndex = 350;

const MUNICIPALITY_STYLE = { color: '#6b6a66', weight: 1, fillColor: '#6b6a66', fillOpacity: 0.03 };
const SELECTED_MUNICIPALITY_STYLE = { color: '#0b0b0b', weight: 3, fillOpacity: 0.05 };

const municipalityLayer = L.geoJSON(null, {
  pane: 'municipalities',
  style: () => MUNICIPALITY_STYLE,
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    state.municipalities.set(feature.id, { layer, name: p.name, count: p.nbs_count });
    layer.bindTooltip(escapeHtml(p.name), { sticky: true });
    layer.bindPopup(`<div class="popup"><strong>${escapeHtml(p.name)}</strong>
      <div class="muted">ISTAT code ${feature.id}</div>
      <p>Area: ${p.area_km2} km² · NbS: ${p.nbs_count}</p></div>`);
    // Click a municipality: fly to it (the popup opens at the clicked point)
    layer.on('click', () => map.flyToBounds(layer.getBounds(), { padding: [30, 30], duration: 0.8 }));
  },
  attribution: 'Boundaries &copy; <a href="https://www.istat.it/">ISTAT</a> 2026',
}).addTo(map);

const casingLayer = L.layerGroup().addTo(map);    // white outline under lines (visible on any map)
const shapeLayer = L.layerGroup().addTo(map);     // lines and polygons, coloured by score
const markerLayer = L.featureGroup().addTo(map);  // one marker per NbS, on top
const nbsLayers = new Map();                      // NbS id -> { marker, shape, casing, kind }

function shapeStyle(kind, color, selected = false) {
  if (kind.includes('LineString')) {
    return { color, weight: selected ? 8 : 5, opacity: 1, lineCap: 'round', lineJoin: 'round' };
  }
  return { color, weight: selected ? 4 : 2, fillColor: color, fillOpacity: selected ? 0.55 : 0.35 };
}

// --- Start ------------------------------------------------------------------

async function init() {
  try {
    const [types, municipalities] = await Promise.all([
      getJSON(API.typesUrl),
      getJSON(API.municipalitiesUrl),
    ]);
    buildTypeChips(types);
    municipalityLayer.addData(municipalities);
    buildMunicipalitySearch(municipalities);
    buildPriorities();
    drawLegend();
    setupPanels();
    await loadNbs({ fit: true });
    selectFromAddress();
  } catch (error) {
    console.error(error);
    setStatus(`Could not load the data: ${error.message}`, true);
  }
}

// --- Filters: the server filters (/api/nbs/?type=...&municipality=...) ---------

function buildTypeChips(types) {
  for (const t of types) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.value = t.value;
    chip.setAttribute('aria-pressed', 'true');
    chip.innerHTML = `${escapeHtml(t.label)}<span class="chip-count">${t.count}</span>`;
    el.typeFilter.append(chip);
  }
  el.typeFilter.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    loadNbs({ fit: true });
  });
  const setAll = (on) => {
    for (const chip of el.typeFilter.querySelectorAll('.chip')) chip.setAttribute('aria-pressed', String(on));
    loadNbs({ fit: true });
  };
  el.typesAll.addEventListener('click', () => setAll(true));
  el.typesNone.addEventListener('click', () => setAll(false));
}

function selectedTypes() {
  const chips = [...el.typeFilter.querySelectorAll('.chip')];
  const on = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.value);
  return { on, all: on.length === chips.length };
}

function buildMunicipalitySearch(collection) {
  const withNbs = collection.features
    .filter((f) => f.properties.nbs_count > 0)
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  for (const f of withNbs) {
    el.municipalityOptions.append(new Option(`${f.properties.nbs_count} NbS`, f.properties.name));
  }
  // 'change' fires when a name is picked from the list; 'input' also catches clearing (×)
  const apply = () => {
    const name = el.municipalitySearch.value.trim().toLowerCase();
    const match = [...state.municipalities.entries()].find(([, m]) => m.name.toLowerCase() === name);
    const code = match ? match[0] : '';
    if (name && !match) return; // still typing
    if (code === state.municipality) return;
    state.municipality = code;
    highlightMunicipality();
    loadNbs({ fit: true });
  };
  el.municipalitySearch.addEventListener('change', apply);
  el.municipalitySearch.addEventListener('input', () => {
    if (!el.municipalitySearch.value) apply();
  });
}

function highlightMunicipality() {
  municipalityLayer.resetStyle(); // every outline back to normal
  state.municipalities.get(state.municipality)?.layer.setStyle(SELECTED_MUNICIPALITY_STYLE);
}

let latestRequest = 0; // to ignore an older answer that arrives after a newer one

async function loadNbs({ fit = false } = {}) {
  const { on, all } = selectedTypes();
  const request = ++latestRequest;
  setStatus('Loading NbS…');
  try {
    let features = [];
    if (on.length > 0) {
      const data = await getJSON(API.nbsUrl, {
        type: all ? [] : on,             // every type on -> no type filter
        municipality: state.municipality, // '' -> no municipality filter
      });
      features = data.features;
    }
    if (request !== latestRequest) return; // the user changed the filters meanwhile
    state.features = features;
    if (!state.features.some((f) => f.id === state.selectedId)) state.selectedId = null;
    rebuildNbsLayers();
    rerank();
    if (fit) fitToResults();
    showFilterNote(on.length, all);
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus(`Could not load the NbS: ${error.message}`, true);
  }
}

function showFilterNote(typesOn, all) {
  const parts = [];
  if (!all) parts.push(`${typesOn} of ${el.typeFilter.children.length} types`);
  if (state.municipality) parts.push(state.municipalities.get(state.municipality).name);
  el.filterNote.textContent = parts.join(' · ') || 'none';
}

function fitToResults() {
  const selected = state.municipalities.get(state.municipality);
  if (selected) {
    map.flyToBounds(selected.layer.getBounds(), { ...mapPadding(20), duration: 0.8 });
  } else if (markerLayer.getLayers().length) {
    map.flyToBounds(markerLayer.getBounds(), { ...mapPadding(50), maxZoom: 15, duration: 0.8 });
  }
}

const isPhone = () => window.matchMedia('(max-width: 800px)').matches;

/** Padding for flying the map. On phones an open sheet covers the lower part of the map,
    so the results must land in the strip above it. */
function mapPadding(space) {
  const sheet = isPhone() && el.sidebar.classList.contains('is-open') ? el.sidebar.offsetHeight : 0;
  return { paddingTopLeft: [space, space], paddingBottomRight: [space, space + sheet] };
}

// --- Priorities: the browser ranks (no server call) ---------------------------

function buildPriorities() {
  for (const p of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.dataset.key = p.key;
    button.textContent = p.label;
    button.addEventListener('click', () => {
      Object.assign(state.weights, p.weights);
      syncSliders();
      rerank();
    });
    el.presets.append(button);
  }
  for (const c of CRITERIA) {
    const row = document.createElement('label');
    row.className = 'weight';
    row.innerHTML = `<span class="weight-name">${c.label}</span>
      <span class="weight-share"></span>
      <input type="range" min="0" max="10" step="1" data-key="${c.key}"
             aria-label="Weight for ${c.label}">`;
    el.weights.append(row);
  }
  el.weights.addEventListener('input', (event) => {
    const key = event.target.dataset.key;
    if (!key) return;
    state.weights[key] = Number(event.target.value);
    syncSliders();
    rerank();
  });
  syncSliders();
}

/** Show the weights: slider positions, shares in %, and which preset (if any) is active. */
function syncSliders() {
  const total = CRITERIA.reduce((sum, c) => sum + state.weights[c.key], 0);
  for (const row of el.weights.querySelectorAll('.weight')) {
    const slider = row.querySelector('input');
    const weight = state.weights[slider.dataset.key];
    slider.value = weight;
    slider.style.setProperty('--fill', `${weight * 10}%`); // coloured part of the track
    // The share is what a weight really means: its part of all weights together
    row.querySelector('.weight-share').textContent = total ? `${Math.round((100 * weight) / total)} %` : '–';
  }
  const active = PRESETS.find((p) => CRITERIA.every((c) => p.weights[c.key] === state.weights[c.key]));
  for (const button of el.presets.children) {
    button.setAttribute('aria-pressed', String(button.dataset.key === active?.key));
  }
  el.presetNote.textContent = active ? active.label : 'custom';
}

// --- Ranking: shapes, markers, list -----------------------------------------------

function rerank() {
  state.rows = rankNbs(state.features, state.weights);
  state.rowById = new Map(state.rows.map((row) => [row.feature.id, row]));
  updateNbsLayers();
  drawRanking();
  drawSummary();
  if (state.features.length && state.rows[0].score === null) {
    setStatus('All weights are 0: move at least one slider or pick a preset.');
  } else if (!el.status.classList.contains('error')) {
    setStatus('');
  }
}

/** New NbS from the API: one marker each, plus a shape for lines and polygons. */
function rebuildNbsLayers() {
  markerLayer.clearLayers();
  shapeLayer.clearLayers();
  casingLayer.clearLayers();
  nbsLayers.clear();
  for (const feature of state.features) {
    const id = feature.id;
    const kind = feature.geometry.type;
    const [lon, lat] = feature.properties.marker; // a point surely ON the shape
    const marker = L.marker([lat, lon], { keyboard: true });
    marker.bindTooltip('', { direction: 'top', offset: [0, -14] });
    // A function: the popup is built when it opens, so it always shows the current score
    marker.bindPopup(() => popupHtml(state.rowById.get(id), state.rows.length),
      { maxWidth: 340, autoPanPadding: [30, 30] });
    marker.on('click', () => selectNbs(id));
    marker.on('popupclose', () => { if (state.selectedId === id) setSelected(null); });
    markerLayer.addLayer(marker);

    let shape = null;
    let casing = null;
    if (kind !== 'Point') {
      if (kind.includes('LineString')) {
        casing = L.geoJSON(feature, { style: { color: '#ffffff', weight: 9, opacity: 0.9 }, interactive: false });
        casingLayer.addLayer(casing);
      }
      shape = L.geoJSON(feature, { style: shapeStyle(kind, '#898781') });
      shape.bindTooltip('', { sticky: true });
      shape.on('click', () => selectNbs(id));
      shapeLayer.addLayer(shape);
    }
    nbsLayers.set(id, { marker, shape, casing, kind });
  }
}

/** New scores: recolour everything in place (an open popup stays open). */
function updateNbsLayers() {
  for (const row of state.rows) {
    const { marker, shape, kind } = nbsLayers.get(row.feature.id);
    const selected = row.feature.id === state.selectedId;
    const tip = `${row.rank}. ${escapeHtml(row.feature.properties.name)} · score ${formatScore(row.score)}`;
    marker.setIcon(markerIcon(row, selected));
    marker.setZIndexOffset((state.rows.length - row.rank) * 100); // best on top
    marker.setTooltipContent(tip);
    if (shape) {
      shape.setStyle(shapeStyle(kind, scoreClass(row.score).color, selected));
      shape.setTooltipContent(tip);
    }
    if (marker.isPopupOpen()) marker.getPopup().update();
  }
  // Draw the best shapes last, so they lie on top where shapes overlap
  for (const row of [...state.rows].reverse()) {
    const { shape, casing } = nbsLayers.get(row.feature.id);
    casing?.bringToFront();
    shape?.bringToFront();
  }
}

function markerIcon(row, selected) {
  const { color, ink } = scoreClass(row.score);
  const label = row.rank <= 3 && row.score !== null ? row.rank : ''; // number only on the top 3
  return L.divIcon({
    className: `nbs-marker${selected ? ' is-selected' : ''}`,
    html: `<span style="background:${color};color:${ink}">${label}</span>`,
    iconSize: [30, 30], // the clickable area is bigger than the 20 px dot
  });
}

/** Click on a marker, shape or list entry: fly to the NbS and open its popup. */
function selectNbs(id) {
  const { marker, shape } = nbsLayers.get(id);
  if (isPhone()) setSheet(false); // on phones: close the sheet, so the map is visible
  setSelected(id);
  let opened = false;
  const open = () => { if (!opened) { opened = true; marker.openPopup(); } };
  if (shape) {
    map.flyToBounds(shape.getBounds(), { padding: [60, 60], maxZoom: POINT_ZOOM, duration: 0.8 });
  } else {
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), POINT_ZOOM), { duration: 0.8 });
  }
  map.once('moveend', open);
  setTimeout(open, 1200); // in case the map did not need to move
}

function setSelected(id) {
  state.selectedId = id;
  updateNbsLayers();
  markSelectedCard(el.ranking, id);
  // The address can be shared: /map/#nbs=12 opens this NbS directly
  history.replaceState(null, '', id ? `#nbs=${id}` : location.pathname);
}

function selectFromAddress() {
  const id = Number(new URLSearchParams(location.hash.slice(1)).get('nbs'));
  if (id && nbsLayers.has(id)) selectNbs(id);
}


function drawRanking() {
  renderRanking(el.ranking, state.rows, {
    selectedId: state.selectedId,
    onSelect: selectNbs,
    // Hovering a card highlights its marker
    onHover: (id, on) => nbsLayers.get(id).marker.getElement()?.classList.toggle('is-hover', on),
  });
}

function drawSummary() {
  el.summary.innerHTML = summaryHtml(state.rows);
}

function drawLegend() {
  el.legend.innerHTML = legendHtml();
}

// --- Panels: collapse on desktop, bottom sheet on phones -----------------------

function setupPanels() {
  el.sidebarToggle.addEventListener('click', () => {
    const collapsed = el.layout.classList.toggle('is-collapsed');
    el.sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    el.sidebarToggle.title = collapsed ? 'Show the panel' : 'Hide the panel';
    // Fallback for when there is no animation (e.g. "reduce motion" is switched on)
    setTimeout(() => map.invalidateSize(), 300);
  });
  // When the slide animation has finished, tell Leaflet that the map changed size
  // (otherwise the new strip of map stays empty)
  el.layout.addEventListener('transitionend', (event) => {
    if (event.target === el.layout) map.invalidateSize();
  });
  el.sheetHandle.addEventListener('click', () => setSheet(!el.sidebar.classList.contains('is-open')));
}

/** Phones: slide the bottom sheet up (open) or down (closed). */
function setSheet(open) {
  el.sidebar.classList.toggle('is-open', open);
  el.sheetHandle.setAttribute('aria-expanded', String(open));
  if (!open) el.sidebar.scrollTop = 0; // the closed sheet shows its top: handle + summary
}

function setStatus(text, isError = false) {
  el.status.textContent = text;
  el.status.hidden = !text;
  el.status.classList.toggle('error', isError);
}

// For exploring in the browser console (F12): dashboard.state, dashboard.map
window.dashboard = { map, state };

init();
