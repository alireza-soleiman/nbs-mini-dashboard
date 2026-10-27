# What I Learned

A personal log, written after each milestone of the NbS mini-dashboard.
For each one: the key concepts in my own words, useful commands, mistakes I made,
and questions I still have.

---

## Milestone 1 — Setup (Git, PostGIS in Docker, GeoDjango)

_Done: 2026-10-27._

### The big picture

The dashboard has four layers, and each one only talks to its neighbour:
**PostGIS** (stores geometry) → **Django + GeoDjango** (models in Python) →
**API** (GeoJSON over HTTP) → **Leaflet** (draws the map in the browser).
In this milestone I set up the bottom two layers: a database and a Django project that
can talk to it, both running in Docker.

### Key concepts

**Git**
- Git settings have levels: system → global (my user) → local (one repo).
  The most specific level wins. My global email is Gmail, but this repo uses the
  GitHub noreply address with `git config --local`.
- `.gitignore` must exist *before* the first commit. Once a file is committed, ignoring
  it later does not remove it from the history.
- `.gitattributes` with `eol=lf` keeps Linux line endings. Docker containers are Linux,
  and Windows line endings (CRLF) can break scripts there.
- A commit ID is a fingerprint of its content, author and parent. Changing the author
  email changed all 6 IDs. Rewriting history is only safe **before** pushing; after a
  push, I fix mistakes with a new commit.

**Docker**
- **Image** = the recipe result (read-only). **Container** = a running copy of an image
  (disposable). **Volume** = storage that survives when the container is deleted.
- `compose.yaml` describes all services. `db` = PostgreSQL 17 + PostGIS 3.5,
  `web` = Django built from our `Dockerfile`.
- Each container has its **own** network identity. Inside the `web` container,
  `localhost` means the web container itself, not Windows and not the database.
  Containers find each other by **service name**: Django connects to `db:5432`.
- Port mapping `127.0.0.1:5433:5432` means "port 5433 on my PC → port 5432 in the
  container". It is only for tools on Windows (QGIS, pgAdmin). I used 5433 because a
  PostgreSQL installed on Windows already uses 5432.
- A healthcheck (`pg_isready`) tells "running" apart from "ready". `depends_on` with
  `service_healthy` makes Django wait for the database.
- In a Dockerfile, each step is a cached layer. Copying `requirements.txt` and running
  `pip install` *before* copying the code makes rebuilds fast.

**Secrets**
- Real secrets live only in `.env`. It is ignored twice:
  - in `.gitignore`, so it never reaches the public GitHub repo,
  - in `.dockerignore`, so `COPY . .` does not bake it into the image (anyone who gets
    the image could read it).
- `.env.example` is committed: the same variable names with fake values, so others
  know what to set.
- `settings.py` reads secrets with `os.environ['X']` (crash if missing) and normal
  options with `os.environ.get('X', default)` (safe default, e.g. `DEBUG` off).

**GeoDjango**
- GeoDjango = Django + three C libraries: **GDAL** (file formats), **GEOS** (geometry
  operations), **PROJ** (coordinate transformations). On Windows they are hard to
  install; in Docker it is one line: `apt-get install gdal-bin`.
- To enable it: `django.contrib.gis` in `INSTALLED_APPS` and the
  `django.contrib.gis.db.backends.postgis` database engine.

**Coordinates**
- **EPSG:4326** = longitude/latitude in degrees (GPS). Order is **(longitude, latitude)**:
  Merano is `POINT(11.1597 46.6713)`.
- **EPSG:25832** (ETRS89 / UTM 32N) = metres; used by most South Tyrol data.
  Merano becomes (665194, 5170903). Metres are needed for distances and buffers.

### Useful commands

| Command | What it does |
|---|---|
| `git status` / `git log --oneline` | what changed / list of commits |
| `git add <files>` then `git commit -m "…"` | stage, then save a snapshot |
| `git check-ignore -v -n <path>` | which `.gitignore` line matches a path |
| `git push -u origin main` | first push; `-u` remembers the remote branch |
| `docker compose up -d` | start all services in the background |
| `docker compose ps` | status of the containers (look for `healthy`) |
| `docker compose logs -f web` | follow Django's output |
| `docker compose exec web python manage.py <cmd>` | run a Django command in the container |
| `docker compose exec db psql -U nbs -d nbs` | open SQL inside the database container |
| `docker compose down` | stop and remove containers; **data stays** in the volume |
| `docker compose down -v` | ⚠️ also deletes the volume = **all data is lost** |

### Mistakes and corrections

- **Quiz 1:** I thought Django uses 5432 so it does not conflict with QGIS on 5433.
  The real reason: inside a container `localhost` is the container itself. Port 5433
  only exists on Windows; Django talks to the `db` container directly on its own port
  5432.
- **Quiz 2:** I wrote `-V`. The flag that deletes volumes is lowercase `-v`. Flags are
  case-sensitive.
- **Quiz 3:** I did not know why `.env` must also be in `.dockerignore`: without it, the
  password ends up inside the Docker image.
- PowerShell breaks commands with quotes inside quotes. For those, use Git Bash or
  split the command.
- Docker Desktop does not start by itself: start it before `docker compose up -d`.

### Questions I still have

- How does this setup change on a real server (no `runserver`, `DEBUG` off)? →
  Milestone 8.
- When should I transform coordinates in PostGIS, and when in Django? → Milestones 3–4.

## Milestone 2 — Leaflet only (static GeoJSON map)

_Done: 2026-10-27._

### The big picture

I built the **top layer alone**: a web page with a Leaflet map that shows the 116
municipalities of South Tyrol. Instead of an API, the data comes from a static GeoJSON
file. In Milestone 6 the same `fetch()` will ask Django instead.

Data flow: ISTAT zip (all of Italy, metres) → `ogr2ogr` script → small GeoJSON
(South Tyrol, degrees) → `fetch` → `L.geoJSON` → polygons on the map.

### Key concepts

**Leaflet**
- `L.map('map')` puts a map into `<div id="map">`. That div **must have a height**, or
  the map is invisible (no error message!).
- The background is made of **tiles**: 256×256 px images, URL `{z}/{x}/{y}` = zoom,
  column, row. Each zoom level has 4× more tiles.
- OpenStreetMap tiles need the attribution "© OpenStreetMap contributors". Data
  sources (ISTAT) get credited too, with the layer's `attribution` option.
- `integrity="sha256-…"` on the CDN links: the browser refuses Leaflet if the file
  was changed.
- `L.geoJSON(data, { style, onEachFeature })`:
  - `style` can be a **function** of the feature → data-driven colours (Milestone 7).
  - `onEachFeature` attaches a tooltip (hover), popup (click) and events.
  - `setStyle()` on hover, `resetStyle()` on mouse-out (asks the style function again).
  - `fitBounds(layer.getBounds())` zooms to show all features.
- `fetch()` only works when the page comes from a web server (`http://`), not from
  `file://`. Python's `http.server` is enough for a static page.

**Coordinate systems (CRS)**
- An EPSG code says **how numbers become places** (units, origin, projection). It is
  not about which area the data covers. Cutting Italy down to South Tyrol was done by
  `WHERE COD_PROV = 21`; changing the CRS was a separate step (`-t_srs`).
- **EPSG:32632** (UTM 32N) and **EPSG:25832** = metres → good for area, distance,
  buffers. **EPSG:4326** = longitude/latitude degrees → what GeoJSON and Leaflet expect.
  (Leaflet itself draws in Web Mercator, EPSG:3857, but I give it degrees.)
- **Coordinate order:** PostGIS and GeoJSON = `[lng, lat]` (x, y). Leaflet =
  `[lat, lng]`. `L.geoJSON` swaps them **automatically**. I only swap by hand when
  I type coordinates myself, like `MERANO = [46.6713, 11.1597]`.

**GIS data**
- A **shapefile** is several files: `.shp` (shapes), `.dbf` (attributes), `.shx`
  (index), `.prj` (CRS).
- **GeoJSON** structure: `FeatureCollection` → `features[]` → each `Feature` has
  `properties` (attributes) and `geometry` (`type` + `coordinates`). A `Polygon` is a
  list of rings (outer boundary, then holes); each ring is closed (first point = last).
- GDAL tools (in the `web` container): `ogrinfo -so` = summary (CRS, extent, count,
  fields); `ogr2ogr` = convert / filter / reproject. `/vsizip/` reads inside a zip.
- `COORDINATE_PRECISION=5` = about 1 m. More decimals only make the file bigger.

**Raw data vs. display data**
- The raw zip (10 MB, all of Italy) stays in `data/raw/`, outside Git: it is big,
  binary, and anyone can download it again (URL + SHA256 are in the script).
- In Git: the **script** (the recipe) and the small **GeoJSON** (the product). The
  script makes the result **reproducible**: delete the GeoJSON, run the script, get
  the same file.

### Useful commands

| Command | What it does |
|---|---|
| `python -m http.server 8080 --bind 127.0.0.1 --directory frontend` | serve the map at http://localhost:8080 |
| `docker compose exec web ogrinfo -ro -so <file> <layer>` | summary of a GIS layer |
| `docker compose exec web sh scripts/build_municipalities_geojson.sh` | rebuild the GeoJSON from the ISTAT zip |
| `docker compose exec web gdalsrsinfo -e <file>` | show the EPSG code of a file |

### Mistakes and corrections

- **Quiz 1:** I thought EPSG:32632 meant "all of Italy" and EPSG:4326 "only South
  Tyrol". Wrong: EPSG codes are coordinate systems (metres vs. degrees). Leaflet needs
  4326 (degrees); I keep a metre-based CRS (32632/25832) for calculations in metres.
- **Quiz 2:** Right about the order (PostGIS lng first, Leaflet lat first). Missing
  part: `L.geoJSON` does the swap for GeoJSON data, so I never swap those by hand.
- **Quiz 3:** Right that we keep only what we need. Also important: the raw file can
  be downloaded again, and the script makes the GeoJSON reproducible.
- After clicking a municipality, the browser drew a **rectangle** (focus outline)
  around it. Fix in CSS: `.leaflet-interactive:focus { outline: none; }`. Safe here,
  because the polygons can't be reached with the keyboard anyway.
- In Git Bash, paths that start with `/` (like `/vsizip/...`) get changed into Windows
  paths. `MSYS_NO_PATHCONV=1` turns that off.

### Questions I still have

- How do I colour polygons by a number (e.g. a vulnerability score)? → Milestone 7.
- How will the map get its data from Django instead of a file? → Milestones 5–6.

## Milestone 3 — PostGIS in SQL (spatial queries, projections)

_Done: 2026-10-27._

### The big picture

I worked on the **bottom layer alone**: the 116 municipalities are now a PostGIS table
in **metres** (EPSG:25832), and I asked spatial questions in plain SQL. Nothing changed
in the browser, and that is expected: the map still reads the static GeoJSON from
Milestone 2. Django (M4) and the API (M5) will connect the database to the map (M6).
To look at PostGIS data directly, I can use QGIS (host `127.0.0.1`, port `5433`).

### Key concepts

**Loading data**
- `ogr2ogr -f PostgreSQL PG: …` loads a shapefile into a table.
  `-t_srs EPSG:25832` = metres, `-nlt PROMOTE_TO_MULTI` = all shapes as MultiPolygon
  (Lagundo and Termeno really have 2 parts), `SPATIAL_INDEX=GIST` = spatial index.
- The geometry column type includes the CRS: `geometry(MultiPolygon,25832)`. PostGIS
  refuses other types or SRIDs in it.
- Shapefile number fields have old fixed sizes (`numeric(18,11)`) that can overflow →
  `-lco PRECISION=NO`.
- The password goes to GDAL through the standard `PG*` variables (`PGPASSWORD` …),
  not on the command line.

**Projections in practice (the same Merano polygon)**

| CRS | Area | |
|---|---|---|
| EPSG:25832 (UTM, metres) | 25.98 km² | ✅ correct |
| EPSG:4326 (degrees) | 0.003054 "square degrees" | ❌ meaningless |
| `geography` (degrees on the real Earth) | 25.99 km² | ✅ correct |
| EPSG:3857 (Web Mercator, Leaflet) | 55.14 km² | ❌ 2.12× too big |

- Degrees are not a distance: at Merano 1° east = 76.5 km, 1° north = 111.2 km.
- Rule: **draw in 3857 (Leaflet does it), calculate in 25832 or `geography`.**
- `ST_Transform(geom, srid)` converts between CRSs. `ST_SetSRID` only puts a label on
  the numbers; it does NOT move the point.

**Spatial relationships** (yes/no questions)
- `ST_Intersects` = share any point · `ST_Touches` = share only boundary (neighbours) ·
  `ST_Within(a, b)` = a completely inside b · `ST_Contains(b, a)` = the mirror.
- A **spatial join** is a normal `JOIN` with a geometry test as the condition:
  `JOIN … ON ST_Touches(m.geom, n.geom)`.
- Both geometries must have the **same SRID**. A point from the map (lon/lat) must be
  transformed first: `ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), 25832)`.
- `ST_Centroid` (centre of mass) can be **outside** a curved polygon (Santa Cristina
  Valgardena). `ST_PointOnSurface` is always inside → use it for labels and markers.

**Distances and buffers** (units = units of the CRS, here metres)
- `ST_Distance(a, b)`, `ST_DWithin(a, b, d)`, `ST_Buffer(g, d)`, and `a <-> b` for
  "nearest first" ordering.
- `ST_Buffer` builds a new polygon (use it to see/store the shape). `ST_DWithin` only
  answers yes/no and can use the index (use it for filtering). Same result, faster.

**Spatial index (GiST)**
- Works in two steps, visible with `EXPLAIN ANALYZE`:
  1. `Index Cond: geom && …` = fast test on **bounding boxes** (rectangles) → 26 candidates
  2. `Filter: st_dwithin(…)` = exact test only on those candidates → 23 results
- Without the index, the exact test runs on all 116 rows.

### Useful commands

| Command | What it does |
|---|---|
| `docker compose exec web sh scripts/load_municipalities_postgis.sh` | (re)load the table from the ISTAT zip |
| `docker compose exec db psql -U nbs -d nbs -f /sql/<file>.sql` | run a SQL file (`sql/` is mounted at `/sql`, read-only) |
| `docker compose exec db psql -U nbs -d nbs -c "\d istat_municipalities"` | show columns and indexes of a table |
| `EXPLAIN ANALYZE SELECT …` | show how PostgreSQL ran a query (index or not) |

### Mistakes and corrections

- **Quiz:** I did not know the three answers. The explanations:
  1. *Why `ST_Transform` before `ST_Within`?* The table is in metres (25832), the sites
     in degrees (4326). Read as metres, (11.1597, 46.6713) is a point 11 m east and 46 m
     north of the UTM grid origin, which is in the sea near the equator, off West Africa
     (lon 4.51, lat 0.0004). Inside a `WHERE` the mistake gives **0 rows and no error**
     (the index throws everything out first); called directly, PostGIS stops with
     "mixed SRID geometries".
  2. *Why `ST_DWithin` and not `ST_Buffer` + `ST_Intersects`?* No new polygon has to be
     built, and the index can be used. Same answer, less work.
  3. *Centroid or point on surface for a label?* `ST_PointOnSurface`, because it is
     always inside the polygon; a centroid can fall outside.
- The first load failed with "numeric field overflow" → `-lco PRECISION=NO`.
- I (Claude) expected PostgreSQL to skip the index for only 116 rows. `EXPLAIN` showed
  it used the index anyway: check with `EXPLAIN`, don't guess.

### Questions I still have

- Should the Django models store geometry in 4326 or in 25832? → Milestone 4.
- How do query results become GeoJSON for the map? → Milestone 5.

## Milestone 4 — GeoDjango models + import script

_Done: 2026-10-27._

### The big picture

Django now owns the data. Two models in `catalog/models.py` became PostGIS tables; the
116 municipalities and 12 **fictional** sample NbS around Merano are loaded by
management commands; the admin shows them on maps (http://localhost:8000/admin/,
login data in `.env`). Every Milestone 3 SQL question now also works as Python.

### Key concepts

**Models → tables**
- `from django.contrib.gis.db import models` = normal models + geometry fields.
- `MultiPolygonField(srid=25832)` → `geometry(MULTIPOLYGON,25832)`;
  `PointField(srid=25832)` → `geometry(POINT,25832)`. `migrate` also creates a **GiST
  index** for every geometry field. `sqlmigrate catalog 0001` shows the SQL.
- **Decision:** store in **EPSG:25832** (metres): `Area` → m², `Distance` → m,
  `D(km=1)` → `1000.0`. The API will transform to 4326 for the map (Milestone 5).
- `TextChoices`: stored value `green_roof`, label "Green roof".
- The four benefit scores (0–5) + cost are the **criteria** for the ranking (M7).

**Django transforms for me, if the geometry knows its SRID**
- `Point(11.1597, 46.6713, srid=4326)` saved into a 25832 field → Django writes
  `ST_Transform(<point>, 25832)` into the INSERT, and **PostGIS** does the maths.
  Result: (665194, 5170903).
- The same in queries: `filter(geom__contains=point_4326)` →
  `ST_Contains(geom, ST_Transform(<point>, 25832))`.
- A `Point` **without** `srid=` would bring back the M3 problem (wrong place / 0 rows).

**ORM lookups = PostGIS functions**

| ORM | PostGIS |
|---|---|
| `filter(geom__contains=p)` | `ST_Contains` |
| `filter(geom__touches=g)` | `ST_Touches` |
| `filter(location__dwithin=(p, D(km=1)))` | `ST_DWithin(…, 1000)` |
| `annotate(d=Distance('location', p))` | `ST_Distance` |
| `Area('geom')`, `Centroid`, `PointOnSurface`, `Transform('location', 4326)` | `ST_Area`, `ST_Centroid`, `ST_PointOnSurface`, `ST_Transform` |

**Logic in `save()`**
- `NbS.save()` runs `Municipality.objects.filter(geom__contains=self.location).first()`
  before saving → the municipality is filled in automatically, for the CSV import
  **and** for a click in the admin.
- Limit: it only runs when the NbS is saved. If a boundary changes later, old NbS
  are not updated.

**Validation has layers**
- `save()` stores whatever it gets. The database only checks what the column says
  (`CHECK (benefit_heat >= 0)` from `PositiveSmallIntegerField`).
- `choices` and `MaxValueValidator(5)` live in **Python**: they run in forms (admin,
  later the API) and in `full_clean()`, never in `save()`.
- So the loader calls `full_clean()` before `save()`. A real database rule would need a
  `CheckConstraint` (→ Milestone 8).

**Importing**
- `DataSource(path)[0]` opens a GIS file (also inside a zip with `/vsizip/`);
  `feature.get('FIELD')`, `feature.geom.transform(25832)`, `.geos` → saveable geometry.
- `update_or_create` (or "find by key, else new") makes a command safe to run twice.
- `@transaction.atomic`: one error → nothing is saved.
- Sample data in `data/sample/` is marked as fictional in its README.

**Admin**
- `GISModelAdmin` shows geometry fields on an OpenLayers map with OSM tiles.
- OSM tiles need a `Referer` header. Django's default `Referrer-Policy: same-origin`
  sends none → blocked tiles. Fix: `SECURE_REFERRER_POLICY =
  'strict-origin-when-cross-origin'`.

### Useful commands

| Command | What it does |
|---|---|
| `docker compose exec web python manage.py makemigrations catalog` | write a migration from the models |
| `docker compose exec web python manage.py sqlmigrate catalog 0001` | show the SQL of a migration |
| `docker compose exec web python manage.py migrate` | apply migrations |
| `docker compose exec web python manage.py import_municipalities` | load the 116 municipalities |
| `docker compose exec web python manage.py load_sample_nbs` | load the 12 sample NbS |
| `docker compose exec web python manage.py createsuperuser --noinput` | admin user from `DJANGO_SUPERUSER_*` in `.env` |
| `docker compose exec web python manage.py shell -v 0 -c "exec(open('scripts/orm_queries.py').read())"` | run the ORM examples |

### Mistakes and corrections

- **Quiz 1:** I said "Python code converted it". Half right: the CSV has degrees (4326)
  and the database metres (25832), but our Python does no maths. Because the `Point`
  says `srid=4326` and the field says `srid=25832`, Django puts
  `ST_Transform(…, 25832)` into the SQL and **PostGIS** converts.
- **Quiz 2:** I did not know. `NbS.save()` in `catalog/models.py` fills in the
  municipality with `geom__contains` → `ST_Contains` in SQL. Demo: the SELECT that
  `save()` sends contains `ST_Contains("geom", ST_Transform(<point>, 25832))`.
- **Quiz 3:** I said "remove". Wrong: without `full_clean()`, the row is **saved**.
  Demo: `type='green_rooof'`, `heat=7` were stored with an id (then rolled back). The
  database has no rule against them; only `full_clean()` (or a form) checks them.
- Admin map without background: OSM tiles blocked because of the Referrer-Policy.
- I created a "test" NbS in the admin; it changed the counts (Merano 6) until I
  deleted it.

### Questions I still have

- How do I send these models as GeoJSON in EPSG:4326? → Milestone 5.
- Should benefit limits also be database rules (`CheckConstraint`)? → Milestone 8.

## Milestones 5–7 — Phase 1: API, connected map, ranking

_Done: 2026-10-27. From here on no quizzes; the full explanation of how everything
works, how to change it and how to test it is in [docs/GUIDE.md](docs/GUIDE.md)._

**Milestone 5 — API** (`catalog/serializers.py`, `views.py`, `urls.py`)
- `/api/nbs/`, `/api/municipalities/`, `/api/nbs-types/`: GeoJSON in EPSG:4326, made
  from metres with `Transform()` in SQL. Filters `?type=`, `?municipality=`,
  `?near=lon,lat&radius=m`; wrong values → error 400.
- Three files, three jobs: URL (where) → view (which rows) → serializer (what shape).
- `select_related` turned 13 SQL queries into 1 (the N+1 problem).
- 13 automated tests in a separate test database (`manage.py test`).
- An accidental click in the admin had changed Aldino's boundary → restored from ISTAT,
  boundaries are now read-only in the admin (server-side `disabled` + no drawing tools).

**Milestone 6 — the map uses the API** (`dashboard/` app)
- Django serves the page at `/`; the API addresses are written into the page with
  `{% url %}`, so the JavaScript does not hard-code them.
- Filters ask the server (`/api/nbs/?type=…&municipality=…`); the map zooms to the
  results. The old static GeoJSON from Milestone 2 is gone (still in the Git history).

**Milestone 7 — ranking with weights** (`ranking.js`)
- Weighted sum: benefits /5, cost min–max (cheapest = 1), weights 0–10, score 0–100.
  Calculated in the browser, so the sliders react instantly.
- The popup shows the points per criterion, so every score can be explained.
- Score colours: 4 classes of one blue hue (light → dark), checked with a palette
  validator; numbers 1–3 on the top three markers.
- Checked the JavaScript ranking against an independent Python calculation: identical.

## Phase 2 — A richer dashboard

_Done: 2026-10-27. Details: [docs/GUIDE.md](docs/GUIDE.md)._

- **Points, lines, polygons:** `NbS.location` (Point) → `NbS.geom` (any geometry).
  The migration was written by hand with `RenameField` + `AlterField`, so the data
  stayed (`makemigrations` would have deleted and re-added the column). The
  municipality comes from `point_on_surface`, because a shape can cross a border.
- **API extras:** a marker point (`PointOnSurface`), `area_m2` / `length_m` computed in
  metres, and `/api/summary/` with totals made by SQL `GROUP BY`
  (`values().annotate()`). Django 5.2 has no `GeometryType` function, so
  `Func(F('geom'), function='GeometryType')` calls the PostGIS function directly.
  Two naming traps: an annotation and an aggregate with the same name, and an alias
  (`name`) that clashes with a model field.
- **New sample data:** 29 fictional NbS in 11 municipalities as GeoJSON (editable in
  QGIS), each with a `code` (MER-01 …) used as the import key. Shapes drawn in metres by
  a script; three lines (Passer promenade, Adige at Postal) were checked on the map and
  moved onto the real river banks.
- **Overview page** (`/`): key figures, bars, a heatmap and a scatter plot built with
  plain HTML/SVG, shared tooltip, links to `/map/#nbs=<id>`.
- **Map page** (`/map/`): shapes coloured by score, click = fly to the feature (also
  municipalities), type chips, municipality search, weight presets, collapsible
  sidebar, bottom sheet on phones, shareable address.
- **Design rules:** green = interface, blue = data; one hue for magnitudes; every
  heatmap cell ≥ 5.4:1 text contrast (one ramp step removed); "reduce motion" respected.
- **Testing lessons:** a hidden browser tab pauses animations, so test the logic
  (spy on `flyToBounds`, switch transitions off); the browser caches CSS/JS (Ctrl+F5).

## Phase 3 — Handover quality (Milestone 8)

_Not started yet._ Ideas: production settings (no `runserver`, `DEBUG` off, hashed
static file names), database `CheckConstraint` for the 0–5 scores, secret scanning
before commits, JavaScript tests for `ranking.js`.
