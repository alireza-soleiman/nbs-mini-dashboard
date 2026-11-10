"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import include, path, re_path
from django.views.decorators.cache import cache_control

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('catalog.urls')),
    path('', include('dashboard.urls')),
]

if settings.DEBUG:
    # Development only (the server runs with --nostatic, see compose.yaml): serve CSS and
    # JavaScript with "Cache-Control: no-cache" = "always ask the server first". Without
    # a cache rule, a browser may show a new page with an OLD script for a day or more.
    # (A production server delivers static files itself, with file names that change.)
    urlpatterns += [
        re_path(r'^static/(?P<path>.*)$', cache_control(no_cache=True)(serve)),
    ]
