"""Import the South Tyrol municipalities from the ISTAT boundaries.

    docker compose exec web python manage.py import_municipalities

Safe to run again: existing municipalities are updated, not duplicated.
"""

from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import MultiPolygon
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import SRID, Municipality

# The shapefile inside the ISTAT zip (see scripts/build_municipalities_geojson.sh)
SOURCE = '/vsizip/data/raw/Limiti01012026_g.zip/Com01012026_g/Com01012026_g_WGS84.shp'
SOUTH_TYROL = 21  # ISTAT province code (COD_PROV)


class Command(BaseCommand):
    help = 'Import the 116 South Tyrol municipalities from the ISTAT boundaries'

    @transaction.atomic  # all or nothing: an error leaves the table unchanged
    def handle(self, *args, **options):
        layer = DataSource(SOURCE)[0]
        self.stdout.write(f'Reading {layer.num_feat} municipalities ({layer.srs.name})')

        created = updated = 0
        for feature in layer:
            if feature.get('COD_PROV') != SOUTH_TYROL:
                continue

            geom = feature.geom   # GDAL geometry in the file's CRS (EPSG:32632)
            geom.transform(SRID)  # reproject to EPSG:25832, done by PROJ
            geom = geom.geos      # convert to a GEOS geometry, which Django can save
            if geom.geom_type == 'Polygon':
                geom = MultiPolygon(geom, srid=SRID)

            _, was_created = Municipality.objects.update_or_create(
                istat_code=feature.get('PRO_COM_T'),
                defaults={
                    'name': feature.get('COMUNE'),
                    'name_alt': feature.get('COMUNE_A'),
                    'geom': geom,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(f'{created} created, {updated} updated'))
