"""Serializers: turn model objects into GeoJSON features for the map."""

from rest_framework import serializers
from rest_framework_gis.fields import GeometryField
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import NbS


class NbSSerializer(GeoFeatureModelSerializer):
    """One NbS as a GeoJSON Feature: geometry (lon/lat) + properties (everything else)."""

    # The database stores metres (EPSG:25832), but GeoJSON and Leaflet need lon/lat
    # (EPSG:4326). The view adds `location_4326` with Transform() in SQL; this field
    # puts it into the Feature's "geometry". precision=6 decimals = about 10 cm.
    geometry = GeometryField(source='location_4326', read_only=True, precision=6)
    # "green_roof" is for code and filters, "Green roof" is for people
    nbs_type_label = serializers.CharField(source='get_nbs_type_display', read_only=True)
    # The municipality's name (its __str__), e.g. "Merano/Meran"
    municipality = serializers.StringRelatedField()

    class Meta:
        model = NbS
        geo_field = 'geometry'  # which field becomes the GeoJSON geometry
        fields = [
            'id', 'geometry', 'name', 'nbs_type', 'nbs_type_label', 'description',
            'cost_eur', 'benefit_heat', 'benefit_flood', 'benefit_biodiversity',
            'benefit_wellbeing', 'municipality',
        ]
