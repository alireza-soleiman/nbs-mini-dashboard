"""Load the fictional sample NbS from data/sample/nbs_sample.geojson.

    docker compose exec web python manage.py load_sample_nbs            # add / update
    docker compose exec web python manage.py load_sample_nbs --replace  # delete ALL NbS first

Each feature is matched by its `code` (e.g. MER-01): an existing code is updated,
a new code is created. Points, lines and polygons are all allowed. The file can be
edited in QGIS (it is plain GeoJSON in EPSG:4326).
"""

import json
from pathlib import Path

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalog.models import NbS

GEOJSON_FILE = Path(settings.BASE_DIR) / 'data' / 'sample' / 'nbs_sample.geojson'
FIELDS = ['name', 'nbs_type', 'description', 'cost_eur',
          'benefit_heat', 'benefit_flood', 'benefit_biodiversity', 'benefit_wellbeing']


class Command(BaseCommand):
    help = 'Load the fictional sample NbS (points, lines, polygons) around Merano'

    def add_arguments(self, parser):
        parser.add_argument('--replace', action='store_true',
                            help='Delete ALL existing NbS before loading (also ones added by hand).')
        parser.add_argument('--file', type=Path, default=GEOJSON_FILE,
                            help='Another GeoJSON file with the same properties.')

    @transaction.atomic  # one bad feature -> nothing is changed
    def handle(self, *args, **options):
        data = json.loads(options['file'].read_text(encoding='utf-8'))
        features = data['features']
        codes = [f['properties'].get('code') for f in features]
        if not all(codes) or len(set(codes)) != len(codes):
            raise CommandError('Every feature needs a unique "code" property.')

        if options['replace']:
            deleted, _ = NbS.objects.all().delete()
            self.stdout.write(f'Deleted {deleted} existing NbS')

        for feature in features:
            props = feature['properties']
            nbs = NbS.objects.filter(code=props['code']).first() or NbS(code=props['code'])
            created = nbs.pk is None
            for field in FIELDS:
                setattr(nbs, field, props[field])
            # GeoJSON is always lon/lat (EPSG:4326); Django transforms it to 25832 on save
            nbs.geom = GEOSGeometry(json.dumps(feature['geometry']), srid=4326)

            nbs.full_clean()  # valid type, scores 0-5 (save() alone skips these checks)
            nbs.save()        # also finds the municipality (see NbS.save)

            where = nbs.municipality or 'NO MUNICIPALITY (outside South Tyrol?)'
            self.stdout.write(f"{'created' if created else 'updated'}: {nbs.code} "
                              f"{nbs.geom.geom_type:10} {nbs.name} -> {where}")

        self.stdout.write(self.style.SUCCESS(f'{len(features)} sample NbS loaded'))
