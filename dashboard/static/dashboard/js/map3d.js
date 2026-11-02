// The 3D map page (prototype): the same NbS and ranking as the 2D map (map.js), drawn
// with MapLibre GL JS instead of Leaflet.
//
// What MapLibre does differently:
//   - VECTOR basemap (OpenFreeMap): the browser draws roads and labels itself, so the
//     map stays sharp at every zoom and can be tilted and rotated
//   - 3D terrain: elevation tiles (Terrarium PNGs) lift the map into the mountains
//   - our data are GeoJSON *sources* + style *layers*; the GPU colours every NbS with an
//     *expression* that reads its `score` property (no JavaScript object per marker)
//
// Where the data comes from:
//   /api/municipalities/  -> outlines                 (once, at start)
//   /api/nbs/             -> shapes, circles, list    (once: this page has no filters)
//   priority buttons      -> rankNbs() in the browser -> setData() on the map sources

import { getJSON } from './api.js';
import { NO_SCORE, SCORE_CLASSES } from './colors.js';
import { escapeHtml, formatScore } from './format.js';
import { legendHtml, markSelectedCard, renderRanking, summaryHtml } from './panel.js';
import { popupHtml } from './popup.js';
import { PRESETS, rankNbs } from './ranking.js';

const API = document.body.dataset;          // nbsUrl, municipalitiesUrl: written by Django
const MERANO = [11.1597, 46.6713];          // MapLibre order: [lng, lat] like GeoJSON (Leaflet: [lat, lng])
const POINT_ZOOM = 17;                      // zoom level when flying to a single NbS
const TILT = { pitch: 50, bearing: -15 };   // the 3D view: tilt and rotation in degrees
const FONT = ['Noto Sans Bold'];            // must exist on the style's font server (glyphs)

// --- Backgrounds and terrain (all free, no API key) ---------------------------------

const BASEMAPS = [
  // Ready-made styles: a JSON file that lists every source and layer of the basemap
  { key: 'map', label: 'Map', style: 'https://tiles.openfreemap.org/styles/liberty' },
  { key: 'light', label: 'Light', style: 'https://tiles.openfreemap.org/styles/positron' },
  // Our own small style: one layer of satellite photos (Sentinel-2, 10 m pixels)
  {
    key: 'satellite',
    label: 'Satellite',
    style: {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', // for our rank numbers
      sources: {
        satellite: {
          type: 'raster',
          // WMTS address order is {z}/{y}/{x}: row before column
          tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg'],
          tileSize: 256,
          maxzoom: 14, // 10 m pixels: closer zooms add no detail, MapLibre enlarges zoom 14
          attribution: 'EOxCloudless <a href="https://cloudless.eox.at">cloudless.eox.at</a> by EOX IT Services GmbH '
            + '(contains modified Copernicus Sentinel data 2023), '
            + '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>',
        },
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
    },
  },
];

// Elevation as PNG tiles: the red, green and blue of each pixel encode a height
// (Terrarium: R × 256 + G + B / 256 − 32768 metres). Free, from AWS Open Data.
const DEM = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15, // zoom 16 does not exist (404)
  attribution: 'Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Mapzen/Tilezen</a>',
};

// --- Style expressions: small programs MapLibre runs for every feature ----------------

// No score (every weight is 0) -> -1, below the first class
const SCORE = ['coalesce', ['get', 'score'], -1];
// ['step', input, value below the first stop, stop, value, stop, value, ...]: the same
// classes as colors.js (-1 grey, 0–25 lightest blue … 75–100 darkest), built from it
const byScore = (key) => ['step', SCORE, NO_SCORE[key],
  ...[...SCORE_CLASSES].reverse().flatMap((c) => [c.from, c[key]])];
const SCORE_COLOR = byScore('color');
const SCORE_INK = byScore('ink');
const SELECTED = ['boolean', ['feature-state', 'selected'], false];
const HOVER = ['boolean', ['feature-state', 'hover'], false];
const IS_POLYGON = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
const IS_LINE = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
const NBS_LAYERS = ['nbs-marker', 'nbs-line', 'nbs-fill']; // what a click or hover can hit

const EMPTY = { type: 'FeatureCollection', features: [] };

const state = {
  basemap: BASEMAPS[0].key,
  features: [],                   // NbS from the API
  weights: { ...PRESETS[0].weights },
  rows: [],                       // ranked NbS, best first (see ranking.js)
  rowById: new Map(),
  selectedId: null,               // the NbS whose popup is open
  hoverId: null,                  // the NbS under the mouse
  municipalities: EMPTY,          // GeoJSON for the outlines
  municipalityByCode: new Map(),  // ISTAT code -> feature (its full outline, for flying)
};

const el = Object.fromEntries([
  'sidebar', 'sheet-handle', 'summary', 'status', 'basemaps', 'terrain-toggle',
  'view-toggle', 'presets', 'legend', 'ranking',
].map((id) => [id.replace(/-(\w)/g, (_, c) => c.toUpperCase()), document.getElementById(id)]));

let popup = null; // the one open popup (NbS or municipality)

// --- Map ------------------------------------------------------------------------------

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAPS[0].style,
  center: MERANO,
  zoom: 11,
  ...TILT,
  maxPitch: 75,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
// Tile servers can fail (offline, server down): say so in the console, do not fail silently
map.on('error', (event) => console.warn('Map:', event.error?.message ?? event));

// A new background style replaces EVERYTHING on the map, our layers too. So terrain and
// our layers are added each time a style has loaded: the first one and after a switch.
map.on('style.load', () => {
  addTerrain();
  addOverlay();
});

function addTerrain() {
  // Two sources with the same tiles, as MapLibre advises: 3D shape and shading read them differently
  map.addSource('terrain', { ...DEM });
  map.addSource('hillshade', { ...DEM });
  if (state.basemap !== 'satellite') { // photos already have real shadows
    map.addLayer({
      id: 'hillshade', type: 'hillshade', source: 'hillshade',
      paint: { 'hillshade-exaggeration': 0.3, 'hillshade-shadow-color': '#473b24' },
    }, firstLayer('line', 'symbol')); // under roads and labels
  }
  applyTerrain();
  // Sky and haze towards the horizon (MapLibre 5)
  map.setSky?.({
    'sky-color': '#a9cbed', 'horizon-color': '#eef2f4', 'fog-color': '#eef2f4',
    'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.85,
  });
}

function applyTerrain() {
  if (!map.getSource('terrain')) return; // the background is switching; addTerrain() follows
  // exaggeration 1 = true heights (more looks dramatic, but misleads)
  map.setTerrain(el.terrainToggle.checked ? { source: 'terrain', exaggeration: 1 } : null);
}

/** The id of the first basemap layer of one of these types: our layers slide in below it. */
function firstLayer(...types) {
  return map.getStyle().layers.find((layer) => types.includes(layer.type))?.id;
}

function addOverlay() {
  const labels = firstLayer('symbol'); // our shapes go UNDER the basemap's labels
  const outline = state.basemap === 'satellite' ? '#ffffff' : '#6b6a66';

  map.addSource('municipalities', {
    type: 'geojson',
    data: state.municipalities,
    attribution: 'Boundaries &copy; <a href="https://www.istat.it/">ISTAT</a> 2026',
  });
  map.addSource('nbs', { type: 'geojson', data: nbsData() });
  map.addSource('nbs-markers', { type: 'geojson', data: markerData() });

  map.addLayer({
    id: 'municipality-fill', type: 'fill', source: 'municipalities',
    paint: { 'fill-color': outline, 'fill-opacity': 0.03 },
  }, labels);
  map.addLayer({
    id: 'municipality-line', type: 'line', source: 'municipalities',
    paint: { 'line-color': outline, 'line-width': 1, 'line-opacity': 0.8 },
  }, labels);

  // Polygons: area + outline. Sort key = score: the best NbS is drawn on top
  map.addLayer({
    id: 'nbs-fill', type: 'fill', source: 'nbs', filter: IS_POLYGON,
    layout: { 'fill-sort-key': SCORE },
    paint: { 'fill-color': SCORE_COLOR, 'fill-opacity': ['case', SELECTED, 0.6, 0.4] },
  }, labels);
  map.addLayer({
    id: 'nbs-outline', type: 'line', source: 'nbs', filter: IS_POLYGON,
    layout: { 'line-sort-key': SCORE, 'line-join': 'round' },
    paint: { 'line-color': SCORE_COLOR, 'line-width': ['case', SELECTED, 4, 2] },
  }, labels);
  // Lines: a white casing underneath keeps them visible on every background
  map.addLayer({
    id: 'nbs-line-casing', type: 'line', source: 'nbs', filter: IS_LINE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-width': ['case', SELECTED, 12, 9] },
  }, labels);
  map.addLayer({
    id: 'nbs-line', type: 'line', source: 'nbs', filter: IS_LINE,
    layout: { 'line-sort-key': SCORE, 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': SCORE_COLOR, 'line-width': ['case', SELECTED, 8, 5] },
  }, labels);

  // One circle per NbS, above everything (like the Leaflet markers); rank 1–3 inside
  map.addLayer({
    id: 'nbs-marker', type: 'circle', source: 'nbs-markers',
    layout: { 'circle-sort-key': SCORE },
    paint: {
      'circle-color': SCORE_COLOR,
      'circle-radius': ['case', SELECTED, 13, 10],
      'circle-stroke-color': ['case', ['any', SELECTED, HOVER], '#0b0b0b', '#ffffff'],
      'circle-stroke-width': ['case', ['any', SELECTED, HOVER], 3, 2],
    },
  });
  map.addLayer({
    id: 'nbs-rank', type: 'symbol', source: 'nbs-markers',
    filter: ['all', ['<=', ['number', ['get', 'rank'], 99], 3], ['>=', SCORE, 0]],
    layout: {
      'text-field': ['to-string', ['get', 'rank']],
      'text-font': FONT,
      'text-size': 12,
      'text-allow-overlap': true,   // never hide a rank number behind another label
      'text-ignore-placement': true,
    },
    paint: { 'text-color': SCORE_INK },
  });

  // New sources start without feature state: show the selection again
  if (state.selectedId !== null) setNbsState(state.selectedId, { selected: true });
}

/** The NbS with their current score and rank, as GeoJSON for the shape layers. */
function nbsData() {
  return {
    type: 'FeatureCollection',
    features: state.rows.map(({ feature, score, rank }) => ({
      ...feature, properties: { ...feature.properties, score, rank },
    })),
  };
}

/** One point per NbS for the circles: `marker` is a point surely ON the shape (from the API). */
function markerData() {
  return {
    type: 'FeatureCollection',
    features: state.rows.map(({ feature, score, rank }) => ({
      type: 'Feature',
      id: feature.id, // the same id as the shape
      geometry: { type: 'Point', coordinates: feature.properties.marker },
      properties: { score, rank },
    })),
  };
}

// --- Start ------------------------------------------------------------------------------

async function init() {
  buildButtons();
  el.legend.innerHTML = legendHtml();
  setupControls();
  try {
    const [municipalities, nbs] = await Promise.all([
      getJSON(API.municipalitiesUrl),
      getJSON(API.nbsUrl),
    ]);
    setMunicipalities(municipalities);
    state.features = nbs.features;
    rerank();
    setStatus('');
    if (!selectFromAddress()) fitToNbs();
  } catch (error) {
    console.error(error);
    setStatus(`Could not load the data: ${error.message}`, true);
  }
}

function setMunicipalities(collection) {
  // MapLibre keeps only whole-number feature ids ("021051" would become 21051), so the
  // ISTAT code is copied into the properties, where a click can read it
  state.municipalities = {
    ...collection,
    features: collection.features.map((f) => ({ ...f, properties: { ...f.properties, istat_code: f.id } })),
  };
  for (const f of state.municipalities.features) state.municipalityByCode.set(f.id, f);
  map.getSource('municipalities')?.setData(state.municipalities);
}

function fitToNbs() {
  if (!state.features.length) return;
  const box = new maplibregl.LngLatBounds();
  for (const f of state.features) box.extend(boundsOf(f.geometry));
  map.fitBounds(box, { padding: mapPadding(50), maxZoom: 15, bearing: map.getBearing(), duration: 1200 });
}

/** The smallest box around a GeoJSON geometry of any type (walks the nested coordinates). */
function boundsOf(geometry) {
  const box = new maplibregl.LngLatBounds();
  const walk = (c) => (typeof c[0] === 'number' ? box.extend(c) : c.forEach(walk));
  walk(geometry.coordinates);
  return box;
}

const isPhone = () => window.matchMedia('(max-width: 800px)').matches;

/** Padding for flying the map. On phones an open sheet covers the lower part of the map. */
function mapPadding(space) {
  const sheet = isPhone() && el.sidebar.classList.contains('is-open') ? el.sidebar.offsetHeight : 0;
  return { top: space, left: space, right: space, bottom: space + sheet };
}

// --- Buttons: background and priorities ------------------------------------------------

function buildButtons() {
  for (const b of BASEMAPS) {
    groupButton(el.basemaps, b.label, b.key === state.basemap, () => {
      state.basemap = b.key;
      // A fresh copy, because MapLibre writes terrain and sky into the style object.
      // diff: false = build the new style from scratch, which fires 'style.load' (above).
      map.setStyle(structuredClone(b.style), { diff: false });
    });
  }
  for (const p of PRESETS) {
    groupButton(el.presets, p.label, p.key === PRESETS[0].key, () => {
      state.weights = { ...p.weights };
      rerank();
    });
  }
}

/** A button in a group where exactly one is pressed (like radio buttons). */
function groupButton(group, label, pressed, onPress) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'preset';
  button.textContent = label;
  button.setAttribute('aria-pressed', String(pressed));
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    for (const other of group.children) other.setAttribute('aria-pressed', String(other === button));
    onPress();
  });
  group.append(button);
}

function setupControls() {
  el.terrainToggle.addEventListener('change', applyTerrain);
  // Straight down (like a 2D map) <-> back to the tilted 3D view
  el.viewToggle.addEventListener('click', () => {
    map.easeTo(map.getPitch() > 5 ? { pitch: 0, bearing: 0 } : TILT);
  });
  map.on('pitchend', syncViewButton);
  syncViewButton();
  el.sheetHandle.addEventListener('click', () => setSheet(!el.sidebar.classList.contains('is-open')));
}

function syncViewButton() {
  el.viewToggle.textContent = map.getPitch() > 5 ? 'Look from above' : 'Tilt to 3D';
}

// --- Ranking: the browser ranks, the GPU recolours ------------------------------------

function rerank() {
  state.rows = rankNbs(state.features, state.weights);
  state.rowById = new Map(state.rows.map((row) => [row.feature.id, row]));
  // New scores into the map data: the colour expressions do the rest
  map.getSource('nbs')?.setData(nbsData());
  map.getSource('nbs-markers')?.setData(markerData());
  renderRanking(el.ranking, state.rows, {
    selectedId: state.selectedId,
    onSelect: selectNbs,
    onHover: (id, on) => setNbsState(id, { hover: on }), // hovering a card rings its circle
  });
  el.summary.innerHTML = summaryHtml(state.rows);
  // An open NbS popup shows the new points and score
  const row = state.rowById.get(state.selectedId);
  if (row && popup) popup.setHTML(popupHtml(row, state.rows.length));
}

// --- Selecting an NbS: fly there, then open its popup ----------------------------------

function selectNbs(id) {
  const row = state.rowById.get(id);
  if (!row) return;
  if (isPhone()) setSheet(false); // on phones: close the sheet, so the map is visible
  closePopup();
  setSelected(id);
  const { geometry, properties } = row.feature;
  // cameraForBounds: which centre and zoom show this box? (keeps the current rotation)
  const camera = geometry.type === 'Point'
    ? { center: properties.marker, zoom: Math.max(map.getZoom(), POINT_ZOOM) }
    : map.cameraForBounds(boundsOf(geometry), {
      padding: mapPadding(60), maxZoom: POINT_ZOOM, bearing: map.getBearing(),
    });
  map.flyTo({ ...camera, duration: 1600 });

  let opened = false;
  const open = () => {
    if (opened || state.selectedId !== id) return; // already open, or another NbS was picked
    opened = true;
    showPopup(properties.marker, popupHtml(state.rowById.get(id), state.rows.length),
      () => setSelected(null));
  };
  if (map.isMoving()) {
    map.once('moveend', open);
    setTimeout(open, 2500); // safety net: a flight can stall (e.g. in a hidden browser tab)
  } else {
    open(); // no flight ("reduce motion" is on: MapLibre jumps instead of flying)
  }
}

function setSelected(id) {
  if (state.selectedId !== null) setNbsState(state.selectedId, { selected: false });
  state.selectedId = id;
  if (id !== null) setNbsState(id, { selected: true });
  markSelectedCard(el.ranking, id);
  // The address can be shared: /map-3d/#nbs=12 opens this NbS directly
  history.replaceState(null, '', id ? `#nbs=${id}` : location.pathname);
}

/** Feature state = how a feature looks right now (selected, hover); no data are reloaded. */
function setNbsState(id, values) {
  if (!map.getSource('nbs')) return; // the background is switching; addOverlay() sets it again
  // Shape and circle share the id, so both light up
  map.setFeatureState({ source: 'nbs', id }, values);
  map.setFeatureState({ source: 'nbs-markers', id }, values);
}

function selectFromAddress() {
  const id = Number(new URLSearchParams(location.hash.slice(1)).get('nbs'));
  if (!state.rowById.has(id)) return false;
  selectNbs(id);
  return true;
}

/** One popup at a time. `onClose` runs only when the USER closes it (× button). */
function showPopup(lngLat, html, onClose) {
  closePopup();
  const current = new maplibregl.Popup({ maxWidth: '340px', offset: 16, closeOnClick: false })
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(map);
  current.on('close', () => {
    if (popup !== current) return; // closed by closePopup(), not by the user
    popup = null;
    onClose?.();
  });
  popup = current;
}

function closePopup() {
  const old = popup;
  popup = null; // first, so the popup's 'close' handler knows that we closed it
  old?.remove();
}

// --- Clicks and hover on the map ---------------------------------------------------------

/** The top NbS under the pointer. A small box, not one pixel: thin lines are easier to hit. */
function nbsAt(point) {
  if (!map.getLayer('nbs-marker')) return null; // the background is switching
  const box = [[point.x - 5, point.y - 5], [point.x + 5, point.y + 5]];
  return map.queryRenderedFeatures(box, { layers: NBS_LAYERS })[0] ?? null;
}

map.on('click', (event) => {
  const hit = nbsAt(event.point);
  if (hit) {
    selectNbs(hit.id);
    return;
  }
  closePopup();
  setSelected(null);
  if (!map.getLayer('municipality-fill')) return;
  const [place] = map.queryRenderedFeatures(event.point, { layers: ['municipality-fill'] });
  if (place) showMunicipality(place.properties.istat_code, event.lngLat);
});

function showMunicipality(code, lngLat) {
  const f = state.municipalityByCode.get(code);
  if (!f) return;
  const p = f.properties;
  showPopup(lngLat, `<div class="popup"><strong>${escapeHtml(p.name)}</strong>
    <div class="muted">ISTAT code ${escapeHtml(code)}</div>
    <p>Area: ${p.area_km2} km² · NbS: ${p.nbs_count}</p></div>`);
  map.fitBounds(boundsOf(f.geometry), { padding: mapPadding(30), bearing: map.getBearing(), duration: 1000 });
}

// Hover: a small dark label follows the mouse; the circle gets a dark ring
const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'map-tip', offset: 14 });

map.on('mousemove', (event) => {
  const hit = nbsAt(event.point);
  setHover(hit ? hit.id : null);
  const row = state.rowById.get(state.hoverId);
  if (!row) return;
  tip.setLngLat(event.lngLat)
    .setHTML(`${row.rank}. ${escapeHtml(row.feature.properties.name)} · score ${formatScore(row.score)}`);
  if (!tip.isOpen()) tip.addTo(map);
});
map.on('mouseout', () => setHover(null));

function setHover(id) {
  map.getCanvas().style.cursor = id === null ? '' : 'pointer';
  if (id === null) tip.remove();
  if (id === state.hoverId) return;
  if (state.hoverId !== null) setNbsState(state.hoverId, { hover: false });
  if (id !== null) setNbsState(id, { hover: true });
  state.hoverId = id;
}

// --- Panel on phones, status line ---------------------------------------------------------

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

// For exploring in the browser console (F12): dashboard.map, dashboard.state
window.dashboard = { map, state };

init();
