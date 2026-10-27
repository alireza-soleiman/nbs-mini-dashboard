# NbS mini-dashboard

A small GIS dashboard for **Nature-Based Solutions (NbS)** in South Tyrol, built as a
learning project. It shows NbS on a map, filters them, and **ranks them by several
criteria with your own weights** (heat reduction, flood and stormwater, biodiversity,
health and wellbeing, cost).

> **The NbS data is fictional.** The 12 sample NbS around Merano were invented for
> learning (see `data/sample/README.md`). The municipality boundaries are real (ISTAT).

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
| http://localhost:8000/ | the dashboard |
| http://localhost:8000/api/ | the API (browsable in the browser) |
| http://localhost:8000/admin/ | the admin (login: `DJANGO_SUPERUSER_*` in `.env`) |
| `127.0.0.1:5433` | PostGIS for QGIS / pgAdmin (database and user `nbs`) |

## Project structure

```
config/        Django settings and URLs
catalog/       data: models, admin, import commands, API (serializers, views), tests
dashboard/     the web page: template, JavaScript (api.js, ranking.js, dashboard.js), CSS
data/sample/   sample NbS (CSV, fictional)          data/raw/   downloads (not in Git)
sql/           SQL exercises (Milestone 3)          scripts/    helper scripts
docs/GUIDE.md  how to use, change and test the project
compose.yaml   the two services: db (PostGIS) and web (Django)
```

## Tests

```
docker compose exec web python manage.py test
```

## Data sources and licences

- Municipality boundaries: © ISTAT, generalised boundaries on 1 January 2026.
- Background map: © OpenStreetMap contributors.
- NbS sample data: fictional, created for this project.
