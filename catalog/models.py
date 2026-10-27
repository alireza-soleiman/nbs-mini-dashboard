"""Models for the NbS catalogue: municipalities and Nature-Based Solutions."""

# The GIS version of "models": the normal Django fields plus geometry fields
from django.contrib.gis.db import models
from django.core.validators import MaxValueValidator

# All geometries are stored in EPSG:25832 (ETRS89 / UTM zone 32N, metres),
# so areas, distances and buffers come out in m² and m (see Milestone 3).
# The API transforms them to EPSG:4326 for the map (Milestone 5).
SRID = 25832


class Municipality(models.Model):
    istat_code = models.CharField(max_length=6, unique=True)  # e.g. "021051" = Merano
    name = models.CharField(max_length=200)                   # official name: "Merano/Meran"
    name_alt = models.CharField(max_length=200, blank=True)   # German name: "Meran"
    # MultiPolygon, because some municipalities have several parts (Lagundo, Termeno)
    geom = models.MultiPolygonField(srid=SRID)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'municipalities'

    def __str__(self):
        return self.name


def benefit_field(label):
    """A 0-5 score for one benefit of an NbS (0 = none, 5 = very high)."""
    return models.PositiveSmallIntegerField(
        label, validators=[MaxValueValidator(5)], help_text='0 = none … 5 = very high'
    )


class NbS(models.Model):
    """One Nature-Based Solution: what it is, what it costs, what it brings, where it is."""

    class Type(models.TextChoices):
        # stored value (in the database)  /  label (shown to people)
        GREEN_ROOF = 'green_roof', 'Green roof'
        GREEN_FACADE = 'green_facade', 'Green facade'
        STREET_TREES = 'street_trees', 'Street trees'
        URBAN_PARK = 'urban_park', 'Urban park'
        RAIN_GARDEN = 'rain_garden', 'Rain garden'
        PERMEABLE_PAVING = 'permeable_paving', 'Permeable paving'
        RETENTION_POND = 'retention_pond', 'Retention pond'
        RIVER_RESTORATION = 'river_restoration', 'River restoration'
        WETLAND = 'wetland', 'Wetland'

    name = models.CharField(max_length=200)
    nbs_type = models.CharField('type', max_length=30, choices=Type.choices)
    description = models.TextField(blank=True)
    cost_eur = models.PositiveIntegerField('estimated cost (EUR)')

    # The benefits are the criteria that the weight sliders combine in Milestone 7
    benefit_heat = benefit_field('heat reduction')
    benefit_flood = benefit_field('flood and stormwater reduction')
    benefit_biodiversity = benefit_field('biodiversity')
    benefit_wellbeing = benefit_field('health and wellbeing')

    location = models.PointField(srid=SRID)
    # Not typed in by hand: save() finds it from the location
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        editable=False,
        related_name='nbs',
    )

    class Meta:
        ordering = ['name']
        verbose_name = 'NbS'
        verbose_name_plural = 'NbS'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Point in polygon with the ORM: "which municipality contains this location?"
        # Django writes the ST_Contains(...) SQL, including ST_Transform if the SRIDs differ.
        self.municipality = Municipality.objects.filter(geom__contains=self.location).first()
        super().save(*args, **kwargs)
