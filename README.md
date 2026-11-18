# NbS mini-dashboard

[![tests](https://github.com/alireza-soleiman/nbs-mini-dashboard/actions/workflows/tests.yml/badge.svg)](https://github.com/alireza-soleiman/nbs-mini-dashboard/actions/workflows/tests.yml)

A small GIS dashboard for **Nature-Based Solutions (NbS)** in South Tyrol, built as a
learning project:

- an **overview page** with key figures and charts (types, costs per municipality,
  benefit profile, cost against benefit, top 5);
- a **map page** where NbS are drawn as **points, lines or polygons**, filtered by type
  and municipality, and **ranked by several criteria with your own weights** (heat
  reduction, flood and stormwater, biodiversity, health and wellbeing, cost), with
  presets and an explanation of every score.

> **The NbS data is fictional, the places are real.** The 29 sample NbS in 11
> municipalities around Merano were invented for learning (see `data/sample/README.md`),
> but each one lies on a real OpenStreetMap feature: a real roof, street, river or
> meadow. The municipality boundaries (ISTAT) are real too.

**Stack:** Django 5.2 + GeoDjango · PostgreSQL 17 + PostGIS 3.5 · Django REST Framework +
djangorestframework-gis · Leaflet 1.9.4 · Docker Compose.

**How to use, change and test everything: [docs/GUIDE.md](docs/GUIDE.md).**

## Quick start (first time)

You need **Docker Desktop** (running) and **Git**.

1. **Get the code**
   ```
   git clone https://github.com/alireza-soleiman/nbs-mini-dashboard.git
   cd nbs-mini-dashboard
   ```
2. **Create your `.env`** (local settings and secrets, never committed)
   ```
   Copy-Item .env.example .env
   ```
   Open `.env` and replace every `change-me` with your own values (long random strings
   for `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, `DJANGO_SUPERUSER_PASSWORD`).
3. **Download the municipality boundaries** (10 MB, ISTAT) into `data/raw/`:
   https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/Limiti01012026_g.zip
4. **Start, create the tables, load the data, create the admin user**
   ```
   docker compose up -d --build
   docker compose exec web python manage.py migrate
   docker compose exec web python manage.py import_municipalities
   docker compose exec web python manage.py load_sample_nbs
   docker compose exec web python manage.py createsuperuser --noinput
   ```
5. Open **http://localhost:8000**

## Every day

```
docker compose up -d      # start (Docker Desktop must be running)
docker compose down       # stop; the data stays in the Docker volume
```

## Addresses

| Address | What |
|---|---|
| http://localhost:8000/ | overview: key figures and charts |
| http://localhost:8000/map/ | map, filters, priorities and ranking |
| http://localhost:8000/api/ | the API (browsable in the browser); `/api/summary/` = totals |
| http://localhost:8000/admin/ | the admin (login: `DJANGO_SUPERUSER_*` in `.env`) |
| `127.0.0.1:5433` | PostGIS for QGIS / pgAdmin (database and user `nbs`) |

## Project structure

```
config/            Django settings, URLs, static-file storage
catalog/           data: models, admin, import commands, API (serializers, views), tests
dashboard/         the pages: templates, JavaScript (overview.js, map.js, ranking.js, …), CSS
data/sample/       sample NbS (GeoJSON, fictional)      data/raw/   downloads (not in Git)
sql/               SQL exercises (Milestone 3)          scripts/    helper scripts
tests/js/          tests for the JavaScript ranking (Node's built-in test runner)
docs/GUIDE.md      how to use, change and test the project
compose.yaml       development: db (PostGIS) + web (Django runserver, code mounted)
compose.prod.yaml  like on a server: gunicorn, DEBUG off, code inside the image
requirements.in    the Python packages we want → requirements.txt (exact versions)
.github/workflows/ the tests that GitHub runs on every push
```

## Tests

```
docker compose exec web python manage.py test     # 24 Django tests (API, admin, commands, …)
node --test "tests/js/*.test.mjs"                 # 8 tests of the ranking (Node 22+)
```

GitHub runs both on every push (badge at the top), plus a check for missing migrations
and Django's production checklist. The manual checklist is in
[docs/GUIDE.md](docs/GUIDE.md#8-testing-all-features).

## Running it like on a server

`compose.prod.yaml` runs the same image the way a server would: **gunicorn** instead of
the development server, `DEBUG` off, static files collected and served with hashed names
(WhiteNoise), the database without an open port, automatic restarts.

```
docker compose -f compose.prod.yaml up -d --build                  # build and start
docker compose -f compose.prod.yaml exec web python manage.py migrate
docker compose -f compose.prod.yaml logs -f web                    # one line per request
docker compose up -d                                               # back to development
```

On a real server, put a reverse proxy with HTTPS in front (e.g. nginx or Traefik) and
set in `.env`: `DJANGO_HTTPS=1`, `DJANGO_ALLOWED_HOSTS=<host name>`,
`DJANGO_CSRF_TRUSTED_ORIGINS=https://<host name>`, new secrets, and `DJANGO_DEBUG=0`.
Check with `python manage.py check --deploy` (it should report no issues). Before real
use, also replace the standard OpenStreetMap tiles and the unpkg CDN (fine for a demo,
not meant for production traffic).

**Updating a Python package:** change the range in `requirements.in`, regenerate
`requirements.txt` (the command is at the top of `requirements.in`), rebuild, run the
tests, commit both files.

## Data sources and licences

- Municipality boundaries: © ISTAT, generalised boundaries on 1 January 2026.
- Background map: © OpenStreetMap contributors.
- NbS sample data: fictional, created for this project. Their shapes: © OpenStreetMap
  contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright) (made by
  `scripts/build_sample_shapes.py`).
