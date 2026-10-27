# How to work with the NbS mini-dashboard

This guide explains **where the data comes from, how it reaches the map, how to change
it, and how to test every feature**. For the first installation see the
[README](../README.md).

Contents:
1. [The big picture](#1-the-big-picture)
2. [Start and stop](#2-start-and-stop)
3. [The dashboard, feature by feature](#3-the-dashboard-feature-by-feature)
4. [How the score is calculated](#4-how-the-score-is-calculated)
5. [Where each thing on the screen comes from](#5-where-each-thing-on-the-screen-comes-from)
6. [Changing the data and the dashboard](#6-changing-the-data-and-the-dashboard)
7. [Testing all features](#7-testing-all-features)
8. [When something goes wrong](#8-when-something-goes-wrong)
9. [Where to find things in the code](#9-where-to-find-things-in-the-code)

---

## 1. The big picture

```
 SOURCES                    IMPORT (once)                  DATABASE (PostGIS, Docker)
 ─────────                  ─────────────                  ──────────────────────────
 ISTAT zip (boundaries) ──► import_municipalities ──────► catalog_municipality  (116, metres)
 nbs_sample.csv (NbS)   ──► load_sample_nbs ─────────────► catalog_nbs           (12, metres)
 Admin (by hand)        ──► NbS.save() finds the municipality ─┘
                                                                │
 API (Django REST Framework)                                    ▼
 ───────────────────────────                     converts metres → degrees (EPSG:4326)
 /api/municipalities/   /api/nbs/?type=…&municipality=…   /api/nbs-types/
                                │
 DASHBOARD (browser, JavaScript)▼
 ───────────────────────────────
 dashboard.js loads the three API addresses ──► Leaflet draws outlines + markers
 weight sliders ──► ranking.js calculates the scores in the browser ──► colours + list
```

Three ideas to remember:

- **Stored in metres, shown in degrees.** The database keeps geometries in EPSG:25832
  (metres), so areas and distances are correct. The API converts them to EPSG:4326
  (longitude/latitude), which GeoJSON and Leaflet need.
- **Filters run on the server, ranking runs in the browser.** Changing a filter asks the
  API for a new list of NbS. Moving a weight slider only recalculates in the browser, so
  it is instant.
- **The map only knows the API.** The JavaScript never reads the database. If the API
  keeps the same shape, the database can change without touching the map.

## 2. Start and stop

```
docker compose up -d      # start db + web in the background
docker compose ps         # both should be "Up"; db should be "(healthy)"
docker compose logs -f web   # watch Django's output (Ctrl+C to stop watching)
docker compose down       # stop; the data stays in the Docker volume nbs_pgdata
```

Docker Desktop must be running first. Every Django command runs **inside** the `web`
container:

```
docker compose exec web python manage.py <command>
```

> ⚠️ `docker compose down -v` also deletes the volume = **all database data is lost**.

## 3. The dashboard, feature by feature

Open **http://localhost:8000**.

| Part | What it does |
|---|---|
| **Map** | OpenStreetMap background, the 116 municipality outlines (grey), and one round marker per NbS. |
| **Municipality outlines** | Hover = name. Click = popup with area (km²), number of NbS and ISTAT code. |
| **NbS markers** | Colour = score (darker blue = better for your weights). The top three show their rank number 1, 2, 3. Hover = rank, name, score. Click = popup with all values and **how many points each criterion gave**. |
| **1 · Filter: NbS type** | One checkbox per type (with how many exist). Untick types to hide them. |
| **1 · Filter: Municipality** | Show only the NbS of one municipality; the map zooms to it and draws its border thicker. Only municipalities that have NbS are listed. |
| **2 · Weights** | One slider (0–10) per criterion. The percentage on the right is the real share of that weight among all weights. "Equal weights" sets all back to 5. |
| **3 · Ranking** | All shown NbS, best first, with type, municipality, cost and a score bar. Click an entry = the map zooms to it and opens its popup. Hover = its marker gets a dark ring. |
| **Legend** | The four score colours: 0–25, 25–50, 50–75, 75–100. |
| **Status line** | Appears at the top of the panel while loading, on errors, or when all weights are 0. |

The page also works on a phone: the map is on top, the panel below.

## 4. How the score is calculated

The method is a **weighted sum** (also called *Simple Additive Weighting*).

1. Every criterion becomes a value from **0 (worst) to 1 (best)**:
   - a benefit (score 0–5) → `score / 5`
   - the cost → the **cheapest shown NbS gets 1, the most expensive gets 0**, the others
     in between
2. Each value is multiplied by its weight.
3. `score = (sum of weight × value) / (sum of weights) × 100` → a number from 0 to 100.

**Example** (equal weights, all 5): *Street trees on the river promenade* has heat 5,
flood 2, biodiversity 3, wellbeing 5, cost 95,000 €. Its popup shows the points:

| Criterion | Value | Points |
|---|---|---|
| Heat reduction | 5 / 5 | 20.0 |
| Flood & stormwater | 2 / 5 | 8.0 |
| Biodiversity | 3 / 5 | 12.0 |
| Health & wellbeing | 5 / 5 | 20.0 |
| Low cost | 95,000 € | 18.8 |
| **Score** | | **79** |

Each criterion can give at most `100 × its share of the weights` points: with five equal
weights, at most 20 each.

Good to know:
- The cost is compared **only among the NbS currently shown**. A filter can therefore
  change the cost points (and the ranking) of the remaining NbS.
- Equal scores are ordered alphabetically, so the list does not jump around.
- If all weights are 0, there is no score: the markers turn grey and a message appears.

## 5. Where each thing on the screen comes from

| On the screen | API address | Database table | Original source |
|---|---|---|---|
| Grey outlines, municipality popups, municipality dropdown | `/api/municipalities/` | `catalog_municipality` | ISTAT zip → `import_municipalities` |
| Type checkboxes and their counts | `/api/nbs-types/` | list in `catalog/models.py` (`NbS.Type`) + counts from `catalog_nbs` | code |
| Markers, list, popups | `/api/nbs/?type=…&municipality=…` | `catalog_nbs` | `data/sample/nbs_sample.csv` → `load_sample_nbs`, or the admin |
| Scores, colours, ranks | (calculated in the browser) | — | `dashboard/static/dashboard/js/ranking.js` |
| Background map | tile.openstreetmap.org | — | OpenStreetMap |

You can open every API address in the browser to see the exact data the map receives.

## 6. Changing the data and the dashboard

After a data change, **reload the dashboard page** (F5) to see it.

### 6.1 Add, change or delete one NbS (no code)

1. Open http://localhost:8000/admin/ and log in (`DJANGO_SUPERUSER_USERNAME` and
   `DJANGO_SUPERUSER_PASSWORD` in your `.env`).
2. **NbS → Add NbS** (or click an existing one).
3. Fill in name, type, cost, the four benefits (0–5), and **click on the map** to place
   it. Save.
4. The **municipality is filled in automatically** from the location (`NbS.save()`).
   Outside South Tyrol it stays empty.

### 6.2 Change many NbS at once (CSV)

1. Edit `data/sample/nbs_sample.csv` (Excel or a text editor; keep the columns; lon/lat
   in degrees, longitude first).
2. Run `docker compose exec web python manage.py load_sample_nbs`.
3. Rows are matched **by name**: an existing name is updated, a new name is created.
   Removing a row from the CSV does **not** delete the NbS (delete it in the admin).
   A wrong type or a benefit above 5 stops the whole load with an error, and nothing
   is changed.

### 6.3 Use your own NbS data

Make a CSV with the same columns (see `data/sample/README.md`) and either replace
`nbs_sample.csv` or change `CSV_FILE` in
`catalog/management/commands/load_sample_nbs.py`.

### 6.4 Add a new NbS type

1. Add a line to `NbS.Type` in `catalog/models.py`, e.g.
   `BIOSWALE = 'bioswale', 'Bioswale'`.
2. `docker compose exec web python manage.py makemigrations catalog`
3. `docker compose exec web python manage.py migrate`
4. Reload the dashboard: the new checkbox appears by itself (it comes from
   `/api/nbs-types/`).

### 6.5 Add a new criterion (e.g. "CO₂ storage")

This touches five places, because a criterion lives in the database, the API, the
loader and the ranking:

1. `catalog/models.py`: `benefit_co2 = benefit_field('CO2 storage')`, then
   `makemigrations` + `migrate` (existing rows need a value: Django will ask for a
   default, e.g. 0).
2. `catalog/serializers.py`: add `'benefit_co2'` to `NbSSerializer.Meta.fields`.
3. `catalog/management/commands/load_sample_nbs.py`: add it to `BENEFITS`.
4. `data/sample/nbs_sample.csv`: add a `benefit_co2` column.
5. `dashboard/static/dashboard/js/ranking.js`: add
   `{ key: 'benefit_co2', label: 'CO₂ storage', kind: 'benefit' }` to `CRITERIA`.
   The slider, popup row and score use this list automatically.

### 6.6 Change the ranking settings

| What | Where |
|---|---|
| Start weight of the sliders (now 5) | `DEFAULT_WEIGHT` in `ranking.js` |
| Slider range (now 0–10) | `min`/`max` in `buildWeightSliders()` in `dashboard.js` |
| How a criterion is turned into 0–1 | `normalise()` in `ranking.js` |
| Score colours and class limits | `SCORE_CLASSES` in `dashboard.js` (keep one hue, light → dark) |

### 6.7 New municipality boundaries (e.g. a newer ISTAT year)

1. Download the new zip into `data/raw/`.
2. Change `SOURCE` in `catalog/management/commands/import_municipalities.py`.
3. `docker compose exec web python manage.py import_municipalities`
   (municipalities are updated by ISTAT code; the NbS keep their links).
4. To recalculate which municipality each NbS is in, run `load_sample_nbs` again (or
   open and save each NbS in the admin).

Municipality **boundaries cannot be edited in the admin** on purpose (a click on the map
once added a fake part to a municipality). Names can still be edited there.

### 6.8 Start again from an empty database

```
docker compose down -v                 # ⚠️ deletes ALL data
docker compose up -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py import_municipalities
docker compose exec web python manage.py load_sample_nbs
docker compose exec web python manage.py createsuperuser --noinput
```

## 7. Testing all features

### 7.1 Automated tests (1 minute)

```
docker compose exec web python manage.py test
```

Expected: `Ran 15 tests … OK`. They run in a separate, empty test database and check:
the GeoJSON and its lon/lat coordinates, one SQL query per list (no N+1), the
municipality found from the location, all API filters and their error messages
(400), the municipality and type endpoints, the locked boundaries in the admin, and
that the dashboard page and its files are delivered.

The ranking maths runs in the browser and is checked with the manual steps below.

### 7.2 Manual checklist with the sample data

Start from the original sample data (12 NbS). Tick each line.

**Loading**
- [ ] http://localhost:8000 shows the map with grey outlines and **12 markers** around
      Merano, and the ranking says **(12)**.
- [ ] No red message at the top of the panel.

**Ranking (equal weights)**
- [ ] 1 = *Street trees on the river promenade* **79**, 2 = *Pocket park in a dense
      neighbourhood* **75**, 3 = *Street trees in the village centre* **71**;
      last (12) = *Permeable paving in a car park* **50**.
- [ ] The three best markers show 1, 2, 3; darker markers have higher scores.
- [ ] Click entry 1 in the list → the map zooms in and the popup shows the points
      20.0 / 8.0 / 12.0 / 20.0 / 18.8 and score 79.

**Weights**
- [ ] Set *Flood & stormwater* to 10 and all others to 0 → its share shows **100 %**,
      and the top three all have **100**: *Retention pond…*, *River restoration along
      the Adige*, *Wetland restoration…*.
- [ ] Set every slider to 0 → message "All weights are 0…" and grey markers.
- [ ] Click **Equal weights** → back to the first ranking (79, 75, 71).

**Filters**
- [ ] Untick everything except *Green roof* → **2** NbS.
- [ ] Also choose municipality *Merano/Meran (5)* → **1** NbS (*Green roof on a school
      building*), the map zooms to Merano and its border is drawn thick.
- [ ] Tick all types again (Merano still selected) → **5** NbS.
- [ ] Choose *All municipalities* → **12** NbS.
- [ ] Untick all types → "No NbS match the filters."

**Map**
- [ ] Hover a municipality → its name. Click it → area, number of NbS, ISTAT code
      (Merano: 25.98 km², 5 NbS, 021051).
- [ ] Hover a list entry → its marker gets a dark ring.

**Admin and data flow**
- [ ] In the admin, add a test NbS by clicking somewhere in Merano → after saving, its
      municipality is *Merano/Meran*. Reload the dashboard → **13** NbS, and the new one
      is in the list. Delete it afterwards.
- [ ] Open a municipality in the admin → the map shows its border but you cannot draw;
      the help text says it comes from ISTAT.

**API directly** (in the browser)
- [ ] http://localhost:8000/api/nbs/ → `"type": "FeatureCollection"` with 12 features.
- [ ] http://localhost:8000/api/nbs/?type=green_roof → 2 features.
- [ ] http://localhost:8000/api/nbs/?near=11.1597,46.6713&radius=1000 → 3 features
      (within 1 km of the school).
- [ ] http://localhost:8000/api/nbs/?type=green_rooof → error 400 with the list of
      valid types.
- [ ] http://localhost:8000/api/municipalities/021051/ → Merano, `"area_km2": 25.98`.

**Phone**
- [ ] Make the browser window narrow (or use the phone view in the browser's developer
      tools, F12) → map on top, panel below, no sideways scrolling.

### 7.3 Looking inside while testing

- **Browser console** (F12 → Console): `dashboard.state.rows` shows the current ranking
  with all scores and points; `dashboard.state.weights` the weights.
- **Network tab** (F12 → Network): shows each request to `/api/nbs/…` with its filters.
- **Django shell**: `docker compose exec web python manage.py shell`
  (example queries: `scripts/orm_queries.py`).
- **SQL**: `docker compose exec db psql -U nbs -d nbs` (examples in `sql/`), or QGIS
  with host `127.0.0.1`, port `5433`, database and user `nbs`.

## 8. When something goes wrong

| What you see | Why, and what to do |
|---|---|
| `docker compose` says it cannot connect | Docker Desktop is not running → start it, wait until it is ready. |
| Red message "Could not load…" in the panel | The API failed → `docker compose logs web` shows the error. |
| `TemplateDoesNotExist` after adding a new app or template folder | The dev server only looks for template folders at start → `docker compose restart web`. |
| Grey map without background | OpenStreetMap needs a Referer header → keep `SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'` in `config/settings.py`. |
| A data change is not visible | Reload the page (F5). For JavaScript/CSS changes use Ctrl+F5 (the browser may cache files). |
| `port is already allocated` | Another program uses the port. PostGIS uses 5433 on Windows because a local PostgreSQL has 5432; change `POSTGRES_HOST_PORT` in `.env` if needed. |
| A municipality's area looks wrong | Run `import_municipalities` again: it restores all boundaries from ISTAT. |

## 9. Where to find things in the code

| I want to change… | File |
|---|---|
| What an NbS or municipality *is* (fields) | `catalog/models.py` |
| The admin pages | `catalog/admin.py` |
| Importing municipalities / NbS | `catalog/management/commands/` |
| What the API sends (fields, coordinates) | `catalog/serializers.py` |
| Which rows the API sends (filters) | `catalog/views.py` |
| API addresses | `catalog/urls.py` |
| The page layout (HTML) | `dashboard/templates/dashboard/index.html` |
| Map, filters, list, popups | `dashboard/static/dashboard/js/dashboard.js` |
| The ranking formula and criteria | `dashboard/static/dashboard/js/ranking.js` |
| Colours and layout | `dashboard/static/dashboard/css/dashboard.css` |
| Settings (database, security) | `config/settings.py` + `.env` |
| Containers and ports | `compose.yaml`, `Dockerfile` |
