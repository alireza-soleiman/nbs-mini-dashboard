# Sample data

**`nbs_sample.csv` is fictional.** The 12 Nature-Based Solutions around Merano were
invented for this learning project: they are not real projects, and their costs and
benefit scores are rough illustrations, not measured values.

Columns:

| Column | Meaning |
|---|---|
| `name` | short description, used as the key when the file is loaded again |
| `nbs_type` | one of the values in `catalog.models.NbS.Type` (e.g. `green_roof`) |
| `lon`, `lat` | location in EPSG:4326 (degrees, longitude first) |
| `cost_eur` | estimated total cost in euro |
| `benefit_*` | scores from 0 (none) to 5 (very high) for heat, flood, biodiversity, wellbeing |
| `description` | one sentence |

Load it with:

```
docker compose exec web python manage.py load_sample_nbs
```
