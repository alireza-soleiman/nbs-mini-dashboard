from django.urls import path
from django.views.generic import TemplateView

urlpatterns = [
    # The whole dashboard is one page; its JavaScript loads the data from /api/
    path('', TemplateView.as_view(template_name='dashboard/index.html'), name='dashboard'),
]
