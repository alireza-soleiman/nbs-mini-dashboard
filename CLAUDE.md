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
  - Created `CLAUDE.md`, `.claude/settings.json` (Learning output style), `LEARNING.md`
  - Added the **Git & GitHub** rules to `CLAUDE.md`
- **Tools checked (2026-10-26):** Git 2.56 (user name + email set), GitHub CLI 2.103 logged
  in as `alireza-soleiman` (HTTPS, `repo` scope), Git Credential Manager handles pushes.
  Docker 29.2 installed, but Docker Desktop was **not running**. Python 3.11.9 (Microsoft
  Store build). **No GDAL/GEOS/PROJ yet** (`C:\OSGeo4W` exists but is an empty leftover).
- **Milestone 1 plan:** 1.1 default branch `main` + `git init` · 1.2 `.gitignore` + first
  commit · 1.3 GitHub repo + `origin` · 1.4 PostGIS in Docker · 1.5 venv + Django ·
  1.6 GDAL/GEOS/PROJ for GeoDjango · 1.7 Django project on PostGIS, secrets from env vars ·
  1.8 verify, commit, push, quiz, `LEARNING.md`
- **Git in this folder:** initialised on branch `main` (step 1.1 done). Global
  `init.defaultBranch` is now `main` (overrides the system-level `master`). No commits, no
  remote yet
- **Next step:** 1.2 — `.gitignore`: "Secrets" section done (worked example by Claude);
  I write the "Data" section (my TODO), test it with `git check-ignore -v -n`, then the
  first commit
- **Open questions / blockers:** how to install GDAL for GeoDjango on Windows (OSGeo4W vs.
  running Django in Docker); decide at step 1.6
