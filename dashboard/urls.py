from django.urls import path
from django.views.generic import TemplateView

# The pages; their JavaScript loads all data from /api/.
# Compare and Admin are MOCKUPS for the team demo: they show ideas, nothing is saved.
urlpatterns = [
    path('', TemplateView.as_view(template_name='dashboard/overview.html',
                                  extra_context={'active': 'overview'}), name='overview'),
    path('map/', TemplateView.as_view(template_name='dashboard/map.html',
                                      extra_context={'active': 'map'}), name='map'),
    path('compare/', TemplateView.as_view(template_name='dashboard/compare.html',
                                          extra_context={'active': 'compare'}), name='compare'),
    # Not /admin/: that is Django's real admin site
    path('admin-mockup/', TemplateView.as_view(template_name='dashboard/admin_mockup.html',
                                               extra_context={'active': 'admin'}), name='admin-mockup'),
]
