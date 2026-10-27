# Sample data

**`nbs_sample.geojson` is fictional.** The 29 Nature-Based Solutions in 11
municipalities around Merano were invented for this learning project. The place names
(districts, rivers, villages) are real, but the projects are not: there is no real
school, company or institution behind them, and the shapes were drawn by a script, not
taken from real buildings or streets. Costs are rough unit costs × size; benefit scores
are illustrations, not measurements.

Format: GeoJSON, EPSG:4326 (longitude, latitude). Each feature is a **Point** (3),
**LineString** (12, e.g. street trees, rivers, facades) or **Polygon** (14, e.g. roofs,
parks, wetlands). You can open and edit it in **QGIS** (Layer → Add Vector Layer).

Properties:

| Property | Meaning |
|---|---|
| `code` | unique key, e.g. `MER-01` (municipality + number); used to update on reload |
| `name` | what and where |
| `nbs_type` | one of the values in `catalog.models.NbS.Type` (e.g. `green_roof`) |
| `description` | one sentence |
| `cost_eur` | estimated total cost in euro |
| `benefit_heat`, `benefit_flood`, `benefit_biodiversity`, `benefit_wellbeing` | 0 (none) … 5 (very high) |

Load it with:

```
docker compose exec web python manage.py load_sample_nbs
```

Add `--replace` to delete all existing NbS first (also the ones added by hand).
