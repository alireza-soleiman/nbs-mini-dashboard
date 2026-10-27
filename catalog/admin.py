# The GIS version of the admin: geometry fields are shown on a map
from django.contrib.gis import admin
from django.contrib.gis.forms import OSMWidget

from .models import Municipality, NbS

# Where the map widget opens for a new object (lon/lat of Merano)
MERANO_MAP = {'attrs': {'default_lon': 11.1597, 'default_lat': 46.6713, 'default_zoom': 12}}


class ReadOnlyOSMWidget(OSMWidget):
    """The normal OSM map widget, with drawing and editing switched off."""

    template_name = 'catalog/readonly_osm.html'


@admin.register(Municipality)
class MunicipalityAdmin(admin.GISModelAdmin):
    """Municipalities come from ISTAT (import_municipalities): boundaries are read-only."""

    list_display = ['name', 'istat_code', 'name_alt']
    search_fields = ['name', 'name_alt', 'istat_code']
    gis_widget = ReadOnlyOSMWidget

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        field = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == 'geom':
            # Server-side protection: Django ignores any geometry sent for a disabled field
            field.disabled = True
            field.help_text = 'Official ISTAT boundary. To update it, run import_municipalities.'
        return field

    def has_add_permission(self, request):
        # New municipalities only come from the ISTAT import, never by hand
        return False


@admin.register(NbS)
class NbSAdmin(admin.GISModelAdmin):
    list_display = ['name', 'nbs_type', 'municipality', 'cost_eur']
    list_filter = ['nbs_type', 'municipality']
    search_fields = ['name']
    readonly_fields = ['municipality']  # filled automatically by NbS.save()
    gis_widget_kwargs = MERANO_MAP
