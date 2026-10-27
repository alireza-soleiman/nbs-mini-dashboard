# How to work with the NbS mini-dashboard

This guide explains **where the data comes from, how it reaches the screen, how to
change it, and how to test every feature**. For the first installation see the
[README](../README.md).

Contents:
1. [The big picture](#1-the-big-picture)
2. [Start and stop](#2-start-and-stop)
3. [The overview page](#3-the-overview-page)
4. [The map page](#4-the-map-page)
5. [How the score is calculated](#5-how-the-score-is-calculated)
6. [Where each thing on the screen comes from](#6-where-each-thing-on-the-screen-comes-from)
7. [Changing the data and the dashboard](#7-changing-the-data-and-the-dashboard)
8. [Testing all features](#8-testing-all-features)
9. [When something goes wrong](#9-when-something-goes-wrong)
10. [Where to find things in the code](#10-where-to-find-things-in-the-code)

---

## 1. The big picture

```
 SOURCES                        IMPORT                              DATABASE (PostGIS, Docker)
 ───────                        ──────                              ──────────────────────────
 ISTAT zip (boundaries)     ──► import_municipalities ────────────► catalog_municipality (116, metres)
 nbs_sample.geojson (NbS)   ──► load_sample_nbs ──────────────────► catalog_nbs          (29, metres)
 Admin (draw by hand)       ──► NbS.save() finds the municipality ─┘  points, lines, polygons
                                                                    │
 API (Django REST Framework)                                        ▼
 ───────────────────────────
 /api/summary/        totals, added up in the database (SQL GROUP BY)
 /api/nbs/            each NbS: shape in degrees + marker point + area/length (metres)
 /api/municipalities/ /api/nbs-types/
                │
 PAGES (browser)▼
 ───────────────
 /        Overview: key figures and charts        (overview.js)
 /map/    Map: shapes, filters, priorities, ranking (map.js + ranking.js)
```

Four ideas to remember:

- **Stored in metres, shown in degrees.** The database keeps geometries in EPSG:25832
  (metres), so areas, lengths and distances are correct. The API converts them to
  EPSG:4326 (longitude/latitude), which GeoJSON and Leaflet need.
- **An NbS can be a point, a line or a polygon.** A rain garden is a point, a row of
  street trees or a river is a line, a green roof or a wetland is a polygon. Every NbS
  also has a **marker point** that lies surely on its shape (`ST_PointOnSurface`), so
  even a small shape can be clicked when the map is zoomed out.
- **Filters run on the server, ranking runs in the browser.** Changing a filter asks
  the API for a new list. Moving a weight slider only recalculates in the browser,
  so it is instant.
- **The pages only know the API.** The JavaScript never reads the database.

## 2. Start and stop

```
docker compose up -d         # start db + web in the background
docker compose ps            # both should be "Up"; db should be "(healthy)"
docker compose logs -f web   # watch Django's output (Ctrl+C to stop watching)
docker compose down          # stop; the data stays in the Docker volume nbs_pgdata
```

Docker Desktop must be running first. Every Django command runs **inside** the `web`
container: `docker compose exec web python manage.py <command>`.

> ⚠️ `docker compose down -v` also deletes the volume = **all database data is lost**.

## 3. The overview page

Open **http://localhost:8000** (the start page). Hover any bar, cell or dot for details.

| Part | What it shows |
|---|---|
| **Key figures** | number of NbS, total estimated cost, municipalities with NbS (of 116), total area of the polygon NbS, total length of the line NbS |
| **NbS per type** | how many NbS of each type (bars) |
| **Estimated cost per municipality** | the sum of all NbS costs per municipality (bars) |
| **Benefit profile per type** | the average score (0–5) of each benefit for each type; darker blue = higher |
| **Cost and benefit of each NbS** | one dot per NbS: left = cheaper (log scale), up = more benefit (average of the 4 benefits). Top-left = good value. **Click a dot** to open that NbS on the map |
| **Top 5 with balanced priorities** | the best five with all weights equal (same calculation as the map); click one to open it on the map |
| **Shapes on the map** | how many NbS are areas, lines and single sites |

The top navigation switches between **Overview** and **Map & ranking**. The orange
badge reminds everyone that the NbS are fictional sample data.

## 4. The map page

Open **http://localhost:8000/map/**.

**On the map**
| Part | What it does |
|---|---|
| **NbS shapes** | Lines and polygons in the colour of their score (darker blue = better for your priorities). Lines have a white outline so they stay visible on any background. |
| **Markers** | One round marker per NbS (on its shape). The top three show 1, 2, 3. |
| **Click a marker or a shape** | The map **flies to it** (to the whole shape), opens its popup, and highlights its card in the list. The address changes to `/map/#nbs=<id>`: you can copy it and send the link. |
| **Click a municipality** | The map **flies to the municipality** and shows its area, number of NbS and ISTAT code. |
| **Popup** | Code (e.g. MER-01), name, type, municipality, size (m², ha, m or km), description, and **the points each criterion gave** to the score. |

**In the side panel** (from top to bottom)
| Part | What it does |
|---|---|
| **Summary** | how many NbS are shown, their total cost and in how many municipalities |
| **Filters** | **Type chips**: click to switch a type on/off; *All* / *None* switch all. **Municipality**: type a few letters and pick one from the list; the map zooms to it. Clear the field (×) to see all again. The note on the right of "Filters" shows what is active. |
| **Priorities** | **Presets**: *Balanced*, *Heat*, *Flood*, *Nature*, *Low budget*. **Sliders** (0–10) for each criterion; the percentage is the real share of that weight. Moving a slider switches the preset to "custom". |
| **Ranking** | All shown NbS, best first, as cards with rank, name, type, municipality, cost, size and score. Click a card = fly to it. Hover = its marker gets a dark ring. |
| **Collapse** | "Filters" and "Priorities" can be folded (click their title). The **‹ button** on the edge of the panel hides the whole panel for a bigger map. |

**On a phone** the map fills the screen and the panel is a **sheet at the bottom**:
tap the grey handle to slide it up or down. While the sheet is open, filter results are
fitted into the visible strip above it. Tapping an NbS card closes the sheet, so you
see the map fly to the NbS and open its popup.

## 5. How the score is calculated

The method is a **weighted sum** (also called *Simple Additive Weighting*).

1. Every criterion becomes a value from **0 (worst) to 1 (best)**:
   - a benefit (score 0–5) → `score / 5`
   - the cost → the **cheapest shown NbS gets 1, the most expensive gets 0**, the
     others in between
2. Each value is multiplied by its weight.
3. `score = (sum of weight × value) / (sum of weights) × 100` → a number from 0 to 100.

**Example** (*Balanced*, all weights 5): *Green roof on a primary school – Maia Bassa*
(MER-01) has heat 3, flood 3, biodiversity 2, wellbeing 2, cost 175,000 €:

| Criterion | Value | Points |
|---|---|---|
| Heat reduction | 3 / 5 | 12.0 |
| Flood & stormwater | 3 / 5 | 12.0 |
| Biodiversity | 2 / 5 | 8.0 |
| Health & wellbeing | 2 / 5 | 8.0 |
| Low cost | 175,000 € | 18.1 |
| **Score (rank 23 of 29)** | | **58** |

With five equal weights each criterion can give at most 20 points.

Good to know:
- The cost is compared **only among the NbS currently shown**, so a filter can change
  the cost points (and the ranking) of the remaining NbS.
- Equal scores are ordered alphabetically, so the list does not jump around.
- If all weights are 0 there is no score: the NbS turn grey and a message appears.

## 6. Where each thing on the screen comes from

| On the screen | API address | Database / code | Original source |
|---|---|---|---|
| Overview: key figures, type/municipality/shape bars, heatmap | `/api/summary/` | `catalog_nbs` + `catalog_municipality`, added up with SQL `GROUP BY` | GeoJSON / admin |
| Overview: dots, top 5 · Map: shapes, markers, list, popups | `/api/nbs/?type=…&municipality=…` | `catalog_nbs` | `data/sample/nbs_sample.geojson` → `load_sample_nbs`, or the admin |
| Grey outlines, municipality popups and search list | `/api/municipalities/` | `catalog_municipality` | ISTAT zip → `import_municipalities` |
| Type chips and their counts | `/api/nbs-types/` | `NbS.Type` in `catalog/models.py` + counts | code |
| Scores, colours, ranks, presets | (calculated in the browser) | `dashboard/static/dashboard/js/ranking.js` | — |
| Background map | tile.openstreetmap.org | — | OpenStreetMap |

You can open every API address in the browser to see the exact data a page receives.

## 7. Changing the data and the dashboard

After a data change, **reload the page** (F5) to see it.

### 7.1 Add, change or delete one NbS in the admin (no code)

1. Open http://localhost:8000/admin/ and log in (`DJANGO_SUPERUSER_USERNAME` and
   `DJANGO_SUPERUSER_PASSWORD` in your `.env`).
2. **NbS → Add NbS** (or click an existing one).
3. Fill in name, type, cost and the four benefits (0–5). The **code** is optional.
4. **Draw it on the map**: the small buttons on the map choose **point, line or
   polygon**. For a line or polygon, click point by point and double-click to finish.
5. Save. The **municipality is filled in automatically** from the shape.

### 7.2 Change many NbS at once: edit the GeoJSON (e.g. in QGIS)

1. Open `data/sample/nbs_sample.geojson` in **QGIS** (Layer → Add Layer → Add Vector
   Layer). Edit shapes or attributes, add features (each needs a **unique `code`**),
   save. A text editor works too.
2. Run `docker compose exec web python manage.py load_sample_nbs`.
3. Features are matched **by `code`**: an existing code is updated, a new code is
   created. A feature removed from the file is **not** deleted from the database
   (delete it in the admin, or reload everything with `--replace`, which deletes
   **all** NbS first, also ones made in the admin).
4. A wrong type or a benefit above 5 stops the whole load with an error, and nothing
   is changed.

### 7.3 Use your own NbS file

Make a GeoJSON (EPSG:4326) with the same properties (see `data/sample/README.md`) and
run `load_sample_nbs --file data/sample/<your-file>.geojson`.

### 7.4 Add a new NbS type

1. Add a line to `NbS.Type` in `catalog/models.py`, e.g. `BIOSWALE = 'bioswale', 'Bioswale'`.
2. `docker compose exec web python manage.py makemigrations catalog`, then `migrate`.
3. Reload: the new chip, bar and heatmap row appear by themselves (they come from the API).

### 7.5 Add a new criterion (e.g. "CO₂ storage")

A criterion lives in the database, the API, the loader, the ranking and the overview:

1. `catalog/models.py`: `benefit_co2 = benefit_field('CO2 storage')`, then
   `makemigrations` + `migrate` (Django asks for a value for existing rows, e.g. 0).
2. `catalog/serializers.py`: add `'benefit_co2'` to `NbSSerializer.Meta.fields`.
3. `catalog/views.py` (`summary`): add `co2=Avg('benefit_co2')` and `'co2'` to the
   rounded keys.
4. `catalog/management/commands/load_sample_nbs.py`: add it to `FIELDS`;
   add `benefit_co2` to every feature in the GeoJSON.
5. `dashboard/static/dashboard/js/ranking.js`: add
   `{ key: 'benefit_co2', label: 'CO₂ storage', kind: 'benefit' }` to `CRITERIA`
   and a value to each preset; `overview.js`: add it to `BENEFITS` (heatmap, dots).

### 7.6 Change the ranking settings

| What | Where |
|---|---|
| The presets (names and weights) | `PRESETS` in `ranking.js` |
| Slider range (now 0–10) | `min`/`max` in `buildPriorities()` in `map.js` |
| How a criterion becomes 0–1 | `normalise()` in `ranking.js` |
| Score colours and classes | `SCORE_CLASSES` in `colors.js` (keep one hue, light → dark) |

### 7.7 New municipality boundaries (e.g. a newer ISTAT year)

1. Download the new zip into `data/raw/` and change `SOURCE` in
   `catalog/management/commands/import_municipalities.py`.
2. `docker compose exec web python manage.py import_municipalities` (updated by ISTAT
   code; the NbS keep their links).
3. Run `load_sample_nbs` again to recalculate which municipality each NbS is in.

Municipality **boundaries cannot be edited in the admin** on purpose (a click on the map
once added a fake part to a municipality). Names can still be edited there.

### 7.8 Start again from an empty database

```
docker compose down -v                 # ⚠️ deletes ALL data
docker compose up -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py import_municipalities
docker compose exec web python manage.py load_sample_nbs
docker compose exec web python manage.py createsuperuser --noinput
```

## 8. Testing all features

### 8.1 Automated tests (1 minute)

```
docker compose exec web python manage.py test
```

Expected: `Ran 19 tests … OK`. They run in a separate, empty test database and check:
GeoJSON with lon/lat coordinates; one SQL query per list (no N+1); polygons with area
and lines with length; the marker point inside a shape; the municipality found from a
shape; the distance filter reaching any part of a line; all filters and their errors
(400); the summary totals; municipality and type endpoints; the locked boundaries in
the admin; and that both pages and their files are delivered.

### 8.2 Manual checklist (with the sample data: 29 NbS)

**Overview page** (http://localhost:8000)
- [ ] Key figures: **29** NbS · **€9.1M** · **11 of 116** municipalities · **4.9 ha** · **5.1 km**.
- [ ] "NbS per type": *Street trees* **6** at the top, then *Green roof* **5**.
- [ ] "Cost per municipality": *Postal/Burgstall* at the top (**€2.3M**).
- [ ] The heatmap has 9 rows × 4 columns; hover a cell → type, benefit and average.
- [ ] Hover a dot → name, cost, average benefit. Click it → the map opens on that NbS.
- [ ] Top 5: 1 *Village park extension – Tirolo* **81**, 2 *Pocket park … Maia Alta*
      **80**, 3 *Shade trees along a riverside promenade* **80**. Click one → the map
      opens with its popup.

**Map page** (http://localhost:8000/map/)
- [ ] Summary: **29 NbS · €9.1M · 11 municipalities**; lines and polygons are drawn,
      plus 29 markers; the top three markers show 1, 2, 3.
- [ ] Ranking (Balanced): 1 TIR-02 **81** … last (29) *Permeable paving in a commuter
      car park – Sinigo* **49**.
- [ ] Click the polygon *Green roof on a primary school – Maia Bassa* → the map flies to
      it, the popup shows **1,345 m²**, points 12.0 / 12.0 / 8.0 / 8.0 / 18.1, score
      **58**, rank 23; its card is highlighted; the address ends with `#nbs=…`.
- [ ] Click a municipality outline → the map flies to it; the popup shows its area.
- [ ] Presets: *Flood* → top three POS-01 **81**, NAT-01 **77**, POS-02 **77**;
      *Low budget* → MER-02 **84**, PAR-02 **82**, NAT-03 **82**; *Heat* → MER-02 **87**.
- [ ] Move one slider → the "Priorities" note says *custom*, no preset is highlighted.
- [ ] Set all sliders to 0 → message "All weights are 0…" and grey NbS.
- [ ] Type chips: *None* → "No NbS match the filters."; then only *River restoration*
      → **4** NbS, all lines; *All* → 29 again.
- [ ] Municipality: type "Lan", pick *Lana/Lana* → **4** NbS, **€875K**, map zooms to
      Lana. Clear the field → 29.
- [ ] Type *Green roof* only + municipality *Merano/Meran* → **2** NbS (MER-01, MER-07).
- [ ] The ‹ button hides the panel and the map uses the full width (no grey strip);
      clicking again brings it back.
- [ ] Copy an address like `/map/#nbs=…` into a new tab → the same NbS opens.

**Admin and data flow**
- [ ] In the admin, add a test NbS and draw a **polygon** in Merano → after saving, its
      municipality is *Merano/Meran*. Reload the map → **30** NbS, the new shape is
      drawn. Delete it afterwards.
- [ ] Open a municipality in the admin → you see its border but cannot draw.

**API directly** (in the browser)
- [ ] http://localhost:8000/api/summary/ → `"nbs": 29`, `"by_geometry"` 3 points, 12 lines, 14 polygons.
- [ ] http://localhost:8000/api/nbs/?type=river_restoration → 4 features, all `LineString`.
- [ ] http://localhost:8000/api/nbs/?type=green_rooof → error 400 with the valid types.

**Phone** (narrow window, or the phone view in the developer tools, F12)
- [ ] Overview: the cards are in one column, no sideways scrolling.
- [ ] Map: the map fills the screen; tap the handle at the bottom → the panel slides
      up; tap again → down.

### 8.3 Looking inside while testing

- **Browser console** (F12 → Console) on the map page: `dashboard.state.rows` = the
  current ranking with scores and points; `dashboard.state.weights` = the weights.
- **Network tab** (F12 → Network): each request to `/api/…` with its filters.
- **Django shell**: `docker compose exec web python manage.py shell`
  (examples: `scripts/orm_queries.py`).
- **SQL**: `docker compose exec db psql -U nbs -d nbs` (examples in `sql/`), or QGIS
  with host `127.0.0.1`, port `5433`, database and user `nbs`.

## 9. When something goes wrong

| What you see | Why, and what to do |
|---|---|
| `docker compose` cannot connect | Docker Desktop is not running → start it and wait. |
| Red message "Could not load…" | The API failed → `docker compose logs web` shows the error. |
| `TemplateDoesNotExist` after adding a new app or template folder | The dev server only looks for template folders at start → `docker compose restart web`. |
| Grey map without background | OpenStreetMap needs a Referer header → keep `SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'` in `config/settings.py`. |
| A change is not visible | Reload (F5). For JavaScript/CSS changes use **Ctrl+F5** (the browser caches files). |
| `port is already allocated` | Another program uses the port; change `POSTGRES_HOST_PORT` in `.env`. |
| A municipality's area looks wrong | Run `import_municipalities` again (restores all boundaries from ISTAT). |
| `load_sample_nbs` says a code is missing or repeated | Every feature in the GeoJSON needs its own `code`. |

## 10. Where to find things in the code

| I want to change… | File |
|---|---|
| What an NbS or municipality *is* (fields) | `catalog/models.py` |
| The admin pages | `catalog/admin.py` |
| Importing municipalities / NbS | `catalog/management/commands/` |
| What the API sends (fields, coordinates, sizes) | `catalog/serializers.py` |
| Which rows the API sends (filters), the summary totals | `catalog/views.py` |
| API addresses | `catalog/urls.py` |
| Page addresses | `dashboard/urls.py` |
| Page layout (HTML): header, overview, map | `dashboard/templates/dashboard/` |
| Overview charts | `dashboard/static/dashboard/js/overview.js` |
| Map, filters, priorities, list, popups | `dashboard/static/dashboard/js/map.js` |
| Ranking formula, criteria, presets | `dashboard/static/dashboard/js/ranking.js` |
| Data colours · number formats | `colors.js` · `format.js` |
| Design (colours, layout, phone view) | `dashboard/static/dashboard/css/dashboard.css` |
| The sample NbS | `data/sample/nbs_sample.geojson` |
| Settings (database, security) | `config/settings.py` + `.env` |
| The demo video and screenshots (for LinkedIn) | `scripts/record_demo.py` → `linkedin/` (not in Git); the tools it needs are listed at the top of the script |
