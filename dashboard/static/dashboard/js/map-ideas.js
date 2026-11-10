// Team demo: ideas for the map page, switched on in the "More ideas" box
// ("Mockup – sample data"). map.js calls setupIdeas() once and asks `ideas` how to
// explain a score. Nothing here is saved, and the heat values are INVENTED.
//
//   Heat vulnerability   detailed zones or whole municipalities, under the NbS
//   Map background       OpenStreetMap or satellite photos
//   Set priorities with  sliders or cards in order of importance (a simple Simos idea)
//   Explain a score with the table of points or one bar split by criterion

import { CRITERION_COLORS, splitBar } from './mockup-charts.js';
import { CRITERIA } from './ranking.js';
import { formatScore } from './format.js';

/** What map.js needs to know while it draws. */
export const ideas = { scoreAsBar: false, cards: false };

// Yellow -> red for heat, so it is never mixed up with the blue of the scores
const HEAT = ['#fff0b8', '#fdd27a', '#f9a03f', '#e8601c', '#b3200f'];
const CARD_WEIGHTS = [10, 8, 6, 4, 2]; // weight by position: first card = most important

let context = null;        // { map, osmLayer, municipalities, getWeights, setWeights, redraw }
let heatLayer = null;      // the heat layer on the map (zones or municipalities)
let satelliteLayer = null;
let cardOrder = CRITERIA.map((c) => c.key);

export function setupIdeas(ctx) {
  context = ctx;
  ctx.map.createPane('vulnerability').style.zIndex = 340; // below outlines (350) and NbS (400)

  choice('idea-heat', ['Off', 'Detailed zones', 'By municipality'], (i) => showHeat(['off', 'zones', 'places'][i]));
  choice('idea-background', ['Map', 'Satellite'], (i) => showSatellite(i === 1));
  choice('idea-priorities', ['Sliders', 'Cards'], (i) => showCards(i === 1));
  choice('idea-score', ['Table', 'Bar'], (i) => {
    ideas.scoreAsBar = i === 1;
    ctx.redraw(); // an open popup shows the other explanation at once
  });
}

/** A group of buttons where exactly one is pressed (like radio buttons). */
function choice(id, labels, onPick) {
  const group = document.getElementById(id);
  labels.forEach((label, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(i === 0));
    button.addEventListener('click', () => {
      for (const other of group.children) other.setAttribute('aria-pressed', String(other === button));
      onPick(i);
    });
    group.append(button);
  });
}

// --- Heat vulnerability (invented values) ---------------------------------------------

function showHeat(mode) {
  heatLayer?.remove();
  heatLayer = mode === 'zones' ? heatZones() : mode === 'places' ? heatPlaces() : null;
  heatLayer?.addTo(context.map);
  const legend = document.getElementById('idea-heat-legend');
  legend.hidden = !heatLayer;
  legend.innerHTML = `<span class="legend-title">Heat</span><span>low</span>${
    HEAT.map((color) => `<span class="heat-swatch" style="background:${color}"></span>`).join('')
  }<span>high</span><span class="muted">· invented values</span>`;
}

/** Zones: a grid of ~400 m cells. The value is made up: high near the built-up centres. */
function heatZones() {
  const centres = [ // [lon, lat, strength, reach in degrees]
    [11.160, 46.671, 1.00, 0.016], [11.172, 46.657, 0.85, 0.014], [11.190, 46.641, 0.70, 0.010],
    [11.152, 46.614, 0.80, 0.012], [11.128, 46.682, 0.60, 0.009], [11.143, 46.652, 0.50, 0.008],
    [11.187, 46.610, 0.45, 0.008], [11.147, 46.632, 0.40, 0.007],
  ];
  const [dLon, dLat] = [0.0052, 0.0036]; // about 400 m x 400 m here
  const group = L.layerGroup();
  for (let lon = 11.095; lon < 11.225; lon += dLon) {
    for (let lat = 46.592; lat < 46.702; lat += dLat) {
      const [x, y] = [lon + dLon / 2, lat + dLat / 2];
      let value = 0;
      for (const [cx, cy, strength, reach] of centres) {
        const d2 = ((x - cx) * 0.69) ** 2 + (y - cy) ** 2; // 0.69: a longitude degree is shorter
        value = Math.max(value, strength * Math.exp(-d2 / (2 * reach * reach)));
      }
      value += 0.08 * Math.sin(x * 2371) * Math.cos(y * 1873); // a little unevenness, always the same
      if (value < 0.2) continue; // cool cells stay empty
      const level = Math.min(4, Math.floor((value - 0.2) / 0.16));
      L.rectangle([[lat, lon], [lat + dLat, lon + dLon]], {
        pane: 'vulnerability', interactive: false, stroke: false, fillColor: HEAT[level], fillOpacity: 0.55,
      }).addTo(group);
    }
  }
  return group;
}

/** Whole municipalities. The value is made up from the area: small valley towns = hot. */
function heatPlaces() {
  const level = (km2) => (km2 < 12 ? 4 : km2 < 28 ? 3 : km2 < 60 ? 2 : km2 < 120 ? 1 : 0);
  return L.geoJSON(context.municipalities, {
    pane: 'vulnerability',
    interactive: false,
    style: (feature) => ({ stroke: false, fillColor: HEAT[level(feature.properties.area_km2)], fillOpacity: 0.5 }),
  });
}

// --- Map background ---------------------------------------------------------------------

function showSatellite(on) {
  const { map, osmLayer } = context;
  satelliteLayer ??= L.tileLayer(
    // WMTS address order is {z}/{y}/{x}: row before column
    'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg', {
      maxNativeZoom: 15, // 10 m pixels: closer zooms only enlarge the picture
      maxZoom: 19,
      attribution: 'Sentinel-2 cloudless 2023 by <a href="https://cloudless.eox.at">EOX IT Services GmbH</a> '
        + '(contains modified Copernicus Sentinel data 2023), CC BY-NC-SA 4.0',
    });
  (on ? osmLayer : satelliteLayer).remove();
  (on ? satelliteLayer : osmLayer).addTo(map);
}

// --- Priorities as cards ------------------------------------------------------------------

function showCards(on) {
  ideas.cards = on;
  document.getElementById('weights').hidden = on;
  document.getElementById('cards').hidden = !on;
  if (on) {
    // Start from the current weights: heaviest criterion first
    const weights = context.getWeights();
    cardOrder = CRITERIA.map((c) => c.key).sort((a, b) => weights[b] - weights[a]);
    applyCards();
  }
}

/** The card order becomes the weights 10, 8, 6, 4, 2, and the map re-ranks. */
function applyCards() {
  context.setWeights(Object.fromEntries(cardOrder.map((key, i) => [key, CARD_WEIGHTS[i]])));
}

/** Draw the cards (map.js calls this after every change of the weights). */
export function syncCards() {
  if (!ideas.cards) return;
  const weights = context.getWeights();
  const total = CRITERIA.reduce((sum, c) => sum + weights[c.key], 0) || 1;
  // A preset changes the weights: the cards follow, heaviest first
  cardOrder = [...cardOrder].sort((a, b) => weights[b] - weights[a]);
  const list = document.getElementById('cards-list');
  list.replaceChildren(...cardOrder.map((key, i) => {
    const criterion = CRITERIA.find((c) => c.key === key);
    const card = document.createElement('li');
    card.className = 'priority-card';
    card.innerHTML = `<span class="card-place">${i + 1}</span>
      <span class="swatch" style="background:${CRITERION_COLORS[key]}"></span>
      <span class="card-title">${criterion.label}</span>
      <span class="weight-share">${Math.round((100 * weights[key]) / total)} %</span>
      <button type="button" data-move="-1" aria-label="Move ${criterion.label} up" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button type="button" data-move="1" aria-label="Move ${criterion.label} down" ${i === cardOrder.length - 1 ? 'disabled' : ''}>▼</button>`;
    card.addEventListener('click', (event) => {
      const move = Number(event.target.dataset?.move);
      if (!move) return;
      [cardOrder[i], cardOrder[i + move]] = [cardOrder[i + move], cardOrder[i]];
      applyCards();
      // Keep the keyboard on the card that moved
      list.children[i + move]?.querySelector(`[data-move="${move}"]:not(:disabled), button:not(:disabled)`)?.focus();
    });
    return card;
  }));
}

// --- Explaining a score with one bar ----------------------------------------------------

/** For the popup: the score as one bar split by criterion, with the points as a key. */
export function scoreBarHtml(row, total) {
  const key = CRITERIA.map((c) => `<li><span class="swatch" style="background:${CRITERION_COLORS[c.key]}"></span>
    <span>${c.label}</span><span class="num">${row.score === null ? '–' : row.parts[c.key].toFixed(1)}</span></li>`).join('');
  return `<div class="score-bar">
    <div class="score-bar-head"><span>Score · rank ${row.rank} of ${total}</span><strong>${formatScore(row.score)}</strong></div>
    ${splitBar(row)}
    <ul>${key}</ul></div>`;
}
