// Milestone 2: a static Leaflet map (no Django, no database yet).
// It draws the 116 municipalities of South Tyrol from a GeoJSON file.

// Leaflet wants [latitude, longitude], the OPPOSITE of GeoJSON and PostGIS,
// which use [longitude, latitude]. Mixing them up puts Merano in Somalia.
const MERANO = [46.6713, 11.1597];
const MERANO_ISTAT_CODE = '021051';

// Create the map inside <div id="map">, centred on Merano at zoom level 10
const map = L.map('map').setView(MERANO, 10);

// Background map: OpenStreetMap tiles. {z} = zoom, {x}/{y} = tile column/row.
// The attribution is required by the OpenStreetMap licence.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// --- Municipalities ----------------------------------------------------

const baseStyle = { color: '#2e6b3a', weight: 1, fillColor: '#2e6b3a', fillOpacity: 0.08 };
const meranoStyle = { ...baseStyle, weight: 2.5, fillOpacity: 0.3 };
const hoverStyle = { weight: 3, fillOpacity: 0.45 };

let municipalities; // the Leaflet GeoJSON layer, created after loading

// Leaflet calls this for every feature, so the style can depend on the data
function styleMunicipality(feature) {
  return feature.properties.istat_code === MERANO_ISTAT_CODE ? meranoStyle : baseStyle;
}

// Leaflet calls this once per feature: attach a tooltip, a popup and hover events
function onEachMunicipality(feature, layer) {
  const { name, istat_code } = feature.properties;
  layer.bindTooltip(name, { sticky: true });
  layer.bindPopup(`<strong>${name}</strong><br>ISTAT code: ${istat_code}`);
  layer.on({
    mouseover: (event) => event.target.setStyle(hoverStyle),
    mouseout: (event) => municipalities.resetStyle(event.target),
  });
}

async function loadMunicipalities() {
  // fetch() asks the web server for the file (this is why we need http://, not file://)
  const response = await fetch('data/municipalities.geojson');
  if (!response.ok) {
    throw new Error(`Could not load municipalities: HTTP ${response.status}`);
  }
  const geojson = await response.json();

  // L.geoJSON turns each GeoJSON feature into a Leaflet layer
  // and swaps [lng, lat] to [lat, lng] for us
  municipalities = L.geoJSON(geojson, {
    style: styleMunicipality,
    onEachFeature: onEachMunicipality,
    attribution: 'Boundaries &copy; <a href="https://www.istat.it/">ISTAT</a> 2026',
  }).addTo(map);

  // Zoom out so that the whole of South Tyrol is visible
  map.fitBounds(municipalities.getBounds());
}

loadMunicipalities().catch((error) => console.error(error));
