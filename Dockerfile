# Image for the Django app: Python plus the GIS libraries GeoDjango needs.
FROM python:3.12-slim-trixie

# No .pyc files in the project folder; show print()/log output immediately
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# GDAL from Debian. It also installs GEOS and PROJ as dependencies,
# plus command-line tools like ogr2ogr (useful in Milestone 3).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python packages before copying the code: Docker caches each step,
# so changing our code later does not re-run this slow step.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
