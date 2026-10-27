"""URLs of the catalog API (included under /api/ in config/urls.py)."""

from rest_framework.routers import DefaultRouter

from .views import NbSViewSet

# The router creates the URLs for a ViewSet: nbs/ (list) and nbs/<id>/ (detail),
# plus an API root page at /api/ that links to everything.
router = DefaultRouter()
router.register('nbs', NbSViewSet, basename='nbs')

urlpatterns = router.urls
