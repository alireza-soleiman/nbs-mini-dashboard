// Team demo: exact ways to give the place of an NbS in the Admin mockup's form, next to
// drawing by hand. Each way ends with a GeoJSON geometry for the map (place-map.js):
//   - Search:      an address or a name -> OpenStreetMap's search service (Nominatim);
//                  if it knows the object, its real outline becomes the place
//   - Coordinates: longitude/latitude, or UTM metres (EPSG:25832, usual for local GIS data)
//   - File:        a GeoJSON file, e.g. exported from QGIS
// Nothing is saved. The search text is sent to nominatim.openstreetmap.org.

import { setDrawing, setShape } from './place-map.js';

const $ = (id) => document.getElementById(id);
// Only look inside South Tyrol: west, north, east, south
const SEARCH_BOX = '10.38,47.10,12.48,46.22';
// What the "example file" holds: the outline of a school sports hall in Merano
// (from OpenStreetMap, the same shape as sample NbS MER-07)
const EXAMPLE_FILE = {
  name: 'sports_hall.geojson',
  text: JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: 'School sports hall' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[11.155153, 46.672817], [11.155751, 46.672789], [11.155721, 46.672535],
          [11.155126, 46.672563], [11.155153, 46.672817]]],
      },
    }],
  }),
};

export function setupPlaceSources() {
  $('place-methods').addEventListener('click', (event) => {
    const button = event.target.closest('[data-method]');
    if (button) setMethod(button.dataset.method);
  });

  $('place-search-button').addEventListener('click', search);
  $('place-search-input').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault(); // Enter must not send the whole form
    search();
  });

  $('place-crs').addEventListener('change', labelCoordinates);
  $('place-coordinates-button').addEventListener('click', useCoordinates);
  labelCoordinates();

  $('place-file').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (file) useFile(file.name, file.size > 2e6 ? null : await file.text());
    event.target.value = ''; // the same file can be chosen again
  });
  $('place-file-example').addEventListener('click', () => useFile(EXAMPLE_FILE.name, EXAMPLE_FILE.text));
}

/** Back to "Draw on the map" with empty fields (when the form opens). */
export function resetPlaceSources() {
  $('place-search-input').value = '';
  $('place-search-results').replaceChildren();
  $('place-x').value = '';
  $('place-y').value = '';
  $('place-file-name').textContent = '';
  setMethod('draw');
}

function setMethod(method) {
  for (const button of $('place-methods').children) {
    button.setAttribute('aria-pressed', String(button.dataset.method === method));
  }
  for (const panel of document.querySelectorAll('.place-method')) panel.hidden = panel.dataset.for !== method;
  setDrawing(method === 'draw');
  showError('');
}

function showError(text) {
  $('place-error').textContent = text;
  $('place-error').hidden = !text;
}

// --- 1. Search an address or a place name ---------------------------------------------

async function search() {
  const text = $('place-search-input').value.trim();
  const list = $('place-search-results');
  showError('');
  if (!text) { showError('Type an address or the name of a place first.'); return; }
  list.innerHTML = '<li class="muted">Searching…</li>';
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q: text, format: 'jsonv2', limit: 5,
      polygon_geojson: 1,              // also send the outline, not only a centre point
      polygon_threshold: 0.00002,      // simplify outlines a little (about 2 m)
      viewbox: SEARCH_BOX, bounded: 1, // only results inside South Tyrol
    });
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`the search service answered HTTP ${response.status}`);
    const places = await response.json();
    if (!places.length) {
      list.innerHTML = '<li class="muted">Nothing found in South Tyrol. Try a street with the town, or another name.</li>';
      return;
    }
    list.replaceChildren(...places.map((place, i) => resultItem(place, i === 0)));
    pick(places[0]); // show the best match at once; the others can be clicked
  } catch (error) {
    list.replaceChildren();
    showError(`The search did not work (${error.message}). Is there an internet connection?`);
  }
}

function resultItem(place, first) {
  const geometry = place.geojson ?? { type: 'Point' };
  const kind = geometry.type.includes('Polygon') ? 'area' : geometry.type.includes('Line') ? 'line' : 'point';
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'place-result';
  button.setAttribute('aria-pressed', String(first));
  // textContent, never innerHTML: the names come from another server
  const name = document.createElement('span');
  name.textContent = place.display_name;
  const tag = document.createElement('small');
  tag.textContent = `${(place.type ?? '').replaceAll('_', ' ')} · ${kind}`;
  button.append(name, tag);
  button.addEventListener('click', () => {
    for (const other of $('place-search-results').querySelectorAll('.place-result')) {
      other.setAttribute('aria-pressed', String(other === button));
    }
    pick(place);
  });
  item.append(button);
  return item;
}

function pick(place) {
  const geometry = place.geojson ?? { type: 'Point', coordinates: [Number(place.lon), Number(place.lat)] };
  const exact = geometry.type === 'Point' ? 'a point at this address' : 'the outline from OpenStreetMap';
  setShape(geometry, `Found by search: ${exact}.`);
}

// --- 2. Type coordinates ---------------------------------------------------------------

/** The two fields are called differently in each coordinate system. */
function labelCoordinates() {
  const metres = $('place-crs').value === '25832';
  $('place-x-label').textContent = metres ? 'East (x), metres' : 'Longitude';
  $('place-y-label').textContent = metres ? 'North (y), metres' : 'Latitude';
  $('place-x').placeholder = metres ? '665194' : '11.1597';
  $('place-y').placeholder = metres ? '5170903' : '46.6713';
}

function useCoordinates() {
  const number = (id) => Number($(id).value.trim().replace(',', '.')); // 46,6713 is fine too
  const [x, y] = [number('place-x'), number('place-y')];
  showError('');
  if (!$('place-x').value.trim() || !$('place-y').value.trim() || Number.isNaN(x) || Number.isNaN(y)) {
    showError('Fill in both numbers.');
    return;
  }
  const metres = $('place-crs').value === '25832';
  const [lon, lat] = metres ? utm32ToLonLat(x, y) : [x, y];
  // A wide box around South Tyrol catches swapped or mistyped numbers
  if (!(lon > 9.5 && lon < 13.5 && lat > 45.5 && lat < 48)) {
    showError(metres
      ? 'These numbers are not near South Tyrol. East is about 600,000–760,000 and north about 5,120,000–5,220,000.'
      : 'These numbers are not near South Tyrol. Longitude is about 10–12.5 and latitude about 46–47 (are they swapped?).');
    return;
  }
  setShape({ type: 'Point', coordinates: [lon, lat] },
    metres ? `From coordinates in metres (EPSG:25832) = longitude ${lon.toFixed(5)}, latitude ${lat.toFixed(5)}.`
      : 'From the typed coordinates.');
}

/**
 * UTM zone 32N (ETRS89, EPSG:25832) in metres -> [longitude, latitude] in degrees.
 * The real project lets PostGIS do this (ST_Transform); a mockup has no database call,
 * so here is the same maths in the browser (Krüger series, accurate to millimetres).
 */
export function utm32ToLonLat(east, north) {
  const a = 6378137;                 // GRS80 ellipsoid: equator radius in metres
  const f = 1 / 298.257222101;       // flattening
  const k0 = 0.9996;                 // UTM scale factor
  const lon0 = (9 * Math.PI) / 180;  // central meridian of zone 32
  const n = f / (2 - f);
  const A = (a / (1 + n)) * (1 + n ** 2 / 4 + n ** 4 / 64);
  const beta = [n / 2 - (2 * n ** 2) / 3 + (37 * n ** 3) / 96, n ** 2 / 48 + n ** 3 / 15, (17 * n ** 3) / 480];
  const delta = [2 * n - (2 * n ** 2) / 3 - 2 * n ** 3, (7 * n ** 2) / 3 - (8 * n ** 3) / 5, (56 * n ** 3) / 15];
  const xi = north / (k0 * A);
  const eta = (east - 500000) / (k0 * A);
  let xi2 = xi;
  let eta2 = eta;
  beta.forEach((b, i) => {
    const j = 2 * (i + 1);
    xi2 -= b * Math.sin(j * xi) * Math.cosh(j * eta);
    eta2 -= b * Math.cos(j * xi) * Math.sinh(j * eta);
  });
  const chi = Math.asin(Math.sin(xi2) / Math.cosh(eta2));
  const lat = chi + delta.reduce((sum, d, i) => sum + d * Math.sin(2 * (i + 1) * chi), 0);
  const lon = lon0 + Math.atan(Math.sinh(eta2) / Math.cos(xi2));
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

// --- 3. Upload a file with the shape ------------------------------------------------------

function useFile(name, text) {
  showError('');
  $('place-file-name').textContent = name;
  try {
    if (text === null) throw new Error('The file is bigger than 2 MB: too big for one NbS.');
    const { geometry, count, fromMetres } = readGeoJson(text);
    setShape(geometry, `From the file ${name}`
      + (count > 1 ? ` (it has ${count} shapes; the first one is shown)` : '')
      + (fromMetres ? ', converted from metres (EPSG:25832).' : '.'));
  } catch (error) {
    showError(error.message);
  }
}

/** The first shape of a GeoJSON text, in lon/lat. Errors are sentences for the user. */
function readGeoJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This is not a GeoJSON file (it could not be read). In QGIS: Export → Save Features As → GeoJSON.');
  }
  const features = data?.type === 'FeatureCollection' ? data.features ?? [] : [data];
  const first = features[0];
  let geometry = first?.type === 'Feature' ? first.geometry : first;
  const known = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'];
  if (!geometry || !known.includes(geometry.type) || !Array.isArray(geometry.coordinates)) {
    throw new Error('No point, line or area was found in this file.');
  }
  // Numbers far above 180 cannot be degrees: they are metres, here most likely EPSG:25832
  const sample = geometry.coordinates.flat(Infinity);
  const fromMetres = Math.abs(sample[0]) > 180;
  if (fromMetres) {
    const convert = (c) => (typeof c[0] === 'number' ? utm32ToLonLat(c[0], c[1]) : c.map(convert));
    geometry = { type: geometry.type, coordinates: convert(geometry.coordinates) };
  }
  const [lon, lat] = geometry.coordinates.flat(Infinity);
  if (!(lon > 9.5 && lon < 13.5 && lat > 45.5 && lat < 48)) {
    throw new Error('The shape in this file is not near South Tyrol. Is the file in longitude/latitude (EPSG:4326) or EPSG:25832?');
  }
  return { geometry, count: features.length, fromMetres };
}
