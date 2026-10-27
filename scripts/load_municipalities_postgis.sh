#!/bin/sh
# Load the 116 South Tyrol municipalities from the ISTAT zip into PostGIS,
# in EPSG:25832 (ETRS89 / UTM 32N, metres), as table public.istat_municipalities.
#
# Input: data/raw/Limiti01012026_g.zip (see build_municipalities_geojson.sh)
# Run it inside the web container, which has GDAL:
#   docker compose exec web sh scripts/load_municipalities_postgis.sh
set -eu

SRC=/vsizip/data/raw/Limiti01012026_g.zip/Com01012026_g/Com01012026_g_WGS84.shp

# GDAL connects through libpq, which reads these standard PG* variables.
# This keeps the password off the command line (where other programs could see it).
export PGHOST="$POSTGRES_HOST" PGPORT="$POSTGRES_PORT" PGDATABASE="$POSTGRES_DB" \
       PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"

# -t_srs EPSG:25832         reproject to the metre-based CRS used in South Tyrol
# -nlt PROMOTE_TO_MULTI     store every shape as MultiPolygon (some municipalities
#                           could have several parts; one type for all is simpler)
# GEOMETRY_NAME / FID       name the columns "geom" and "id"
# SPATIAL_INDEX=GIST        build a spatial index (makes spatial queries fast)
# PRECISION=NO              use plain types (float8, varchar). Otherwise GDAL copies the
#                           shapefile's numeric(18,11), which overflows for areas > 10^7 m²
# -overwrite                drop and recreate the table, so the script can be re-run
ogr2ogr -f PostgreSQL PG: "$SRC" \
  -sql "SELECT PRO_COM_T AS istat_code, COMUNE AS name, COMUNE_A AS name_alt, Shape_Area AS istat_area_m2 FROM Com01012026_g_WGS84 WHERE COD_PROV = 21" \
  -nln istat_municipalities \
  -t_srs EPSG:25832 \
  -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geom \
  -lco FID=id \
  -lco SPATIAL_INDEX=GIST \
  -lco PRECISION=NO \
  -overwrite

echo "Loaded table istat_municipalities"
