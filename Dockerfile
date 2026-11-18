# Image for the Django app: Python plus the GIS libraries GeoDjango needs.
# The same image is used on the PC (compose.yaml: runserver, code mounted) and on a
# server (compose.prod.yaml: gunicorn, code inside the image).
FROM python:3.12-slim-trixie

# No .pyc files in the project folder; show print()/log output immediately
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# GDAL from Debian. It also installs GEOS and PROJ as dependencies,
# plus command-line tools like ogr2ogr (useful in Milestone 3).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin \
    && rm -rf /var/lib/apt/lists/*

# An ordinary user for the app (Milestone 8): if someone ever broke into the web app,
# they would not be the administrator ("root") of the container.
RUN useradd --create-home --uid 10001 app

WORKDIR /app

# Install Python packages before copying the code: Docker caches each step,
# so changing our code later does not re-run this slow step.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect the static files into /app/staticfiles, with hashed names (config/storage.py).
# collectstatic only reads the settings and never opens the database, so these values
# exist for this one build step only; the real ones come from .env when the app runs.
RUN DJANGO_SECRET_KEY=build-only DJANGO_DEBUG=0 \
    POSTGRES_DB=unused POSTGRES_USER=unused POSTGRES_PASSWORD=unused \
    python manage.py collectstatic --noinput

USER app

EXPOSE 8000
# Production web server: gunicorn with 3 worker processes (each can answer a request;
# a rule of thumb is 2 × CPU cores + 1). "--access-logfile -" = one log line per request
# on the console. compose.yaml replaces this with runserver for development.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
