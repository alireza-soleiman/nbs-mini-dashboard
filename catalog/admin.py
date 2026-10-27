# The GIS version of the admin: geometry fields are shown on a map
from django.contrib.gis import admin

from .models import Municipality, NbS

# Where the map widget opens for a new object (lon/lat of Merano)
MERANO_MAP = {'attrs': {'default_lon': 11.1597, 'default_lat': 46.6713, 'default_zoom': 12}}


@admin.register(Municipality)
class MunicipalityAdmin(admin.GISModelAdmin):
    list_display = ['name', 'istat_code', 'name_alt']
    search_fields = ['name', 'name_alt', 'istat_code']


@admin.register(NbS)
class NbSAdmin(admin.GISModelAdmin):
    list_display = ['name', 'nbs_type', 'municipality', 'cost_eur']
    list_filter = ['nbs_type', 'municipality']
    search_fields = ['name']
    readonly_fields = ['municipality']  # filled automatically by NbS.save()
    gis_widget_kwargs = MERANO_MAP
