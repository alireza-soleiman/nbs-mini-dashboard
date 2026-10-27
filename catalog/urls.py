"""URLs of the catalog API (included under /api/ in config/urls.py)."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MunicipalityViewSet, NbSViewSet, nbs_types

# The router creates the URLs for each ViewSet: <name>/ (list) and <name>/<id>/ (detail),
# plus an API root page at /api/ that links to them.
router = DefaultRouter()
router.register('nbs', NbSViewSet, basename='nbs')
router.register('municipalities', MunicipalityViewSet, basename='municipality')

urlpatterns = [
    path('nbs-types/', nbs_types, name='nbs-types'),
    *router.urls,
]
