"""Serializers: turn model objects into GeoJSON features for the map."""

from rest_framework import serializers
from rest_framework_gis.fields import GeometryField
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import Municipality, NbS


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


class MunicipalitySerializer(GeoFeatureModelSerializer):
    """One municipality as a GeoJSON Feature, with its area and number of NbS."""

    # Same idea as for NbS: the view adds `geom_4326`. 5 decimals = about 1 m (as in M2)
    geometry = GeometryField(source='geom_4326', read_only=True, precision=5)
    # Computed by the view in EPSG:25832 (metres), so the area is correct
    area_km2 = serializers.SerializerMethodField()
    nbs_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Municipality
        geo_field = 'geometry'
        id_field = 'istat_code'  # the Feature "id" is the ISTAT code, e.g. "021051"
        fields = ['istat_code', 'geometry', 'name', 'name_alt', 'area_km2', 'nbs_count']

    def get_area_km2(self, municipality):
        return round(municipality.area.sq_km, 2)
