#!/bin/sh
# Build frontend/data/municipalities.geojson from the ISTAT boundaries.
#
# Input:  data/raw/Limiti01012026_g.zip (not in Git; download it first)
#   https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/Limiti01012026_g.zip
#   SHA256 B011A590656C3A3EBC297FBA80726A376AA843B6F164641CF6A4A990021A81D6
# Output: the 116 municipalities of South Tyrol in EPSG:4326, for Leaflet
#
# Run it inside the web container, which has GDAL:
#   docker compose exec web sh scripts/build_municipalities_geojson.sh
set -eu

# /vsizip/ lets GDAL read the shapefile inside the zip without unpacking it
SRC=/vsizip/data/raw/Limiti01012026_g.zip/Com01012026_g/Com01012026_g_WGS84.shp
OUT=frontend/data/municipalities.geojson

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"  # the GeoJSON driver refuses to overwrite an existing file

# -sql                     only South Tyrol (province code 21), two renamed fields
# -t_srs EPSG:4326         reproject from UTM 32N (metres) to longitude/latitude
# RFC7946=YES              follow the current GeoJSON standard
# COORDINATE_PRECISION=5   5 decimals of a degree = about 1 m, enough for a web map
ogr2ogr -f GeoJSON "$OUT" "$SRC" \
  -sql "SELECT PRO_COM_T AS istat_code, COMUNE AS name FROM Com01012026_g_WGS84 WHERE COD_PROV = 21" \
  -nln municipalities \
  -t_srs EPSG:4326 \
  -lco RFC7946=YES \
  -lco COORDINATE_PRECISION=5

echo "Wrote $OUT"
ogrinfo -ro -so "$OUT" municipalities | grep -E 'Feature Count|Extent'
