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
- **Team feedback (2026-11-10):** I showed the dashboard to one person of the team; they
  liked it. Decisions: the real dashboard will be built later in a **separate project**
  (this one stays my prototype); final users = **municipalities** (simple, non-technical);
  **3D is not needed**; they want other chart forms; data should come in through an admin
  area. Agreed ideas: charts answer questions (not "chart types"); three roles
  (researchers manage data, municipalities view and weigh, someone sets the layout);
  chart choice = simple on/off list; a vulnerability layer on the map; sliders and Simos
  cards. In the meeting with the whole team I only **show**; afterwards I send a
  Word/Excel file with questions (not written yet)
- **Team demo (2026-11-10), branch `team-demo` from `main` (not pushed):** the dashboard
  plus mockups, all labelled "Mockup – sample data". 10 NbS (`nbs_demo.geojson`: MER-01,
  MER-02, MER-05, MAR-02, LAN-01, LAN-04, LAG-02, NAT-03, SCE-01, POS-01). Overview:
  "Other options" button per section → side panel (`OPTIONS` in `overview.js`, charts in
  `mockup-charts.js`: `donut`, `dotTable`, `radar`, `splitBar`, `quadrant`). Map: "More
  ideas" box (`map-ideas.js`: invented heat zones / municipalities, EOX satellite, cards
  → weights 10-8-6-4-2, score bar in the popup). New pages `/compare/` (`compare.js`) and
  `/admin-mockup/` (`admin-mockup.js`; 3 steps Data/Criteria/Display, nothing saved;
  `/admin/` stays Django's). Checked: every option and screen, light + dark, phone widths,
  23 tests OK. Numbers: €2.4M, 7 municipalities, Balanced MER-05 82, MER-02 79, NAT-03 76.
  GUIDE §11 = demo path + how to go back. **The database is shared by all branches:**
  after the demo `load_sample_nbs --replace` brings the 29 NbS back. The DB also has the
  3D branch's `height_m` column (migration 0003); harmless on `main`/`team-demo`.
  Gotchas: Django `{# #}` comments are one line only (use `{% comment %}`); a hidden
  browser pane freezes CSS animations mid-way (no opacity in animations)
- **Demo fixes after my first test (2026-11-10):** (1) "Other options" did nothing in my
  browser = **stale cache**: runserver's static handler sends no cache rule, so the
  browser kept the 2-week-old `overview.js`. Fix on `team-demo`: `compose.yaml` runs
  `runserver --nostatic`; `config/urls.py` serves `/static/` in DEBUG with
  `Cache-Control: no-cache` (always revalidate, 304 if unchanged); templates use
  `?v=demo2` once to skip the stale copies. Proved with a normal reload after a CSS
  change. **Lesson for Claude: never work around a stale cache in tests with a forced
  refresh; the user's browser has the same problem.** (2) My wish: **everything** is
  marked mockup: all 4 nav tabs, the top badge ("Mockup – sample data"), a banner on the
  Overview, and a CSS `::after` "Mockup" tag on every section title. 24 tests OK
- **Admin form map (2026-11-11):** I missed a map in "Add an NbS" (it was a grey
  placeholder). Now a real Leaflet map (`place-map.js`): Point / Line / Area by
  clicking, "Start again", municipality found in the browser by ray casting on the
  API outlines (the real project: PostGIS in `NbS.save()`), size in m/km/m²/ha; *Edit*
  shows the saved shape. Nothing is saved. Checked in my real Chrome with Claude in
  Chrome (I offered it): options panel animation, map flight + popup, drawing with real
  clicks all work. The demo click path is in `docs/GUIDE.md` §11 (I could not find it:
  give the file link, or paste the steps in chat). 25 tests OK
- **Exact places in the Admin form (2026-11-11):** my wish: "add real geo data to find
  the exact place instead of putting it manually". `place-sources.js` adds three ways
  next to drawing; each ends in `setShape(geometry, note)` of `place-map.js`:
  **search** (Nominatim, `polygon_geojson=1`, bounded to South Tyrol; the OSM outline
  becomes the place; names set with `textContent`), **coordinates** (EPSG:4326 or
  EPSG:25832 via `utm32ToLonLat`, Krüger series; equal to GEOS to 7 decimals for 3
  points), **file** (GeoJSON, first shape, metres converted; example file = the MER-07
  sports hall). Friendly errors (swapped numbers, broken or far-away file). Nothing
  is saved. The search needs internet and sends the typed text to Nominatim
- **Standalone HTML files for the team (2026-11-12, local only):** my wish: 4 HTML files
  (one per tab) the team can open themselves, no Docker. In `meeting-mockup/` (ignored
  via `.git/info/exclude`, never committed): `overview.html`, `map-and-ranking.html`,
  `compare.html`, `admin.html`, `README.txt`, `NbS-dashboard-mockup.zip` (347 KB).
  Made by `meeting-mockup/build/build.py` (Windows Python, needs the dashboard running
  with the 10 demo NbS): takes the rendered pages, inlines `dashboard.css`, Leaflet 1.9.4
  (`build/leaflet.*`, SHA-256 checked against the templates) and a **mini bundler**
  (each ES module in its own IIFE; Chrome blocks module files on `file://`); `api.js` →
  a stand-in answering from saved API data with the type/municipality filters;
  municipality outlines rounded to 4 decimals. **Found:** `tile.openstreetmap.org` sends
  "403 Access blocked" tiles to pages without a Referer (double-clicked files); CARTO now
  needs an API key → the files use `tile.openstreetmap.de` (same with/without Referer).
  Nominatim works from `file://` (`Access-Control-Allow-Origin: *`). Tested with the
  Django server **stopped** (all 4 pages, filters, ideas, compare, admin incl. search /
  coordinates / file / drawing; no console errors). The browser pane can't open big
  local files (`data:` snapshot) → tested over a temporary `http.server` entry in
  `.claude/launch.json`, then `git restore`. Rebuild after dashboard changes:
  `python meeting-mockup/build/build.py`
- **Questionnaires (2026-11-12 → 11-13, local only):** my wish: questions Eurac must
  answer (development and going online) + questions for me as the full-stack developer,
  in Excel. In `questionnaires/` (ignored via `.git/info/exclude`):
  `EURAC_Research_Project_Requirements_and_Technical_Questions.xlsx` (12 areas, 125
  questions, 80 Mandatory, IDs `E1.01`…, Contacts sheet with 15 roles) and
  `Full-Stack_Developer_Technical_Preparation_and_Self-Assessment.xlsx` (11 areas, 94
  items, 13 Critical, IDs `D1.01`…, self-assessment, priority, status, required action,
  resources). Sheets: How to use, Questions (question row + grouped option rows A) B)…
  Other / Not sure, tick with `x`), Summary (`COUNTIFS` on Status, progress bar). Made by
  `questionnaires/build/build_questionnaires.py` (texts in `content_eurac.py`,
  `content_developer.py`; openpyxl in `%LOCALAPPDATA%\Temp\nbsxl`, installed with
  `PIP_USER=0` because the Store Python forces `--user`), then `check_with_excel.ps1`
  **once per file** (Excel COM: recalculate, fit rows, save; 0 formula errors; switches
  off the one "inconsistent formula" mark on the Total progress cell; PDFs; test: one
  item done → Summary counts it). E/D prefixes because `1.01` gave "number stored as
  text" marks
- **Easier Eurac forms (2026-11-13, local only):** my wish: the long Excel is hard to
  navigate → both an HTML page and an easier Excel, built by two parallel sessions
  (Opus: HTML, Sonnet: Excel) with this session coordinating. Contract first:
  `eurac_shared.py` (IDs, option letters = the master's A) B)…, roles project 49 + 22
  shared / it 44 / data 20 / legal 12 / all 125, answer JSON format, `EASY_HEADERS`,
  defined name `respondent_name`). `EURAC_Research_Questionnaire.html` (`build_html.py`;
  offline, no network, role filter, one question per screen, localStorage autosave,
  "Save answers as file" → JSON) and `EURAC_Research_Questionnaire_by_area.xlsx`
  (`build_easy_excel.py`, `check_easy_excel.ps1`; Start sheet with links + progress,
  12 area sheets, 1 row per question, 68 drop-downs from a hidden "Lists" sheet).
  `import_answers.py` merges .json/.xlsx answers into the master (ticks add up, texts
  with names, different statuses or one-answer choices → "Needs discussion", sheet
  "Imported answers", SHA-256 against double imports, backup, then the Excel check,
  which also sets the H17 "ignore" again: openpyxl drops it). `build_questionnaires.py`
  now refuses to overwrite a filled-in file (`--force`). Six questions say "answer
  column"/"Contacts sheet": both forms show a note → comment. Round trip checked:
  real clicks in the page → JSON → import (+ both samples) → Summary 7 / 5 / 3 / 110,
  8 %. How-to: `questionnaires/README.txt`. Gotcha: PowerShell `$r = if (…) {$range}`
  unrolls a COM range into cells (assign inside the branches)
- **First round for Eurac (2026-11-16, paused by me):** wish: a short version for the
  first meeting (only what is needed to start + the 4 mockups), as a Microsoft Form in my
  Eurac account (org-only: answers stay in Eurac's Microsoft 365). Draft
  `questionnaires/first_round/first_round_questions.md` (21 questions, 4 sections, E-IDs)
  + pictures `first_round/images/` (`make_pictures.ps1`: headless Edge, light mode;
  `map.jpg` from the browser pane, because headless Edge catches Leaflet tiles mid-fade).
  Form "NbS dashboard – first questions" = **unshared draft** in my Forms: section 1
  (6 questions) + section 2 started (questions 6–8 done, 9 has only its title).
  **Stopped: I first pick the questions myself from the 125, then we decide.** Forms
  gotchas: new questions inherit Required / Multiple answers / subtitle field; Enter in
  an option jumps to the next one (a new one at the end; focus moves ~1 s later);
  "Add option" text is real text → Ctrl+A before typing; with a subtitle field Tab order
  breaks → click option 1 directly; confirm the add menu is open before clicking a type
- **New approach (2026-11-16, my strategy):** first meeting = present the mockup and ask
  vision questions live; then **two separate documents**: (1) **mockup feedback**
  (opinions, each person, Microsoft Forms) and (2) **requirements & technical info**
  (facts, one combined Eurac answer, shared Word). Then consolidation workshop
  (Must/Should/Could/Won't) → mockup v2 + scope summary confirmed by Eurac (test with a
  pilot municipality) → technical planning with IT → development. Don't lead with the
  Django prototype; the full 125 questions stay my master checklist (round 2).
  Built in `questionnaires/first_round/`: `doc1_mockup_feedback.md` (22 questions, 6
  sections, 4 Likert grids with the element codes, **waiting for my review before the
  Forms build**) and `EURAC_Project_Requirements_and_Technical_Information.docx`
  (`build_doc2.js`, npm `docx` 9.15 in `%LOCALAPPDATA%\Temp\nbsdocx`; 7 pages, sections
  A understood-in-meeting / B contacts / C data / D technical / E later topics; 112 real
  checkbox content controls, checked in Word 16; pages as PNG via Word
  `Pages(i).EnhMetaFileBits` – no pdftoppm/LibreOffice here). **Element codes** on the 4
  mockup files (O1–O7, M1–M6, C1–C2, A1–A7): `meeting-mockup/build/codes.py` (injected
  block, idempotent, MutationObserver + `setTimeout` – rAF is paused in hidden tabs);
  `build.py` adds them on every build; README explains them. Pictures redone
  (`first_round/images/`). The old Forms draft can become Document 1 or be deleted
- **Document 1 built in Microsoft Forms (2026-11-16):** "NbS dashboard mockup – your
  feedback" in my Eurac Forms, **unshared**; 22 questions / 6 sections / 4 pictures,
  read back as text = the spec. Old draft in Forms' recycle bin. Forms automation notes:
  type checks via `document.activeElement` before typing (stop on mismatch); choice
  options: Tab Tab from the title, Enter = next option; Likert: columns Tab Tab,
  delete column 5 via its button, add rows with "Add statement" then fill **bottom-up
  with one Shift+Tab per row**; Ranking: rows keep their buttons (click rows via ref);
  pictures: **never click the upload button** (native dialog freezes the tab) → "Insert
  Image" panel creates a hidden `input[type=file]` → `file_upload` on it; question
  subtitles are inherited and break Tab order → hints go in titles
- **Next step:** the meeting; then share the form link + the 4 HTML files (zip), and
  send Document 2 with section A pre-filled. **Phase 3** (Milestone 8, handover quality) and the 3D branch are
  paused — **waiting for my go-ahead**
- **Open questions / blockers:** none (the old `data/sample/nbs_sample.csv` is deleted)
- **Phases renamed (2026-10-27):** Phase 2 = richer dashboard (was not planned);
  handover quality moved to Phase 3
- **Topics that were hard for me** (explain with code + a small demo when they come
  up): Docker networking (`localhost` inside a container); EPSG code = coordinate
  system, not an area; same SRID before comparing; who transforms (PostGIS via
  `ST_Transform` that Django writes); logic in `save()`; validation layers (`save()` vs.
  `full_clean()`/forms). Explaining with **exact code lines + a live demo** worked well

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
