// Milestone 2: a static Leaflet map (no Django, no database yet).

// Leaflet wants [latitude, longitude], the OPPOSITE of GeoJSON and PostGIS,
// which use [longitude, latitude]. Mixing them up puts Merano in Somalia.
const MERANO = [46.6713, 11.1597];

// Create the map inside <div id="map">, centred on Merano at zoom level 10
const map = L.map('map').setView(MERANO, 10);

// Background map: OpenStreetMap tiles. {z} = zoom, {x}/{y} = tile column/row.
// The attribution is required by the OpenStreetMap licence.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// A marker to check that the coordinates are the right way round
L.marker(MERANO).addTo(map).bindPopup('Merano');
