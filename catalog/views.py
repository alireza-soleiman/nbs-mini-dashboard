"""API views: which objects the API returns, and in which shape."""

from django.contrib.gis.db.models.functions import Area, Length, PointOnSurface, Transform
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Avg, CharField, Count, F, Func, Sum
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Municipality, NbS
from .serializers import MunicipalitySerializer, NbSSerializer


class NbSViewSet(viewsets.ReadOnlyModelViewSet):
    """GeoJSON of the NbS.  /api/nbs/ = all of them,  /api/nbs/<id>/ = one.

    Optional filters (they can be combined):
      ?type=green_roof&type=rain_garden   one or more NbS types
      ?municipality=021051                ISTAT code of a municipality
      ?near=11.1597,46.6713&radius=1000   any part within `radius` metres of a lon/lat
                                          point (radius is optional, default 1000)
    """

    serializer_class = NbSSerializer

    def get_queryset(self):
        queryset = (
            NbS.objects
            # Load each NbS's municipality in the SAME query (a SQL JOIN). Without this,
            # printing the municipality name would cost one extra query per NbS.
            .select_related('municipality')
            # The stored geometry (metres) is not sent itself: skip loading it twice
            .defer('geom')
            .annotate(
                # Stored in metres (25832); the map needs lon/lat (4326). PostGIS converts.
                geom_4326=Transform('geom', 4326),
                marker_4326=Transform(PointOnSurface('geom'), 4326),
                # Sizes in metres, computed on the 25832 geometry
                area=Area('geom'),      # 0 for points and lines
                length=Length('geom'),  # 0 for points and polygons
            )
        )
        params = self.request.query_params

        types = params.getlist('type')
        if types:
            unknown = set(types) - set(NbS.Type.values)
            if unknown:
                raise ValidationError({'type': f'Unknown: {sorted(unknown)}. Valid: {NbS.Type.values}'})
            queryset = queryset.filter(nbs_type__in=types)

        municipality = params.get('municipality')
        if municipality:
            queryset = queryset.filter(municipality__istat_code=municipality)

        near = params.get('near')
        if near:
            try:
                lon, lat = (float(value) for value in near.split(','))
                radius = float(params.get('radius', 1000))
            except ValueError:
                raise ValidationError({'near': 'Use near=<lon>,<lat>&radius=<metres>, '
                                               'e.g. near=11.1597,46.6713&radius=1000'})
            # A lon/lat point: Django adds ST_Transform to 25832, PostGIS uses ST_DWithin,
            # which measures to the NEAREST part of a line or polygon
            point = Point(lon, lat, srid=4326)
            queryset = queryset.filter(geom__dwithin=(point, D(m=radius)))

        return queryset


class MunicipalityViewSet(viewsets.ReadOnlyModelViewSet):
    """GeoJSON of the 116 municipalities.  /api/municipalities/021051/ = Merano.

    Each Feature has its area (km², computed in metres) and its number of NbS.
    """

    serializer_class = MunicipalitySerializer
    lookup_field = 'istat_code'  # URLs use the ISTAT code instead of the database id

    def get_queryset(self):
        return Municipality.objects.annotate(
            geom_4326=Transform('geom', 4326),  # for the map (degrees)
            area=Area('geom'),                  # in EPSG:25832, so in m²
            nbs_count=Count('nbs'),             # how many NbS lie in this municipality
        )


@api_view(['GET'])
def nbs_types(request):
    """All NbS types: value (for ?type=), label (for people) and how many exist.

    The map uses this list to build its filter checkboxes (Milestone 6).
    """
    counts = dict(NbS.objects.values_list('nbs_type').annotate(n=Count('id')))
    return Response([
        {'value': value, 'label': label, 'count': counts.get(value, 0)}
        for value, label in NbS.Type.choices
    ])


# PostGIS has GeometryType(), Django 5.2 has no wrapper for it: Func calls any SQL function
GEOMETRY_TYPE = Func(F('geom'), function='GeometryType', output_field=CharField())


@api_view(['GET'])
def summary(request):
    """Totals for the overview page, all added up in the database (SQL GROUP BY).

    totals           number of NbS, cost, municipalities, area of polygons, length of lines
    by_geometry      how many points, lines and polygons
    by_type          per NbS type: count, cost and the average of each benefit
    by_municipality  per municipality: count and cost
    """
    nbs = NbS.objects.all()
    totals = nbs.aggregate(
        nbs=Count('id'),
        cost_eur=Sum('cost_eur'),
        municipalities_with_nbs=Count('municipality', distinct=True),
    )
    # Per-NbS size first (annotate), then the sum (aggregate). The two need different
    # names, or the SQL refers to the wrong one.
    sizes = nbs.annotate(one_area=Area('geom'), one_length=Length('geom')).aggregate(
        area=Sum('one_area'), length=Sum('one_length'))
    totals.update(
        cost_eur=totals['cost_eur'] or 0,
        municipalities=Municipality.objects.count(),
        polygon_area_m2=round(sizes['area'].sq_m) if sizes['area'] else 0,
        line_length_m=round(sizes['length'].m) if sizes['length'] else 0,
    )

    by_geometry = {'points': 0, 'lines': 0, 'polygons': 0}
    for row in nbs.annotate(kind=GEOMETRY_TYPE).values('kind').annotate(n=Count('id')):
        # 'POINT', 'MULTILINESTRING', ... -> points / lines / polygons
        group = 'points' if 'POINT' in row['kind'] else 'lines' if 'LINE' in row['kind'] else 'polygons'
        by_geometry[group] += row['n']

    labels = dict(NbS.Type.choices)
    by_type = [
        {**row, 'label': labels[row['value']],
         **{k: round(row[k], 2) for k in ('heat', 'flood', 'biodiversity', 'wellbeing')}}
        for row in nbs.values(value=F('nbs_type')).annotate(
            count=Count('id'), cost_eur=Sum('cost_eur'),
            heat=Avg('benefit_heat'), flood=Avg('benefit_flood'),
            biodiversity=Avg('benefit_biodiversity'), wellbeing=Avg('benefit_wellbeing'),
        ).order_by('-count', 'value')
    ]

    by_municipality = [
        # NbS has its own `name` field, so the municipality's name gets another alias here
        {'istat_code': row['municipality__istat_code'], 'name': row['municipality__name'],
         'count': row['count'], 'cost_eur': row['cost_eur']}
        for row in nbs.filter(municipality__isnull=False)
        .values('municipality__istat_code', 'municipality__name')
        .annotate(count=Count('id'), cost_eur=Sum('cost_eur'))
        .order_by('-cost_eur')
    ]

    return Response({'totals': totals, 'by_geometry': by_geometry,
                     'by_type': by_type, 'by_municipality': by_municipality})
