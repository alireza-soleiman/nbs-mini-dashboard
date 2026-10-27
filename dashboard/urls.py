from django.urls import path
from django.views.generic import TemplateView

# Two pages; their JavaScript loads all data from /api/
urlpatterns = [
    path('', TemplateView.as_view(template_name='dashboard/overview.html',
                                  extra_context={'active': 'overview'}), name='overview'),
    path('map/', TemplateView.as_view(template_name='dashboard/map.html',
                                      extra_context={'active': 'map'}), name='map'),
]
