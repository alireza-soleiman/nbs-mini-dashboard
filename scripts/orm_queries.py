"""Milestone 4.5: the Milestone 3 questions, asked with the GeoDjango ORM.

Run:
    docker compose exec web python manage.py shell -v 0 -c "exec(open('scripts/orm_queries.py').read())"

Each block names the SQL from Milestone 3 that answers the same question.
"""

import re

from django.contrib.gis.db.models.functions import Centroid, Distance, PointOnSurface, Transform
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Count, Sum

from catalog.models import Municipality, NbS

merano = Municipality.objects.get(istat_code='021051')
# A point in lon/lat, like a click on the Leaflet map. Because it says srid=4326,
# Django adds ST_Transform(..., 25832) in every query below.
site = Point(11.1597, 46.6713, srid=4326)

print('--- 1. NbS per municipality (the municipality was found by NbS.save())')
for m in Municipality.objects.annotate(n=Count('nbs')).filter(n__gt=0).order_by('-n', 'name'):
    print(f'{m.n:4}  {m.name}')

print('\n--- 2. NbS within 1 km of the clicked point          SQL: ST_DWithin(geom, point, 1000)')
near = NbS.objects.filter(geom__dwithin=(site, D(km=1)))
for n in near:
    print('      ', n.name)

print('\n--- 3. The 3 nearest NbS and their distance (to the nearest part of the shape)')
for n in NbS.objects.annotate(distance=Distance('geom', site)).order_by('distance')[:3]:
    print(f'{n.distance.m:7.0f} m  {n.name}')

print('\n--- 4. Total cost of all NbS within 5 km of the point')
total = NbS.objects.filter(geom__dwithin=(site, D(km=5))).aggregate(total=Sum('cost_eur'))
print(f"{total['total']:,} EUR")

print("\n--- 5. Municipalities within 2 km of Merano's border  (the SQL in Milestone 3 gave 12)")
print(Municipality.objects.filter(geom__dwithin=(merano.geom, D(km=2))).exclude(pk=merano.pk).count())

print('\n--- 6. Centroid vs. point on surface                  SQL: ST_Centroid / ST_PointOnSurface')
for m in Municipality.objects.annotate(centroid=Centroid('geom'), on_surface=PointOnSurface('geom')):
    if not m.geom.contains(m.centroid):  # a GEOS test in Python, no SQL
        print(f'{m.name}: centroid inside = {m.geom.contains(m.centroid)}, '
              f'point on surface inside = {m.geom.contains(m.on_surface)}')

print('\n--- 7. Stored in metres, sent to the map in degrees (marker point of each shape)')
for n in NbS.objects.annotate(inside=PointOnSurface('geom'),
                              lonlat=Transform(PointOnSurface('geom'), 4326))[:3]:
    print(f'{n.code} {n.geom.geom_type:10}: 25832 ({n.inside.x:.0f}, {n.inside.y:.0f}) '
          f'-> 4326 ({n.lonlat.x:.5f}, {n.lonlat.y:.5f})')

print('\n--- 8. The SQL Django wrote for query 2')
sql = re.sub(r"E'.*?'::bytea", '<point>', str(near.query), flags=re.S)
print(sql[sql.index('WHERE'):])
