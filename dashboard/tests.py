"""Tests for the dashboard page.

    docker compose exec web python manage.py test dashboard

The map logic itself runs in the browser (JavaScript); see docs/GUIDE.md for the
manual checklist. These tests check that Django delivers the page and its files.
"""

from django.contrib.staticfiles import finders
from django.test import TestCase


class DashboardPageTests(TestCase):
    def test_page_loads_with_map_and_api_addresses(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('id="map"', html)
        # The JavaScript reads the API addresses from these attributes
        self.assertIn('data-nbs-url="/api/nbs/"', html)
        self.assertIn('data-municipalities-url="/api/municipalities/"', html)
        self.assertIn('data-types-url="/api/nbs-types/"', html)

    def test_javascript_and_css_files_exist(self):
        for path in ['dashboard/js/dashboard.js', 'dashboard/js/ranking.js',
                     'dashboard/js/api.js', 'dashboard/css/dashboard.css']:
            with self.subTest(path=path):
                self.assertIsNotNone(finders.find(path), f'{path} not found by staticfiles')
