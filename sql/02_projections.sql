-- Milestone 3.3: one polygon (Merano), four coordinate systems.
-- Run: docker compose exec db psql -U nbs -d nbs -f /sql/02_projections.sql
--
-- The SAME place gets DIFFERENT numbers depending on the CRS.
-- ST_Transform(geom, srid) converts a geometry to another CRS.
-- ::geography tells PostGIS "these are lon/lat degrees on the real, curved Earth".

\echo '--- 1. Merano''s centre point written in two CRSs'
SELECT ST_AsText(ST_Centroid(geom))                       AS centre_25832_metres,
       ST_AsText(ST_Transform(ST_Centroid(geom), 4326))   AS centre_4326_degrees
FROM istat_municipalities
WHERE istat_code = '021051';

\echo '--- 2. Merano''s area, computed in four ways'
SELECT
  -- EPSG:25832, UTM metres: correct for this region
  round((ST_Area(geom) / 1e6)::numeric, 2)                                AS utm_25832_km2,
  -- EPSG:4326, degrees: the result is in "square degrees", meaningless
  round(ST_Area(ST_Transform(geom, 4326))::numeric, 6)                    AS wgs84_4326_sq_degrees,
  -- geography: degrees, but measured on the ellipsoid: correct, in m²
  round((ST_Area(ST_Transform(geom, 4326)::geography) / 1e6)::numeric, 2) AS geography_km2,
  -- EPSG:3857, Web Mercator (how Leaflet draws): metres, but stretched
  round((ST_Area(ST_Transform(geom, 3857)) / 1e6)::numeric, 2)            AS web_mercator_3857_km2
FROM istat_municipalities
WHERE istat_code = '021051';

\echo '--- 3. Why degrees are not a distance: 1 degree east vs. 1 degree north of Merano'
SELECT
  round((ST_Distance('SRID=4326;POINT(11.16 46.67)'::geography,
                     'SRID=4326;POINT(12.16 46.67)'::geography) / 1000)::numeric, 1) AS one_degree_east_km,
  round((ST_Distance('SRID=4326;POINT(11.16 46.67)'::geography,
                     'SRID=4326;POINT(11.16 47.67)'::geography) / 1000)::numeric, 1) AS one_degree_north_km;
