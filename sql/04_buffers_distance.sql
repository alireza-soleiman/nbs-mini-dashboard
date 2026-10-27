-- Milestone 3.5: distances and buffers.
-- Run: docker compose exec db psql -U nbs -d nbs -f /sql/04_buffers_distance.sql
--
-- geom is in EPSG:25832, so all distances below are in METRES.
--   ST_Distance(a, b)       shortest distance between two geometries
--   ST_DWithin(a, b, d)     true if they are within d of each other (uses the index)
--   ST_Buffer(g, d)         a new polygon: everything within d of g
--   a <-> b                 distance operator for "nearest first" ordering (uses the index)

\echo '--- 1. The 5 municipalities nearest to Merano (centre to centre, "<->" ordering)'
SELECT n.name,
       round((ST_Distance(ST_PointOnSurface(m.geom), ST_PointOnSurface(n.geom)) / 1000)::numeric, 1) AS km
FROM istat_municipalities AS m
JOIN istat_municipalities AS n ON n.id <> m.id
WHERE m.istat_code = '021051'
ORDER BY ST_PointOnSurface(m.geom) <-> ST_PointOnSurface(n.geom)
LIMIT 5;

\echo '--- 2. Municipalities with any part within 10 km of the green roof site in Merano'
-- The point is built once in a CTE, transformed from lon/lat to 25832
WITH site AS (
  SELECT ST_Transform(ST_SetSRID(ST_MakePoint(11.1597, 46.6713), 4326), 25832) AS geom
)
SELECT count(*) AS municipalities_within_10_km
FROM istat_municipalities AS m, site
WHERE ST_DWithin(m.geom, site.geom, 10000);

\echo '--- 3. A 500 m buffer around Merano: how much area does it add?'
SELECT round((ST_Area(geom) / 1e6)::numeric, 2)                  AS merano_km2,
       round((ST_Area(ST_Buffer(geom, 500)) / 1e6)::numeric, 2)  AS with_500m_buffer_km2
FROM istat_municipalities
WHERE istat_code = '021051';

\echo '--- 4. Same question, two ways: municipalities within 2 km of Merano''s border'
-- a) build a buffer polygon, then test intersection   (easy to understand)
-- b) ST_DWithin, no new geometry is built             (faster, index-friendly)
SELECT
  (SELECT count(*) FROM istat_municipalities AS m, istat_municipalities AS n
   WHERE m.istat_code = '021051' AND n.id <> m.id
     AND ST_Intersects(ST_Buffer(m.geom, 2000), n.geom))          AS with_buffer,
  (SELECT count(*) FROM istat_municipalities AS m, istat_municipalities AS n
   WHERE m.istat_code = '021051' AND n.id <> m.id
     AND ST_DWithin(m.geom, n.geom, 2000))                        AS with_dwithin;

\echo '--- 5. Spatial index: EXPLAIN ANALYZE runs the query and shows HOW it was done'
-- With the index, PostGIS works in two steps:
--   Index Cond: geom && st_expand(...)   fast, rough test on bounding boxes (uses the index)
--   Filter: st_dwithin(...)              exact test, only on the rows that passed step 1
\echo '    a) normal plan (index on):'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT name FROM istat_municipalities
WHERE ST_DWithin(geom, ST_Transform(ST_SetSRID(ST_MakePoint(11.1597, 46.6713), 4326), 25832), 10000);

\echo '    b) the same query with index scans switched off (every row gets the exact test):'
SET enable_bitmapscan = off;
SET enable_indexscan = off;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT name FROM istat_municipalities
WHERE ST_DWithin(geom, ST_Transform(ST_SetSRID(ST_MakePoint(11.1597, 46.6713), 4326), 25832), 10000);
RESET enable_bitmapscan;
RESET enable_indexscan;
