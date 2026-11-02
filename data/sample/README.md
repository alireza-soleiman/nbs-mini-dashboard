# Sample data

**The NbS in `nbs_sample.geojson` are fictional, their places are real.** The 29
Nature-Based Solutions in 11 municipalities around Merano were invented for this learning
project: no municipality, school, company or institution has planned them, and the
costs and benefit scores are illustrations, not measurements.

Each shape, however, is a **real OpenStreetMap feature**: a green roof is the outline of a
real building, a green facade one of its walls, street trees a stretch of a real street,
a river restoration a stretch of the real river, a park or wetland a real piece of land.
So the shapes match the buildings and streets on the map. The `osm` property names the
source, e.g. `way/646089952` → https://www.openstreetmap.org/way/646089952.

**Licence of the shapes:** © OpenStreetMap contributors, Open Database Licence (ODbL) 1.0,
https://www.openstreetmap.org/copyright. This file is a derived database, so it is
shared under the ODbL as well.

Format: GeoJSON, EPSG:4326 (longitude, latitude). Each feature is a **Point** (rain
gardens), **LineString** (street trees, rivers, facades) or **Polygon** (roofs, car parks,
parks, ponds, wetlands). You can open and edit it in **QGIS** (Layer → Add Vector Layer).

Properties:

| Property | Meaning |
|---|---|
| `code` | unique key, e.g. `MER-01` (municipality + number); used to update on reload |
| `name` | what and where |
| `nbs_type` | one of the values in `catalog.models.NbS.Type` (e.g. `green_roof`) |
| `description` | one sentence |
| `cost_eur` | estimated total cost in euro: unit cost of the type × real size, rounded to €5,000 |
| `benefit_heat`, `benefit_flood`, `benefit_biodiversity`, `benefit_wellbeing` | 0 (none) … 5 (very high) |
| `osm` | the OpenStreetMap element(s) the shape comes from (not loaded into the database) |

The shapes and costs are made by `scripts/build_sample_shapes.py` (it downloads the OSM
elements once into `data/raw/osm/`, which is not in Git). Load the file with:

```
docker compose exec web python manage.py load_sample_nbs
```

Add `--replace` to delete all existing NbS first (also the ones added by hand).
