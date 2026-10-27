"""Tests for the catalog API.

    docker compose exec web python manage.py test catalog

Django creates a separate, empty test database (test_nbs) and deletes it afterwards,
so these tests never touch the real data.
"""

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.test import TestCase
from rest_framework.test import APITestCase

from .models import Municipality, NbS


def make_nbs(name, nbs_type, lon, lat):
    """Create an NbS at a lon/lat point (Django stores it in EPSG:25832)."""
    return NbS.objects.create(
        name=name, nbs_type=nbs_type, location=Point(lon, lat, srid=4326),
        cost_eur=1000, benefit_heat=1, benefit_flood=1, benefit_biodiversity=1,
        benefit_wellbeing=1,
    )


class CatalogApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # A rectangle around Merano (about 9.2 km x 7.8 km), given in lon/lat
        box = Polygon.from_bbox((11.10, 46.63, 11.22, 46.70))
        cls.town = Municipality.objects.create(
            istat_code='999001', name='Test town', geom=MultiPolygon(box, srid=4326),
        )
        cls.roof = make_nbs('Roof in town', 'green_roof', 11.1597, 46.6713)
        cls.trees = make_nbs('Trees in town', 'street_trees', 11.1625, 46.6700)  # ~258 m away
        cls.pond = make_nbs('Pond far away', 'retention_pond', 11.0050, 46.6490)  # ~12 km away

    def names(self, **params):
        """Names of the NbS that /api/nbs/ returns for these query parameters."""
        data = self.client.get('/api/nbs/', params).json()
        return {feature['properties']['name'] for feature in data['features']}

    # --- /api/nbs/ ---------------------------------------------------------

    def test_list_is_geojson_with_lonlat_coordinates(self):
        response = self.client.get('/api/nbs/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['type'], 'FeatureCollection')
        roof = next(f for f in data['features'] if f['id'] == self.roof.pk)
        # Stored in metres (25832), sent in degrees (4326): back where we started
        lon, lat = roof['geometry']['coordinates']
        self.assertAlmostEqual(lon, 11.1597, places=6)
        self.assertAlmostEqual(lat, 46.6713, places=6)

    def test_list_needs_only_one_query(self):
        # Fails if someone removes select_related('municipality') (N+1 problem)
        with self.assertNumQueries(1):
            self.client.get('/api/nbs/')

    def test_municipality_is_found_from_the_location(self):
        self.assertEqual(self.roof.municipality, self.town)
        self.assertIsNone(self.pond.municipality)

    def test_filter_by_type(self):
        self.assertEqual(self.names(type=['green_roof', 'street_trees']),
                         {'Roof in town', 'Trees in town'})

    def test_unknown_type_returns_400(self):
        self.assertEqual(self.client.get('/api/nbs/', {'type': 'green_rooof'}).status_code, 400)

    def test_filter_by_municipality(self):
        self.assertEqual(self.names(municipality='999001'), {'Roof in town', 'Trees in town'})

    def test_near_filter_counts_in_metres(self):
        near = '11.1597,46.6713'
        self.assertEqual(self.names(near=near, radius=100), {'Roof in town'})
        self.assertEqual(self.names(near=near, radius=500), {'Roof in town', 'Trees in town'})
        self.assertEqual(len(self.names(near=near, radius=20000)), 3)

    def test_bad_near_returns_400(self):
        self.assertEqual(self.client.get('/api/nbs/', {'near': 'Merano'}).status_code, 400)

    # --- /api/municipalities/ and /api/nbs-types/ --------------------------

    def test_municipality_detail_uses_istat_code(self):
        data = self.client.get('/api/municipalities/999001/').json()
        self.assertEqual(data['id'], '999001')
        self.assertEqual(data['properties']['nbs_count'], 2)
        # Area computed in metres: 9.2 km x 7.8 km is about 71 km²
        self.assertAlmostEqual(data['properties']['area_km2'], 71.4, delta=0.5)

    def test_nbs_types_lists_every_type_with_its_count(self):
        data = self.client.get('/api/nbs-types/').json()
        self.assertEqual(len(data), len(NbS.Type.choices))
        self.assertIn({'value': 'green_roof', 'label': 'Green roof', 'count': 1}, data)


class MunicipalityAdminTests(TestCase):
    """Official boundaries must not change through the admin (see the Aldino accident)."""

    @classmethod
    def setUpTestData(cls):
        box = Polygon.from_bbox((11.10, 46.63, 11.22, 46.70))
        cls.town = Municipality.objects.create(
            istat_code='999001', name='Test town', geom=MultiPolygon(box, srid=4326),
        )
        cls.admin_user = get_user_model().objects.create_superuser('test-admin', 'a@example.com', 'x')

    def setUp(self):
        self.client.force_login(self.admin_user)
        self.url = f'/admin/catalog/municipality/{self.town.pk}/change/'

    def test_change_page_shows_a_map_without_editing_tools(self):
        html = self.client.get(self.url).content.decode()
        self.assertIn('interactions.draw.setActive(false)', html)
        self.assertNotIn('Delete all Features', html)

    def test_posted_geometry_is_ignored_but_name_can_change(self):
        original = Municipality.objects.get(pk=self.town.pk).geom
        other_shape = Polygon.from_bbox((11.0, 46.0, 11.01, 46.01))
        response = self.client.post(self.url, {
            'istat_code': '999001', 'name': 'Renamed town', 'name_alt': '',
            'geom': MultiPolygon(other_shape, srid=4326).geojson, '_save': 'Save',
        })
        self.assertEqual(response.status_code, 302)  # saved, redirected to the list
        town = Municipality.objects.get(pk=self.town.pk)
        self.assertEqual(town.name, 'Renamed town')
        self.assertTrue(town.geom.equals_exact(original, tolerance=0.001))

    def test_municipalities_cannot_be_added_by_hand(self):
        self.assertEqual(self.client.get('/admin/catalog/municipality/add/').status_code, 403)
