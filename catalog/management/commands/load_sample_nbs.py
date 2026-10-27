"""Load the fictional sample NbS from data/sample/nbs_sample.csv.

    docker compose exec web python manage.py load_sample_nbs

Safe to run again: rows are matched by name and updated, not duplicated.
"""

import csv
from pathlib import Path

from django.conf import settings
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import NbS

CSV_FILE = Path(settings.BASE_DIR) / 'data' / 'sample' / 'nbs_sample.csv'
BENEFITS = ['benefit_heat', 'benefit_flood', 'benefit_biodiversity', 'benefit_wellbeing']


class Command(BaseCommand):
    help = 'Load the fictional sample NbS around Merano'

    @transaction.atomic  # one bad row → nothing is loaded
    def handle(self, *args, **options):
        with CSV_FILE.open(encoding='utf-8', newline='') as f:
            rows = list(csv.DictReader(f))

        for row in rows:
            nbs = NbS.objects.filter(name=row['name']).first() or NbS(name=row['name'])
            created = nbs.pk is None

            nbs.nbs_type = row['nbs_type']
            nbs.description = row['description']
            nbs.cost_eur = int(row['cost_eur'])
            for benefit in BENEFITS:
                setattr(nbs, benefit, int(row[benefit]))
            # The CSV has lon/lat (EPSG:4326). Saving into the EPSG:25832 field,
            # Django adds ST_Transform for us.
            nbs.location = Point(float(row['lon']), float(row['lat']), srid=4326)

            # Run the field validators (valid type, scores 0-5); save() alone skips them
            nbs.full_clean()
            nbs.save()  # also finds the municipality (see NbS.save)

            where = nbs.municipality or 'NO MUNICIPALITY (outside South Tyrol?)'
            self.stdout.write(f"{'created' if created else 'updated'}: {nbs.name} → {where}")

        self.stdout.write(self.style.SUCCESS(f'{len(rows)} sample NbS loaded'))
