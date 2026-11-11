// Team demo: the map in the Admin mockup's "Add an NbS" form. A real Leaflet map that
// shows the place of the NbS. The place can come from two directions:
//   - drawn here: click a point, a line or an area (the Point / Line / Area buttons)
//   - ready-made: setShape() with a GeoJSON geometry from a search, typed coordinates
//     or an uploaded file (place-sources.js), or the saved shape of the NbS ("Edit")
// Nothing is saved: it shows how giving a place could work.
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
let layer = null;           // layer group: everything that shows the place
let drawingOn = true;       // false while another way to give the place is chosen
let mode = 'point';         // what is drawn: 'point' | 'line' | 'area'
let vertices = [];          // the clicked places (Leaflet LatLng objects)
let shape = null;           // a ready-made place: { geometry, note, municipality?, size? }

export function setupPlaceMap(municipalityCollection) {
  municipalities = municipalityCollection;
  $('place-modes').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (button) setMode(button.dataset.mode, { clear: true });
  });
  $('place-clear').addEventListener('click', clearPlace);
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
    layer = L.layerGroup().addTo(map);
    map.on('click', (event) => addVertex(event.latlng));
  }
  map.invalidateSize(); // the form was hidden: tell Leaflet the size of the box now
  vertices = [];
  shape = feature ? {
    geometry: feature.geometry,
    note: 'This is the saved place. Draw a new one, or give the place in another way.',
    // The API already knows these exactly (PostGIS calculated them in metres)
    municipality: feature.properties.municipality ?? '–',
    size: formatSize(feature.properties),
  } : null;
  setMode(shape ? MODE_OF[shape.geometry.type] ?? 'area' : 'point', { clear: false });
  redraw();
  if (shape) fit(shape.geometry);
  else map.setView(MERANO, 13, { animate: false });
}

/** Show a ready-made place (GeoJSON geometry in lon/lat) and zoom to it. */
export function setShape(geometry, note) {
  shape = { geometry, note };
  vertices = [];
  redraw();
  fit(geometry);
}

export function clearPlace() {
  shape = null;
  vertices = [];
  redraw();
}

/** Drawing by clicking is only on while "Draw on the map" is the chosen way. */
export function setDrawing(on) {
  drawingOn = on;
  $('place-map').classList.toggle('is-drawing', on);
  showInfo();
}

function fit(geometry) {
  map.fitBounds(L.geoJSON(geometry).getBounds(), { padding: [50, 50], maxZoom: 17, animate: false });
}

function setMode(next, { clear }) {
  mode = next;
  for (const button of $('place-modes').children) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  if (clear) clearPlace(); // another kind of shape: start a new drawing
}

function addVertex(latlng) {
  if (!drawingOn) return;
  shape = null;                         // the first click replaces a ready-made place
  if (mode === 'point') vertices = [latlng];
  else vertices.push(latlng);
  redraw();
}

function redraw() {
  layer.clearLayers();
  if (shape) {
    L.geoJSON(shape.geometry, {
      style: SHAPE,
      interactive: false,
      pointToLayer: (_, latlng) => L.circleMarker(latlng, { ...DOT, radius: 8 }),
    }).addTo(layer);
  } else if (mode === 'point') {
    if (vertices.length) L.circleMarker(vertices[0], { ...DOT, radius: 8, interactive: false }).addTo(layer);
  } else {
    // An area needs 3 corners; until then it is shown as a line
    const drawn = mode === 'area' && vertices.length >= 3 ? L.polygon(vertices, SHAPE) : L.polyline(vertices, SHAPE);
    drawn.options.interactive = false;
    drawn.addTo(layer);
    for (const vertex of vertices) L.circleMarker(vertex, { ...DOT, interactive: false }).addTo(layer);
  }
  showInfo();
}

/** What was drawn so far as a GeoJSON geometry (null while it is not a shape yet). */
function drawnGeometry() {
  const points = vertices.map((v) => [v.lng, v.lat]);
  if (mode === 'point') return points.length ? { type: 'Point', coordinates: points[0] } : null;
  if (mode === 'line') return points.length >= 2 ? { type: 'LineString', coordinates: points } : null;
  return points.length >= 3 ? { type: 'Polygon', coordinates: [[...points, points[0]]] } : null;
}

// --- The text under the map: what to do, municipality, size ------------------------------

function showInfo() {
  const n = vertices.length;
  $('place-hint').textContent = shape ? shape.note : !drawingOn ? '' : {
    point: n ? 'Click again to move the point.' : 'Click the map to set the point.',
    line: n ? `${n} point${n === 1 ? '' : 's'}. Keep clicking to make the line longer.`
      : 'Click along a street or a river: each click adds a point.',
    area: n === 0 ? 'Click around the area, for example a roof: each click adds a corner.'
      : n < 3 ? `${n} corner${n === 1 ? '' : 's'}: an area needs at least 3.`
        : `${n} corners. Keep clicking to add more.`,
  }[mode];

  const geometry = shape?.geometry ?? drawnGeometry();
  // Every [lon, lat] of the place; a drawing that is not a shape yet still has its clicks
  const points = geometry ? positions(geometry) : vertices.map((v) => [v.lng, v.lat]);
  if (!points.length) {
    $('place-municipality').textContent = '–';
    $('place-size').textContent = '–';
    return;
  }
  // One place "in the middle" decides the municipality
  const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  $('place-municipality').textContent = shape?.municipality ?? municipalityAt(lng, lat) ?? 'outside South Tyrol';
  $('place-size').textContent = shape?.size ?? (geometry ? sizeOf(geometry) : '–');
}

/** All [lon, lat] pairs of a GeoJSON geometry, whatever its type. */
function positions(geometry) {
  const flat = (c) => (typeof c[0] === 'number' ? [c] : c.flatMap(flat));
  return flat(geometry.coordinates);
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

/** Length of lines or area of polygons, as text (roughly: good enough for a hint). */
function sizeOf(geometry) {
  const length = (line) => line.slice(1).reduce(
    (sum, p, i) => sum + map.distance([line[i][1], line[i][0]], [p[1], p[0]]), 0);
  const ringArea = (ring) => {
    // Degrees -> metres near this place, then the "shoelace" formula
    const mx = 111320 * Math.cos((ring[0][1] * Math.PI) / 180);
    const xy = ring.map(([lng, lat]) => [lng * mx, lat * 110574]);
    return Math.abs(xy.reduce((sum, [x, y], i) => {
      const [nx, ny] = xy[(i + 1) % xy.length];
      return sum + x * ny - nx * y;
    }, 0)) / 2;
  };
  const polygonArea = ([outer, ...holes]) => ringArea(outer) - holes.reduce((sum, hole) => sum + ringArea(hole), 0);
  const { type, coordinates } = geometry;
  if (type === 'Point' || type === 'MultiPoint') return 'single site';
  if (type === 'LineString') return formatLength(Math.round(length(coordinates)));
  if (type === 'MultiLineString') return formatLength(Math.round(coordinates.reduce((sum, line) => sum + length(line), 0)));
  if (type === 'Polygon') return formatArea(Math.round(polygonArea(coordinates)));
  if (type === 'MultiPolygon') return formatArea(Math.round(coordinates.reduce((sum, polygon) => sum + polygonArea(polygon), 0)));
  return '–';
}
