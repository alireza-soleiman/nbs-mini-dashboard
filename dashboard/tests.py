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

    # --- Team demo: ideas shown as mockups ---------------------------------------

    def test_overview_offers_other_options_marked_as_mockup(self):
        html = self.client.get('/').content.decode()
        self.assertEqual(html.count('class="options-button"'), 5)  # one per chart section
        self.assertIn('id="options-panel"', html)
        self.assertIn('Mockup – sample data', html)

    def test_map_page_has_the_ideas_box(self):
        html = self.client.get('/map/').content.decode()
        self.assertIn('id="ideas"', html)
        self.assertIn('Mockup – sample data', html)
        for group in ['idea-heat', 'idea-background', 'idea-priorities', 'idea-score']:
            self.assertIn(f'id="{group}"', html)

    def test_compare_and_admin_mockup_pages(self):
        pages = [('/compare/', 'dashboard/js/compare.js', 'Mockup – sample data', 'Compare'),
                 ('/admin-mockup/', 'dashboard/js/admin-mockup.js', 'Mockup – nothing is saved', 'Admin')]
        for address, script, label, name in pages:
            with self.subTest(page=address):
                response = self.client.get(address)
                self.assertEqual(response.status_code, 200)
                html = response.content.decode()
                self.assertIn(script, html)
                self.assertIn(label, html)  # nobody should take a mockup for a finished feature
                self.assertIn(f'aria-current="page">{name}', html)
                for attribute in self.API_ATTRIBUTES:
                    self.assertIn(attribute, html)

    def test_admin_mockup_form_has_a_real_map(self):
        html = self.client.get('/admin-mockup/').content.decode()
        self.assertIn('id="place-map"', html)
        for mode in ['point', 'line', 'area']:
            self.assertIn(f'data-mode="{mode}"', html)
        # Leaflet from the CDN, protected by its fingerprint (as on the map page)
        self.assertRegex(html, r'leaflet@1\.9\.4/dist/leaflet\.js"\s+integrity="sha256-')

    def test_every_page_is_marked_as_mockup(self):
        # Nothing is decided yet: all four tabs carry the tag, and every page the badge
        for address in ['/', '/map/', '/compare/', '/admin-mockup/']:
            with self.subTest(page=address):
                html = self.client.get(address).content.decode()
                self.assertEqual(html.count('class="mock-tag"'), 4)
                self.assertIn('Mockup – sample data', html)
        self.assertIn('class="mock-banner"', self.client.get('/').content.decode())

    def test_admin_mockup_does_not_hide_the_real_admin(self):
        # /admin/ stays Django's own admin (it sends visitors to its login page)
        self.assertEqual(self.client.get('/admin/').status_code, 302)

    def test_javascript_and_css_files_exist(self):
        for name in ['api.js', 'ranking.js', 'colors.js', 'format.js', 'map.js', 'overview.js',
                     'mockup-charts.js', 'map-ideas.js', 'compare.js', 'admin-mockup.js',
                     'place-map.js']:
            with self.subTest(file=name):
                self.assertIsNotNone(finders.find(f'dashboard/js/{name}'))
        self.assertIsNotNone(finders.find('dashboard/css/dashboard.css'))
