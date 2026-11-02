from django.urls import path
from django.views.generic import TemplateView

# Two pages; their JavaScript loads all data from /api/
urlpatterns = [
    path('', TemplateView.as_view(template_name='dashboard/overview.html',
                                  extra_context={'active': 'overview'}), name='overview'),
    path('map/', TemplateView.as_view(template_name='dashboard/map.html',
                                      extra_context={'active': 'map'}), name='map'),
    # Prototype: the same data on a MapLibre map with 3D terrain
    path('map-3d/', TemplateView.as_view(template_name='dashboard/map3d.html',
                                         extra_context={'active': 'map3d'}), name='map3d'),
]
