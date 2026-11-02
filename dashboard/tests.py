"""Tests for the dashboard pages.

    docker compose exec web python manage.py test dashboard

The charts, the map and the ranking run in the browser (JavaScript); see
docs/GUIDE.md for the manual checklist. These tests check that Django delivers
the pages, the API addresses they need, and their files.
"""

from django.contrib.staticfiles import finders
from django.test import TestCase


class DashboardPageTests(TestCase):
    API_ATTRIBUTES = [
        'data-nbs-url="/api/nbs/"',
        'data-municipalities-url="/api/municipalities/"',
        'data-types-url="/api/nbs-types/"',
        'data-summary-url="/api/summary/"',
        'data-map-url="/map/"',
    ]

    def test_overview_page(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('id="kpis"', html)
        self.assertIn('dashboard/js/overview.js', html)
        self.assertIn('aria-current="page">Overview', html)
        for attribute in self.API_ATTRIBUTES:
            self.assertIn(attribute, html)

    def test_map_page(self):
        response = self.client.get('/map/')
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('id="map"', html)
        self.assertIn('dashboard/js/map.js', html)
        self.assertIn('aria-current="page">Map', html)
        for attribute in self.API_ATTRIBUTES:
            self.assertIn(attribute, html)

    def test_map3d_page(self):
        response = self.client.get('/map-3d/')
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('id="map"', html)
        self.assertIn('dashboard/js/map3d.js', html)
        self.assertIn('aria-current="page">3D map', html)
        # MapLibre from the CDN, pinned to one version and protected by its fingerprint
        self.assertRegex(html, r'maplibre-gl/5\.24\.0/maplibre-gl\.js"\s+integrity="sha512-')
        for attribute in self.API_ATTRIBUTES:
            self.assertIn(attribute, html)

    def test_javascript_and_css_files_exist(self):
        for name in ['api.js', 'ranking.js', 'colors.js', 'format.js', 'popup.js', 'panel.js',
                     'map.js', 'map3d.js', 'overview.js']:
            with self.subTest(file=name):
                self.assertIsNotNone(finders.find(f'dashboard/js/{name}'))
        self.assertIsNotNone(finders.find('dashboard/css/dashboard.css'))
