"""API views: which objects the API returns, and in which shape."""

from django.contrib.gis.db.models.functions import Transform
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from .models import NbS
from .serializers import NbSSerializer


class NbSViewSet(viewsets.ReadOnlyModelViewSet):
    """GeoJSON of the NbS.  /api/nbs/ = all of them,  /api/nbs/<id>/ = one.

    Optional filters (they can be combined):
      ?type=green_roof&type=rain_garden   one or more NbS types
      ?municipality=021051                ISTAT code of a municipality
      ?near=11.1597,46.6713&radius=1000   within `radius` metres of a lon/lat point
                                          (radius is optional, default 1000)
    """

    serializer_class = NbSSerializer

    def get_queryset(self):
        queryset = (
            NbS.objects
            # Load each NbS's municipality in the SAME query (a SQL JOIN). Without this,
            # printing the municipality name would cost one extra query per NbS.
            .select_related('municipality')
            # Stored in metres (25832); the map needs lon/lat (4326). PostGIS converts.
            .annotate(location_4326=Transform('location', 4326))
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
            # A lon/lat point: Django adds ST_Transform to 25832, PostGIS uses ST_DWithin
            point = Point(lon, lat, srid=4326)
            queryset = queryset.filter(location__dwithin=(point, D(m=radius)))

        return queryset
