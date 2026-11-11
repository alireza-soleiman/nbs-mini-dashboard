// Team demo: the map in the Admin mockup's "Add an NbS" form. A real Leaflet map on
// which you draw a point, a line or an area by clicking. Nothing is saved: it shows how
// adding a place could work.
//
// The municipality is found here in the browser (is the place inside this outline?).
// In the real project the database does that: NbS.save() asks PostGIS with ST_Contains.

import { formatArea, formatLength, formatSize } from './format.js';

const MERANO = [46.6713, 11.1597];  // Leaflet order: [lat, lng]
const SHAPE = { color: '#2a78d6', weight: 4, fillColor: '#2a78d6', fillOpacity: 0.3 };
const DOT = { radius: 5, color: '#ffffff', weight: 2, fillColor: '#2a78d6', fillOpacity: 1 };
const MODE_OF = { Point: 'point', LineString: 'line', Polygon: 'area' };
const $ = (id) => document.getElementById(id);

let municipalities = null;  // GeoJSON from /api/municipalities/
let map = null;             // made when the form is opened for the first time
let drawing = null;         // layer group: everything that is drawn
let mode = 'point';         // 'point' | 'line' | 'area'
let vertices = [];          // the clicked places (Leaflet LatLng objects)
let saved = null;           // the NbS that is being edited (its shape is shown until a click)

export function setupPlaceMap(municipalityCollection) {
  municipalities = municipalityCollection;
  $('place-modes').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (button) setMode(button.dataset.mode, { clear: true });
  });
  $('place-clear').addEventListener('click', () => {
    saved = null;
    vertices = [];
    redraw();
  });
}

/** Show the map for the form: empty for "Add", with the saved shape for "Edit". */
export function showPlace(feature) {
  if (!map) {
    // A Leaflet map needs a visible box with a height, so it is made now, not at page load
    map = L.map('place-map', { doubleClickZoom: false }).setView(MERANO, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.geoJSON(municipalities, {
      interactive: false,
      style: { color: '#6b6a66', weight: 1, fill: false },
      attribution: 'Boundaries &copy; <a href="https://www.istat.it/">ISTAT</a> 2026',
    }).addTo(map);
    drawing = L.layerGroup().addTo(map);
    map.on('click', (event) => addVertex(event.latlng));
  }
  map.invalidateSize(); // the form was hidden: tell Leaflet the size of the box now
  saved = feature ?? null;
  vertices = [];
  setMode(saved ? MODE_OF[saved.geometry.type] ?? 'area' : 'point', { clear: false });
  redraw();
  if (saved) {
    map.fitBounds(L.geoJSON(saved).getBounds(), { padding: [50, 50], maxZoom: 17, animate: false });
  } else {
    map.setView(MERANO, 13, { animate: false });
  }
}

function setMode(next, { clear }) {
  mode = next;
  for (const button of $('place-modes').children) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  if (clear) { // another kind of shape: start a new drawing
    saved = null;
    vertices = [];
    redraw();
  }
}

function addVertex(latlng) {
  saved = null;                         // the first click replaces the saved shape
  if (mode === 'point') vertices = [latlng];
  else vertices.push(latlng);
  redraw();
}

function redraw() {
  drawing.clearLayers();
  if (saved) {
    L.geoJSON(saved, { style: SHAPE, interactive: false, pointToLayer: (_, latlng) => L.circleMarker(latlng, { ...DOT, radius: 8 }) })
      .addTo(drawing);
  } else if (mode === 'point') {
    if (vertices.length) L.circleMarker(vertices[0], { ...DOT, radius: 8, interactive: false }).addTo(drawing);
  } else {
    // An area needs 3 corners; until then it is shown as a line
    const shape = mode === 'area' && vertices.length >= 3 ? L.polygon(vertices, SHAPE) : L.polyline(vertices, SHAPE);
    shape.options.interactive = false;
    shape.addTo(drawing);
    for (const vertex of vertices) L.circleMarker(vertex, { ...DOT, interactive: false }).addTo(drawing);
  }
  showInfo();
}

// --- The text under the map: what to do, municipality, size ------------------------------

function showInfo() {
  if (saved) {
    $('place-hint').textContent = 'This is the saved place. Click the map to draw a new one.';
    $('place-municipality').textContent = saved.properties.municipality ?? '–';
    $('place-size').textContent = formatSize(saved.properties);
    return;
  }
  const n = vertices.length;
  $('place-hint').textContent = {
    point: n ? 'Click again to move the point.' : 'Click the map to set the point.',
    line: n ? `${n} point${n === 1 ? '' : 's'}. Keep clicking to make the line longer.`
      : 'Click along a street or a river: each click adds a point.',
    area: n === 0 ? 'Click around the area, for example a roof: each click adds a corner.'
      : n < 3 ? `${n} corner${n === 1 ? '' : 's'}: an area needs at least 3.`
        : `${n} corners. Keep clicking to add more.`,
  }[mode];

  if (!n) {
    $('place-municipality').textContent = '–';
    $('place-size').textContent = '–';
    return;
  }
  // One place "in the middle" of the drawing decides the municipality
  const lat = vertices.reduce((sum, v) => sum + v.lat, 0) / n;
  const lng = vertices.reduce((sum, v) => sum + v.lng, 0) / n;
  $('place-municipality').textContent = municipalityAt(lng, lat) ?? 'outside South Tyrol';
  $('place-size').textContent = size();
}

/** The municipality whose outline contains the point (like ST_Contains in PostGIS). */
function municipalityAt(lng, lat) {
  // Ray casting: count how often a line from the point to the east crosses the outline.
  // An odd number of crossings = the point is inside.
  const inside = (ring) => {
    let isInside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) isInside = !isInside;
    }
    return isInside;
  };
  for (const feature of municipalities.features) {
    const { type, coordinates } = feature.geometry;
    const polygons = type === 'Polygon' ? [coordinates] : coordinates; // MultiPolygon: several parts
    // Inside the outer ring, and not inside a hole
    if (polygons.some(([outer, ...holes]) => inside(outer) && !holes.some(inside))) return feature.properties.name;
  }
  return null;
}

/** Length of the line or area of the polygon, in metres (roughly: good enough for a hint). */
function size() {
  if (mode === 'point') return 'single site';
  if (mode === 'line') {
    if (vertices.length < 2) return '–';
    const metres = vertices.slice(1).reduce((sum, v, i) => sum + map.distance(vertices[i], v), 0);
    return formatLength(Math.round(metres));
  }
  if (vertices.length < 3) return '–';
  // Degrees -> metres near this place, then the "shoelace" formula for the area
  const mx = 111320 * Math.cos((vertices[0].lat * Math.PI) / 180);
  const points = vertices.map((v) => [v.lng * mx, v.lat * 110574]);
  const twice = points.reduce((sum, [x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return sum + x * ny - nx * y;
  }, 0);
  return formatArea(Math.round(Math.abs(twice) / 2));
}
