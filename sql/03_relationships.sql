-- Milestone 3.4: spatial relationships between geometries.
-- Run: docker compose exec db psql -U nbs -d nbs -f /sql/03_relationships.sql
--
-- These functions answer yes/no questions about two geometries:
--   ST_Intersects(a, b)  do they share ANY point (boundary or inside)?
--   ST_Touches(a, b)     do they share boundary points, but NO inside points?
--   ST_Within(a, b)      is a completely inside b?  (ST_Contains(b, a) is the mirror)

\echo '--- 1. Neighbours of Merano: municipalities that TOUCH it, with the shared border length'
SELECT n.name,
       round((ST_Length(ST_Intersection(m.geom, n.geom)) / 1000)::numeric, 1) AS shared_border_km
FROM istat_municipalities AS m
JOIN istat_municipalities AS n
  ON ST_Touches(m.geom, n.geom)        -- spatial join: the join condition is spatial
WHERE m.istat_code = '021051'
ORDER BY shared_border_km DESC;

\echo '--- 2. ST_Intersects vs. ST_Touches for Merano (Intersects also counts Merano itself)'
SELECT count(*) FILTER (WHERE ST_Intersects(m.geom, n.geom)) AS intersects,
       count(*) FILTER (WHERE ST_Touches(m.geom, n.geom))    AS touches
FROM istat_municipalities AS m, istat_municipalities AS n
WHERE m.istat_code = '021051';

\echo '--- 3. Point in polygon: in which municipality is each candidate NbS site?'
-- Sites are given in lon/lat (like a click on the Leaflet map), so they are
-- transformed to 25832 before comparing. Comparing different CRSs is an error.
WITH sites (label, lon, lat) AS (
  VALUES ('green roof',        11.1597, 46.6713),
         ('rain garden',       11.1500, 46.6170),
         ('river restoration', 11.0050, 46.6490)
)
SELECT s.label, s.lon, s.lat, m.name AS municipality
FROM sites AS s
JOIN istat_municipalities AS m
  ON ST_Within(ST_Transform(ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326), 25832), m.geom);

\echo '--- 4. Trap: the centroid (centre of mass) can lie OUTSIDE the polygon'
SELECT name,
       ST_Within(ST_Centroid(geom), geom)       AS centroid_inside,
       ST_Within(ST_PointOnSurface(geom), geom) AS point_on_surface_inside
FROM istat_municipalities
WHERE NOT ST_Within(ST_Centroid(geom), geom);

\echo '--- 5. The 3 municipalities with the most neighbours (a spatial self-join + GROUP BY)'
SELECT a.name, count(*) AS neighbours
FROM istat_municipalities AS a
JOIN istat_municipalities AS b
  ON a.id <> b.id AND ST_Touches(a.geom, b.geom)
GROUP BY a.name
ORDER BY neighbours DESC, a.name
LIMIT 3;
