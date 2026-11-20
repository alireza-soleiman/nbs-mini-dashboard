# Dashboard Development – notes (Chat 1)

Technical status and logs of the NbS mini-dashboard itself. The shared rules, goals and
decisions are in `CLAUDE.md` (loaded automatically in both chats). Update this file at
the end of each development task. Mockups, questionnaires and the Eurac meeting are
Chat 2 (`questionnaires/NOTES.md`, local only).

## Status

- **Phase 1 (Milestones 1–7): done and pushed** (2026-10-26 → 2026-10-27)
- **Phase 2 (richer dashboard, my 5 requests): done and pushed** (2026-10-27):
  polygons/lines as NbS, click-to-zoom, realistic sample data, overview page, modern
  sidebar. Guide, README and `LEARNING.md` updated
- **LinkedIn (2026-10-27):** post text and presentation talk drafted in chat (not in the
  repo; don't name Eurac/CRESCITA without their OK). Demo video + 4 screenshots made by
  `scripts/record_demo.py` (Playwright + headless Chromium + ffmpeg; 45 s, 1920×1080
  MP4, captions and pointer injected) → `linkedin/` (ignored by Git). The tools were
  installed in `%TEMP%\nbsvid` (short path: the scratchpad path broke Windows' 260-char
  limit) and **deleted after my OK**; to re-record, install them again (script header).
  The recording found a phone bug (results hidden behind the bottom sheet) → fixed.
  Keep the excluded city out of the pictures: the phone screenshot zooms to Merano (z 12)
- **Real NbS shapes (2026-11-02, on `main`):** my request: "if this NbS is a green roof
  of a sports hall it should be exactly on the sports hall". All 29 sample shapes are now
  real OSM features, made by `scripts/build_sample_shapes.py` (recipes `area`, `wall`,
  `stretch`, `middle`, `spot` + OSM way ids; costs = unit cost × real size, rounded to
  €5K; `osm` property in the GeoJSON; texts adjusted where the real place differs, e.g.
  NAT-02 town hall, TIR-02 park on a meadow). Downloads cached in
  `data/raw/osm/nbs_sources.json` via the OSM API (Overpass was 502/504 most of the
  day; Overpass needs a User-Agent, else HTTP 406). Checked: municipality of every NbS
  (LAG-03 and POS-02 fixed with PostGIS checks; the Adige is the Postal–Lana border north
  of 46.6068), screenshots of MER-07/MAR-02/CER-01/POS-02/LAN-01. New numbers in GUIDE
  §5 and §8.2 (Balanced top MER-05 83, last MER-04 49; Flood POS-01 83; Low budget
  MER-05 85; totals €8.3M, 3.8 ha, 5.1 km). Licence ODbL noted in both READMEs
- **Branch `maplibre-prototype` (not merged; archived 2026-11-18 as tag
  `archive/maplibre-prototype`, tag pushed to GitHub 2026-11-20, so a fresh clone has
  it too; restore with
  `git switch -c maplibre-prototype archive/maplibre-prototype`; the shared database
  still has its nullable `height_m` column and the migration row `0003_nbs_height_m` –
  harmless for `main`)** – its notes, copied from that branch's `CLAUDE.md` on
  2026-11-16:
- **MapLibre prototype (2026-11-02), branch `maplibre-prototype` (not pushed, not
  merged):** after Mapbox research (Mapbox GL JS = proprietary + token since v2;
  MapLibre = BSD fork) I chose a prototype. `/map-3d/` (name `map3d`, nav "3D map
  beta"): MapLibre **5.24.0** from cdnjs with SRI; backgrounds OpenFreeMap
  `liberty`/`positron` + own style with EOX Sentinel-2 2023 (WMTS `{z}/{y}/{x}`,
  maxzoom 14, CC BY-NC-SA); Terrarium terrain (maxzoom 15, exaggeration 1) + hillshade;
  sky. `map3d.js`: layers re-added on every `style.load` (`setStyle(…, {diff: false})`,
  `structuredClone` of the style object); `step` colour expressions built from
  `SCORE_CLASSES`; feature state `selected`/`hover`; shapes under the basemap labels;
  presets only. Shared modules: `popup.js` (`popupHtml(row, total)`), `panel.js`
  (`summaryHtml`, `legendHtml`, `renderRanking`, `markSelectedCard`). 20 tests OK.
  Verified with JS in the hidden pane (rAF replaced by a timer for tests; canvas copied
  into an `<img>` for screenshots): same ranking numbers as GUIDE §8.2, background
  switches keep popup + selection, deep link. Basemap warning "Expected value to be of
  type number, but found null" = OpenFreeMap `building-3d` (harmless).
  South Tyrol WMS orthophotos tested and rejected (patchy coverage per year)
- **3D improvement 1 (2026-11-02, branch only): roofs and facades up high.** New field
  `NbS.height_m` (PositiveSmallIntegerField, null; migration `0003_nbs_height_m`; in the
  API; loader reads it if present). Build script: OpenMapTiles rule `max(5, round(height
  or levels × 3.66 or 5))` — checked against the basemap's `render_height` for all 7
  roof/facade buildings (MER-01/MER-04 11 m, LAN-02 15 m, others 5 m). `map3d.js`:
  ground fill/outline only for NbS without height; `nbs-roof` fill-extrusion slab
  (base = height, +1.2 m, selected +2.5 m); `nbs-wall` from source `nbs-walls` (facade
  line → 1 m strips in the browser); `nbs-building` grey block only on backgrounds
  without 3D buildings (satellite, light); click/hover work on all. 21 tests OK
- **Phases renamed (2026-10-27):** Phase 2 = richer dashboard (was not planned);
  handover quality moved to Phase 3
- **Review of the whole dashboard (2026-11-18, `main`, ≈2,500 lines):** 25 tests OK (run
  on `team-demo` = main's 19 + 6). `check --deploy` with DEBUG off: 4 HTTPS warnings
  (W004 HSTS, W008 SSL redirect, W012/W016 secure cookies). Outdated: DRF 3.16.1 (3.18.3
  exists), psycopg 3.3.6 (3.3.9); Django stays on 5.2 LTS (supported to April 2028).
  Findings: `runserver` in the image, no `STATIC_ROOT`/collectstatic, container runs as
  root; `.dockerignore` misses the local `meeting-mockup/`, `questionnaires/`,
  `linkedin/` (`COPY . .` would put partner material into the image); version ranges, no
  lock file; no CI; 0–5 scores only by validators (no `CheckConstraint`); stale reference
  to the removed `scripts/build_municipalities_geojson.sh` in `import_municipalities.py`;
  `ranking.js` has no automated tests; API without pagination or caching (fine for 29,
  not for thousands); standard OSM tiles and the unpkg CDN are not for production; English
  only; no roles besides the Django admin; no vulnerability layer on `main`. Options:
  quick fixes → **Phase 3** (production settings, gunicorn, static files, pinned
  dependencies, `CheckConstraint`, JS tests with `node:test`, GitHub Actions) → learning
  spikes chosen by Eurac's answers (vulnerability layer, DE/IT, roles, file upload, real
  Simos-Roy-Figueira weights); 3D branch: archive with a tag (team: 3D not needed)
- **Phase 3 = Milestone 8, handover quality (2026-11-18, on `main`):** my choice after
  the review: quick fixes + Phase 3. Commits: quick fixes (`.dockerignore` excludes
  `meeting-mockup/`, `questionnaires/`, `linkedin/`, `staticfiles/`; checked by listing
  `/app` in a built image) · settings (`DJANGO_HTTPS` switch: SSL redirect, secure
  cookies, HSTS 3600 s by default, `SECURE_PROXY_SSL_HEADER`; `CSRF_TRUSTED_ORIGINS`,
  `DJANGO_LOG_LEVEL` from `.env`; W005/W021 silenced with the reason; `STATIC_ROOT`;
  `STORAGES` = plain files when DEBUG, else `config.storage.StaticStorage` =
  WhiteNoise `CompressedManifestStaticFilesStorage` + `support_js_module_import_aggregation`
  (rewrites `import … from "./api.<hash>.js"`, double quotes); `whitenoise.runserver_nostatic`
  → dev sends `max-age=0`; LOGGING to console) · server (Dockerfile: user `app`
  uid 10001, `collectstatic` at build with dummy env, CMD gunicorn 3 workers +
  access log; `compose.yaml` keeps `runserver` and **`user: root`** – the Windows mount
  lets only root write into subfolders (makemigrations failed as `app`);
  `compose.prod.yaml`: same project name/volume, DEBUG 0, no code mount, db without
  port, restart policies) · pinned packages (`requirements.in` → `requirements.txt`
  by pip-compile in a throwaway root container: Django 5.2.19, DRF 3.16.1, DRF-gis
  1.3.0, psycopg 3.3.9, WhiteNoise 6.12.0, gunicorn 23.0.0) · `CheckConstraint` ≤ 5 on
  the 4 benefits (migration `0003_benefit_scores_at_most_5`; the 3D branch also has a
  `0003` → a merge migration would be needed if it is ever merged) · tests: 24 Django
  (+ constraint, + 4 for `load_sample_nbs`) and 8 JS (`tests/js/ranking.test.mjs`,
  `node --test "tests/js/*.test.mjs"`; a folder argument fails in Node 24; `.mjs`
  because no `package.json` – a root `"type": "module"` would break CommonJS scripts) ·
  CI `.github/workflows/tests.yml` (Django job in Docker with a random `.env`,
  `makemigrations --check`, `check --deploy --fail-level WARNING`; JS job Node 24;
  checkout/setup-node v5). Verified: server mode in the browser (hashed modules load,
  same numbers, no console errors), gzip + `immutable` headers, plain 404, logs.
  Docs: README "Running it like on a server", GUIDE §8.1/§8.4/§9/§10, LEARNING Phase 3

### Phase 2 log (done 2026-10-27)

- **Model:** `NbS.location` (Point) → `NbS.geom` (GeometryField, any type) + `NbS.code`
  (unique, nullable). Hand-written migration `0002_nbs_any_geometry_and_code`
  (RenameField + AlterField + AddField). `save()`: municipality from
  `geom.point_on_surface`; `code '' → None`
- **Data:** `data/sample/nbs_sample.geojson`: 29 fictional NbS, 11 municipalities,
  14 polygons / 12 lines / 3 points, codes `MER-01` …, costs = unit cost × size.
  Generated once by a script (not in Git); MER-02 (Passer promenade) and POS-01/POS-02
  (Adige at Postal) were measured on the map and placed on the real banks.
  `load_sample_nbs` reads GeoJSON, matches by `code`, `--replace`, `--file`. Old CSV removed
- **API:** NbS feature = full geometry in 4326 + `marker` [lon, lat] (`PointOnSurface`) +
  `geometry_type`, `area_m2`, `length_m`, `code`; `defer('geom')`; `near` uses
  `geom__dwithin` (nearest part). `/api/summary/` (`totals`, `by_geometry`
  {points, lines, polygons}, `by_type` with average benefits, `by_municipality`);
  `GeometryType` via `Func`. First request also reads `spatial_ref_sys` once (tests warm up)
- **Pages:** `dashboard/templates/dashboard/base.html` (nav, API URLs incl.
  `data-summary-url`, `data-map-url`), `overview.html` at `/` (name `overview`),
  `map.html` at `/map/` (name `map`). JS: `api.js`, `ranking.js` (+ `PRESETS`),
  `colors.js` (score classes, heatmap ramp without step 450), `format.js`,
  `overview.js` (KPIs, bars, heatmap, log-scale scatter, top 5, tooltip), `map.js`
  (municipality pane below shapes, shapes + white casing for lines, markers, select →
  fly + popup + card + `#nbs=<id>`, chips, datalist search, presets, sliders,
  collapse with `transitionend` + 300 ms fallback, bottom sheet on phones)
- **Design:** tokens in `dashboard.css` (light/dark), green = UI, blue = data,
  `prefers-reduced-motion`, sheet `z-index: 1001` above Leaflet controls
- **Verified in the browser:** numbers in GUIDE §8.2 (Balanced top TIR-02 81, MER-05 80,
  MER-02 80, last MER-03 49; Flood POS-01 81; Low budget MER-02 84; totals €9.1M,
  4.9 ha, 5.1 km), click-to-zoom, deep link, collapse, phone layouts. 19 tests OK
- Testing gotchas: the hidden browser pane pauses animations; the browser caches CSS
  (check with a `?v=` reload)

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
