-- Milestone 3.2: first look at the municipalities table.
-- Run: docker compose exec db psql -U nbs -d nbs -f /sql/01_explore.sql
--
-- geom is stored in EPSG:25832 (metres), so ST_Area() returns square metres.

\echo '--- 1. The Merano row (attributes only; geom is too long to print)'
SELECT id, istat_code, name, name_alt,
       ST_SRID(geom)          AS srid,
       GeometryType(geom)     AS type,
       ST_NumGeometries(geom) AS parts,
       ST_NPoints(geom)       AS points
FROM istat_municipalities
WHERE istat_code = '021051';

\echo '--- 2. Area: our ST_Area() in EPSG:25832 vs. the area ISTAT computed in EPSG:32632'
SELECT name,
       round((ST_Area(geom) / 1e6)::numeric, 2)    AS area_km2,
       round((istat_area_m2 / 1e6)::numeric, 2)    AS istat_km2,
       round((100 * (ST_Area(geom) - istat_area_m2) / istat_area_m2)::numeric, 4)
                                                   AS diff_percent
FROM istat_municipalities
WHERE istat_code = '021051';

\echo '--- 3. The whole province: sum of all 116 areas'
SELECT count(*)                                     AS municipalities,
       round((sum(ST_Area(geom)) / 1e6)::numeric)   AS total_km2
FROM istat_municipalities;

\echo '--- 4. The 5 largest municipalities'
SELECT name, round((ST_Area(geom) / 1e6)::numeric, 1) AS area_km2
FROM istat_municipalities
ORDER BY ST_Area(geom) DESC
LIMIT 5;

\echo '--- 5. The 5 smallest municipalities'
SELECT name, round((ST_Area(geom) / 1e6)::numeric, 1) AS area_km2
FROM istat_municipalities
ORDER BY ST_Area(geom)
LIMIT 5;

\echo '--- 6. Municipalities made of more than one piece of land'
SELECT name, ST_NumGeometries(geom) AS parts
FROM istat_municipalities
WHERE ST_NumGeometries(geom) > 1;
