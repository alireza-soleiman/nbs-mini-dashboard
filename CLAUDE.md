# NbS Mini-Dashboard — Learning Project

This is a **learning project**. Claude builds the project and teaches me while doing it.
The goal is to prepare for real work, so understanding each part matters more than speed.

## Context

In November 2026 I start a collaboration with **Eurac Research** on the
Interreg Italy–Austria project **CRESCITA**. I will help develop a GIS-based interactive
dashboard for **Nature-Based Solutions (NbS)**, part of a decision-support toolkit
(**Climate Adaptation Suite**) for local authorities.

Users of the real dashboard must be able to:
- explore a GIS catalogue of NbS,
- see spatial data on climate vulnerability,
- compare NbS by multiple criteria using their own preferences (weights).

To prepare, I am building a small **"NbS mini-dashboard"** here. This is my first full
project of this kind, so Claude plans it and guides me through the flow.

**Example city:** use **Merano** in all examples, sample NbS data and docs. Never use the
city where Eurac is based as an example in this project.

## My background

- **I know:** Python/Django, PostgreSQL, JavaScript, Vue.js, HTML/CSS, some QGIS.
- **Thesis:** a Django decision-support platform using multi-criteria methods
  (Simos-Roy-Figueira).
- **New to me:** PostGIS, GeoDjango, GeoJSON, Leaflet, coordinate reference systems (CRS),
  Docker.
- **OS:** Windows 11 (shell: PowerShell; Git Bash also available).

## Stack

- Django + GeoDjango
- PostGIS (running in Docker)
- djangorestframework-gis
- Leaflet 1.9.4
- Git

## Milestones

1. **Setup:** Git, PostGIS in Docker, Django project with GeoDjango working
2. **Leaflet only:** a static map showing a GeoJSON file of South Tyrol municipalities
3. **PostGIS in SQL:** load data, spatial queries (intersects, within, buffer), projections
4. **GeoDjango:** models for municipalities and NbS (name, type, cost, benefits, location)
   + a data import script with sample NbS data
5. **API:** GeoJSON endpoints with djangorestframework-gis
6. **Connect:** Leaflet map loads data from the API, with filters by NbS type
7. **Multi-criteria ranking:** weight sliders that re-rank the NbS on the map and in a list
8. **Handover quality:** README, Docker Compose, clean and documented code

## How to teach me (rules for Claude)

- **Claude writes all the code and runs the commands. Never ask me to write code**
  (no "Learn by Doing" / `TODO(human)` tasks).
- **Teach while building:** before each step, explain *what* and *why* in simple words.
  For the important parts (models, spatial queries, API, Leaflet logic, ranking), show the
  key code and explain it line by line.
- **Small steps, one concept at a time.**
- **Explain every command before running it** (what it does, what each flag means).
- **No quizzes** (my decision, 2026-10-27: they did not help me). Instead, after each
  milestone or phase explain **how to work with the project**: the features, where the
  data comes from and how it reaches the map, how to change it for different needs,
  and how to test every feature (a checklist I can follow myself).
- **Phases:** Phase 1 = a working dashboard (Milestones 5–7) + a user guide. Within a
  phase, go on from milestone to milestone; between phases, wait for my go-ahead.
- Keep `LEARNING.md` short: what was built and where to read more (the guide).
- Keep the **Current status** section below up to date.

## Git & GitHub

- **Remote repository:** in Milestone 1, right after `git init`, create a **public** GitHub
  repository called `nbs-mini-dashboard` with GitHub CLI (`gh repo create`) and connect it
  as the `origin` remote.
- **`.gitignore` early:** create it before the first commit. It must cover Python, Django,
  virtual environments, `.env` files, database data (e.g. Docker volumes, local DB dumps)
  and large raw data files.
- **No secrets in Git, ever:** never commit passwords, Django `SECRET_KEY`, or `.env` files.
  Read secrets from environment variables. The repo is public, so anything committed is
  visible to everyone and stays in the history.
- **Commit often:** commit after each meaningful step, with clear messages.
  **Push** at the end of each milestone.
- **Explain before running:** before any git command, explain what it does and why,
  so I learn Git too.
- **Ask before every push.** Never push without my explicit OK.

## Current status

- **Phase 1 (Milestones 1–7): done** (2026-10-26 → 2026-10-27). Working dashboard at
  http://localhost:8000 + user guide `docs/GUIDE.md` + `README.md`
- **Next step:** push Phase 1 (ask first). Then **Phase 2** (Milestone 8, handover
  quality) — **waiting for my go-ahead**. Ideas in `LEARNING.md`
- **Open questions / blockers:** none
- **Topics that were hard for me** (explain with code + a small demo when they come
  up): Docker networking (`localhost` inside a container); EPSG code = coordinate
  system, not an area; same SRID before comparing; who transforms (PostGIS via
  `ST_Transform` that Django writes); logic in `save()`; validation layers (`save()` vs.
  `full_clean()`/forms). Explaining with **exact code lines + a live demo** worked well

### Phase 1 log: Milestones 5–7 (done 2026-10-27)

- **Decision (2026-10-27): no more quizzes**; instead explain features, data flow, how
  to change and test things (→ `docs/GUIDE.md`)
- **API** (`catalog/`): DRF 3.16.1 + DRF-gis 1.3.0. `NbSSerializer`/`MunicipalitySerializer`
  (`GeoFeatureModelSerializer`, geometry from a `Transform(…, 4326)` annotation,
  precision 6/5; municipality `id_field`/`lookup_field` = `istat_code`, `area_km2`,
  `nbs_count`). `NbSViewSet` (`select_related`: 1 query instead of 13; filters `type`
  (repeatable), `municipality`, `near`+`radius`; bad values → 400). `nbs_types`
  (`@api_view`). URLs: `/api/`, `/api/nbs/`, `/api/municipalities/<istat_code>/`,
  `/api/nbs-types/`
- **Aldino accident:** an admin click added a 2.14 km² part (LogEntry 10:31) → restored
  with `import_municipalities`; boundaries now read-only in the admin
  (`ReadOnlyOSMWidget` template switches off draw/modify; `field.disabled = True`;
  no add)
- **Dashboard** (`dashboard/` app, no models): `TemplateView` at `/`, API URLs in
  `<body data-…>` via `{% url %}`. JS modules: `api.js` (`getJSON`), `ranking.js`
  (`CRITERIA`, `rankNbs`: weighted sum, benefits /5, cost min–max over shown NbS,
  weights 0–10 default 5, `parts` per criterion), `dashboard.js` (map, outlines, type
  checkboxes + municipality dropdown → server filters, sliders → browser ranking,
  divIcon markers coloured by 4 score classes `#86b6ef/#5598e7/#256abf/#104281`
  (validated ordinal ramp), rank 1–3 on markers, list, legend, popups with points,
  `escapeHtml`, `window.dashboard` for the console). Responsive (stacked < 800 px),
  dark panel in dark mode
- **Verified:** JS ranking = independent Python calculation (equal weights: 79, 75, 71
  … 50; flood only: top three 100); filter requests; popup points; phone layout;
  15 Django tests OK (`manage.py test`)
- Removed the Milestone 2 prototype (`frontend/`, `scripts/build_municipalities_geojson.sh`;
  still in Git history); ISTAT URL + SHA256 now in `import_municipalities.py`.
  `.claude/launch.json`: "dashboard" (attach to http://localhost:8000)
- Gotcha: a new app's `templates/` folder created after the dev server started →
  `TemplateDoesNotExist` → `docker compose restart web`

### Environment and conventions

- **Tools (checked 2026-10-26):** Git 2.56, GitHub CLI 2.103 logged in as
  `alireza-soleiman` (HTTPS, `repo` scope). Docker client 29.2, engine 29.9.
  **Docker Desktop does not auto-start**: start it before `docker compose up -d`.
  Python 3.11.9 on Windows (Microsoft Store build; used only for small helpers like
  `http.server`, not for Django). No GDAL on Windows, and none needed.
- **Ports:** 5432 is taken by a local Windows PostgreSQL → our PostGIS is on host port
  **5433**. Django (dashboard, API, admin): **8000**.
- **SQL files:** `sql/` is mounted read-only into `db` at `/sql` →
  `docker compose exec db psql -U nbs -d nbs -f /sql/<file>.sql`. The `tiger` schema
  in the database is the PostGIS image's US geocoder: ignore it.
- **Browser checks:** Windows display scaling is 125 %, so screenshot pixels = CSS
  pixels × 1.25. The browser pane's screenshots show OpenLayers canvases (admin map) as
  black: check canvas pixels with JS instead. Git Bash: use `MSYS_NO_PATHCONV=1` for
  paths starting with `/`. Multi-line Django shell code: Git Bash +
  `manage.py shell -v 0 -c "$(cat <<'EOF' … EOF)"`.
- **Commit email for this repo:** GitHub noreply
  `153937783+alireza-soleiman@users.noreply.github.com` (`git config --local`;
  global stays Gmail).
- **Data folders:** `data/raw/` = big downloads (ignored) · `data/sample/` = small sample
  data, e.g. NbS (committed). The map gets all data from the API (no static files)

### Milestone 4 log (done 2026-10-27)

- **Decision: geometries stored in EPSG:25832** (`catalog.models.SRID`); the API
  transforms to 4326
- App `catalog`: `Municipality` (`istat_code` unique, `name`, `name_alt`, `geom`
  MultiPolygon 25832) and `NbS` (`name`, `nbs_type` TextChoices with 9 types,
  `description`, `cost_eur`, `benefit_heat/flood/biodiversity/wellbeing` 0–5 (validator
  only, no DB check), `location` Point 25832, `municipality` FK filled in `save()` via
  `geom__contains`). Migration `0001_initial` (GiST indexes created by Django)
- `GISModelAdmin` for both (OpenLayers 7.2.2 + OSM). Admin user `admin`, data in `.env`
  (`DJANGO_SUPERUSER_*`), `createsuperuser --noinput` → http://localhost:8000/admin/.
  Fix: `SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'` (OSM tiles need a
  Referer)
- Commands: `import_municipalities` (GDAL `DataSource`, 116, re-runnable),
  `load_sample_nbs` (`data/sample/nbs_sample.csv`, 12 **fictional** NbS, `full_clean()`
  before `save()`): Merano 5, Lana 2, Naturno, Marlengo, Lagundo, Postal, Scena 1 each;
  total 2,930,000 EUR
- `scripts/orm_queries.py`: M3 questions in the ORM (`dwithin` + `D()`, `Distance`,
  `Sum`, `Centroid`/`PointOnSurface`, `Transform`)
- Old M3 table `istat_municipalities` still exists (SQL playground)

### Milestone 3 log (done 2026-10-27)

- `sql/` mounted read-only into `db` at `/sql`. `scripts/load_municipalities_postgis.sh`
  → table `istat_municipalities` (116 rows, MultiPolygon 25832, GiST). Needed
  `-lco PRECISION=NO` (shapefile `numeric(18,11)` overflowed)
- `sql/01_explore.sql` (province 7,400 km², Merano 25.98 km², multipart: Lagundo,
  Termeno) · `02_projections.sql` (Merano: 25.98 km² in 25832, 0.003054 sq degrees in
  4326, 25.99 km² geography, 55.14 km² in 3857) · `03_relationships.sql` (9 neighbours,
  point in polygon needs `ST_Transform`, centroid outside: Santa Cristina Valgardena) ·
  `04_buffers_distance.sql` (`<->`, `ST_DWithin`, `ST_Buffer`, `EXPLAIN ANALYZE`: index =
  bounding-box test then exact filter)
- Quiz: all 3 unknown → explained. Demo: mixed SRIDs inside `WHERE` give **0 rows, no
  error**

### Milestone 2 log (done 2026-10-27)

- `frontend/` (`index.html`, `css/map.css`, `js/map.js`): Leaflet 1.9.4 from unpkg with
  SRI `integrity`, OSM tiles, 116 municipalities via `fetch` + `L.geoJSON` (style
  function with Merano highlighted, tooltip, popup, hover + `resetStyle`, `fitBounds`,
  ISTAT attribution). Focus-outline rectangle hidden with
  `.leaflet-interactive:focus { outline: none; }`
- Served with `python -m http.server 8080 --bind 127.0.0.1 --directory frontend`
  ("map" in `.claude/launch.json`) → http://localhost:8080
- Data: ISTAT `data/raw/Limiti01012026_g.zip` (10.0 MB, boundaries at 1 Jan 2026),
  layer `Com01012026_g_WGS84`, **EPSG:32632**, fields `COD_PROV`, `PRO_COM_T` (ISTAT
  code), `COMUNE` (bilingual name), `COMUNE_A`, `Shape_Area`. South Tyrol =
  `COD_PROV = 21` → 116. Merano = `021051`, "Merano/Meran"
- `scripts/build_municipalities_geojson.sh` → `frontend/data/municipalities.geojson`
  (386 KB, EPSG:4326, RFC 7946, 5 decimals, `istat_code` + `name`)

### Milestone 1 log (done 2026-10-26 → 2026-10-27)

- Project rules in `CLAUDE.md`; teaching rules changed 2026-10-26 (Claude writes all
  code); output style **Explanatory** since 2026-10-27
- Git on `main`; `.gitignore` (Python, venv, Django, `.env*` except `.env.example`,
  `pgdata/`, `*.dump`, `*.backup`, `data/raw/`); `.gitattributes` (LF line endings)
- Public repo https://github.com/alireza-soleiman/nbs-mini-dashboard as `origin`;
  first push 2026-10-27 after rewriting all commits to the noreply email
- `compose.yaml`: `db` = `postgis/postgis:17-3.5` (named volume `nbs_pgdata`,
  healthcheck, `127.0.0.1:5433`, database/user `nbs`); `web` = Django built from
  `Dockerfile` (`python:3.12-slim-trixie` + Debian `gdal-bin`), code bind-mounted at
  `/app`, waits for a healthy `db`, `127.0.0.1:8000`
- **Decision 2026-10-27: Django runs in Docker** (no GDAL install on Windows).
  In the image: Django 5.2.18 (LTS), psycopg 3, GDAL 3.10.3, GEOS 3.13.1
- Django project `config`: `settings.py` reads `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`,
  `DJANGO_ALLOWED_HOSTS`, `POSTGRES_*` from env vars (`.env`, template `.env.example`);
  `postgis` backend; `django.contrib.gis`; `TIME_ZONE = 'Europe/Rome'`
- Verified: PostgreSQL 17.5 + PostGIS 3.5.2, `migrate` OK, Merano EPSG:4326 → EPSG:25832
  = (665194, 5170903), Django welcome page at http://localhost:8000
