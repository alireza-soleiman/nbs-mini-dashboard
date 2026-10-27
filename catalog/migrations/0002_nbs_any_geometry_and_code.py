"""NbS can be points, lines or polygons; NbS get an optional unique code.

Written by hand: makemigrations would ask whether `location` was renamed, and
renaming (instead of deleting + adding a column) keeps the existing geometries.
"""

import django.contrib.gis.db.models.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_initial'),
    ]

    operations = [
        # 1. Rename the column: location -> geom (the data stays)
        migrations.RenameField(model_name='nbs', old_name='location', new_name='geom'),
        # 2. Allow any geometry type: geometry(POINT,25832) -> geometry(GEOMETRY,25832)
        migrations.AlterField(
            model_name='nbs',
            name='geom',
            field=django.contrib.gis.db.models.fields.GeometryField(
                help_text='A point, a line or a polygon.', srid=25832),
        ),
        # 3. A short, stable key used by imports
        migrations.AddField(
            model_name='nbs',
            name='code',
            field=models.CharField(
                blank=True, help_text='Short unique code, e.g. MER-01. Optional for NbS added by hand.',
                max_length=20, null=True, unique=True),
        ),
    ]
