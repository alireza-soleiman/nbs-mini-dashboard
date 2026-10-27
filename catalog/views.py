"""API views: which objects the API returns, and in which shape."""

from django.contrib.gis.db.models.functions import Area, Length, PointOnSurface, Transform
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Count
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
