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

## Work areas: two chats, one project

Since 2026-11-16 this project is worked on in **two Claude Code chats** in this same
folder. Both load this file automatically, so the rules, goals and **Shared decisions**
below are the same in both. Each chat keeps its own detailed notes.

| Chat | Covers | Notes (read at the start) |
|---|---|---|
| **1 – Dashboard Development** | the codebase: architecture, front end, back end, database, data processing, GIS, tests, deployment; branches `main`, `maplibre-prototype`, Phase 3; later the real dashboard | `docs/DEVELOPMENT_NOTES.md` (in Git) |
| **2 – HTML Mockups & Questionnaires** | the 4 HTML mockups (`meeting-mockup/`, built from branch `team-demo`), UI/UX and design discussions, the Eurac meeting, feedback form, requirements documents, questionnaires (`questionnaires/`) | `questionnaires/NOTES.md` (local only) |

**Keeping the two chats consistent:**

1. **One place for shared decisions.** A decision that matters to both areas goes into
   **Shared decisions** below (dated, with "affects: …"), in the chat where it is made.
   Details stay in that chat's notes; the other chat's notes are not copied.
2. **Telling the other chat.** This file is loaded when a chat starts. If the other chat
   is already open, I tell it: "re-read CLAUDE.md – new shared decision" (or the chat that
   made the decision suggests this to me).
3. **Typical cross-effects:** Eurac feedback and requirements (Chat 2) → scope and
   priorities for development (Chat 1). A technical constraint found in Chat 1 (hosting,
   data format, coordinate system, performance) → a question for Eurac or a mockup change
   (Chat 2). A change of the dashboard UI that the mockup shows → rebuild the HTML files
   (Chat 2).
4. **One checkout, one database.** Both chats use this folder: only one chat changes the
   Git branch or runs Docker/database commands at a time. Each chat checks
   `git branch --show-current` and `git status` before working and asks me before
   switching branches. Chat 1 works on `main` with the 29 sample NbS; Chat 2 needs
   `team-demo` with the 10 demo NbS only to rebuild the mockups, then
   `load_sample_nbs --replace` brings the 29 NbS back.
5. **Partner material stays local.** `meeting-mockup/` and `questionnaires/` are in
   `.git/info/exclude`; Eurac's answers and feedback are never committed. This file and
   `docs/` are public.
6. **End of each task:** update the own notes file; if something changed for both, also
   **Shared decisions** or **Current status** here.
7. **The same notes on every branch.** `CLAUDE.md` and `docs/DEVELOPMENT_NOTES.md` are
   project notes, not branch code, so they must be identical on `main`, `team-demo` and
   `maplibre-prototype` (otherwise a branch switch loads old rules). After changing them
   on one branch, copy them to the other branches through a temporary `git worktree`
   (no branch switch in the shared checkout) and commit there too.


## Shared decisions (both chats)

Dated decisions that affect both work areas. Add new ones here (with "affects: …").

- **Team feedback (2026-11-10):** I showed the dashboard to one person of the team; they
  liked it. Decisions: the real dashboard will be built later in a **separate project**
  (this one stays my prototype); final users = **municipalities** (simple, non-technical);
  **3D is not needed**; they want other chart forms; data should come in through an admin
  area. Agreed ideas: charts answer questions (not "chart types"); three roles
  (researchers manage data, municipalities view and weigh, someone sets the layout);
  chart choice = simple on/off list; a vulnerability layer on the map; sliders and Simos
  cards. In the meeting with the whole team I only **show**; afterwards I send a
  Word/Excel file with questions (not written yet)
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
- **Two chats (2026-11-16):** the work is split into Chat 1 Dashboard Development and
  Chat 2 HTML Mockups & Questionnaires (see "Work areas" above). Affects: both

## Current status (short – details in the area notes)

- **Chat 1 – Dashboard Development:** Phases 1–2 done; **Phase 3 (Milestone 8, handover
  quality) done 2026-11-18 on `main`**: production settings, WhiteNoise, gunicorn,
  `compose.prod.yaml`, pinned packages, score constraint, 24 Django + 8 JS tests, GitHub
  Actions (details: `docs/DEVELOPMENT_NOTES.md`). Next: push + first CI run; then
  learning spikes chosen by Eurac's answers; 3D branch decision (archive?) is mine.
  Requirements first: no development for the real dashboard before the Eurac scope is
  agreed (see Shared decisions). The shared folder is on `main` now: Chat 2 needs
  `team-demo` only to rebuild the mockups (ask me first)
- **Chat 2 – Mockups & Questionnaires:** the 4 HTML mockups with code labels are ready;
  the feedback form is built in Microsoft Forms (unshared); Document 2 (Word) is ready.
  Next: the team meeting, then share the form + the mockup zip and send Document 2
- **Open questions / blockers:** none (the old `data/sample/nbs_sample.csv` is deleted)

## Learning notes

- **Topics that were hard for me** (explain with code + a small demo when they come
  up): Docker networking (`localhost` inside a container); EPSG code = coordinate
  system, not an area; same SRID before comparing; who transforms (PostGIS via
  `ST_Transform` that Django writes); logic in `save()`; validation layers (`save()` vs.
  `full_clean()`/forms). Explaining with **exact code lines + a live demo** worked well

## Environment and conventions

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
- **Testing lessons (both chats):** never work around a stale browser cache in tests
  with a forced refresh – the user's browser has the same problem; a hidden browser pane
  pauses `requestAnimationFrame` and CSS animations (map tiles, fades); never click a
  file-upload button in browser automation (the native dialog freezes the tab)
