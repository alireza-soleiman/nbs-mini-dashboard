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

_Not started yet._

## Milestone 3 — PostGIS in SQL (spatial queries, projections)

_Not started yet._

## Milestone 4 — GeoDjango models + import script

_Not started yet._

## Milestone 5 — GeoJSON API with djangorestframework-gis

_Not started yet._

## Milestone 6 — Connect Leaflet to the API (filters)

_Not started yet._

## Milestone 7 — Multi-criteria ranking (weight sliders)

_Not started yet._

## Milestone 8 — Handover quality (README, Docker Compose, docs)

_Not started yet._
