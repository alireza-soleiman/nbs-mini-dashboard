from django.apps import AppConfig


class DashboardConfig(AppConfig):
    """The web page with the map, filters and ranking (no models, only UI)."""

    name = 'dashboard'
