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
- **After each milestone:** ask me 2–3 short questions to check I understood,
  and remind me to **commit to Git**.
- **Never move to the next milestone until I say so.**
- After each milestone, help me write what I learned in `LEARNING.md`.
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

- **Milestone:** 1 — Setup (started 2026-10-26)
- **Done so far:**
  - Created `CLAUDE.md`, `.claude/settings.json`, `LEARNING.md`
  - Added the **Git & GitHub** rules to `CLAUDE.md`
  - Changed teaching rules (2026-10-26): Claude writes all code, I don't write code.
    Output style switched from Learning to **Explanatory** (2026-10-27)
  - 1.1 Git initialised on `main` (global `init.defaultBranch main` overrides system `master`)
  - 1.2 `.gitignore` (Python, venv, Django, secrets `.env*` except `.env.example`,
    `pgdata/`, `*.dump`, `*.backup`, `data/raw/`) and `.gitattributes` (LF line endings)
  - 1.3 Public GitHub repo created and set as `origin`:
    https://github.com/alireza-soleiman/nbs-mini-dashboard (**nothing pushed yet**)
  - 1.4 PostGIS in Docker via `compose.yaml` (service `db`, image `postgis/postgis:17-3.5`,
    named volume `nbs_pgdata`, healthcheck). Secrets in `.env` (ignored, random password),
    template in `.env.example`. Reachable at `127.0.0.1:5433`, database/user `nbs`.
    Verified: PostgreSQL 17.5, PostGIS 3.5.2, first `ST_MakePoint` query works
  - **Decision (2026-10-27): Django runs in Docker too** (no GDAL install on Windows)
  - 1.5 `Dockerfile` (`python:3.12-slim-trixie` + Debian `gdal-bin`), `requirements.txt`
    (Django 5.2 LTS, psycopg 3), `.dockerignore`, `web` service in `compose.yaml`
    (code bind-mounted at `/app`, waits for a healthy `db`, port `127.0.0.1:8000`).
    In the image: Django 5.2.18, GDAL 3.10.3, GEOS 3.13.1
  - 1.6 Django project `config` (`manage.py` in the repo root). `settings.py` reads
    `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` and `POSTGRES_*` from env
    vars, uses the `postgis` backend, has `django.contrib.gis`, `TIME_ZONE = 'Europe/Rome'`
  - 1.7 Verified: `manage.py check` OK, `migrate` OK, Merano transformed from EPSG:4326 to
    EPSG:25832 (665194, 5170903), welcome page HTTP 200 at http://localhost:8000
- **Tools checked (2026-10-26):** Git 2.56 (user name + email set), GitHub CLI 2.103 logged
  in as `alireza-soleiman` (HTTPS, `repo` scope), Git Credential Manager handles pushes.
  Docker client 29.2, engine 29.9. **Docker Desktop does not auto-start**: start it before
  `docker compose up -d`. Python 3.11.9 on Windows (Microsoft Store build; not used to run
  Django). No GDAL on Windows, and none needed (`C:\OSGeo4W` is an empty leftover).
  **Port 5432 is taken** by a local Windows PostgreSQL, so our PostGIS uses host port 5433.
- **Milestone 1 plan:** 1.1 default branch `main` + `git init` · 1.2 `.gitignore` + first
  commit · 1.3 GitHub repo + `origin` · 1.4 PostGIS in Docker · 1.5 Django image with GDAL
  + `web` service · 1.6 Django project on PostGIS, secrets from env vars · 1.7 verify
  GeoDjango · 1.8 push (ask first), quiz, `LEARNING.md`
- **Data folders:** `data/raw/` = big downloads (ignored), `data/sample/` = small files (committed)
- **Next step:** 1.8 — first push (needs my OK), quiz, write Milestone 1 in `LEARNING.md`
- **Open questions / blockers:**
  - before the first push: commits use my personal Gmail as author email, which becomes
    public on GitHub. Keep it, or switch to the GitHub `noreply` address?
