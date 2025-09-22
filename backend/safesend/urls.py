"""
URL configuration for safesend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
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
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    # Admin interface
    path('admin/', admin.site.urls),

    # API endpoints
    path('api/auth/', include('apps.accounts.urls')),
    path('api/projects/', include('apps.projects.urls')),

    # Frontend routes (serve static files in development)
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('signin.html', TemplateView.as_view(template_name='signin.html'), name='signin'),
    path('signup.html', TemplateView.as_view(template_name='signup.html'), name='signup'),
    path('dashboard.html', TemplateView.as_view(template_name='dashboard.html'), name='dashboard'),
    path('projects.html', TemplateView.as_view(template_name='projects.html'), name='projects'),
    path('payments.html', TemplateView.as_view(template_name='payments.html'), name='payments'),
    path('messages.html', TemplateView.as_view(template_name='messages.html'), name='messages'),
    path('user_profile.html', TemplateView.as_view(template_name='user_profile.html'), name='user_profile'),
    path('support.html', TemplateView.as_view(template_name='support.html'), name='support'),
    path('test_flow.html', TemplateView.as_view(template_name='test_flow.html'), name='test_flow'),
]

# Serve static files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # Serve frontend static files directly
    urlpatterns += static('/css/', document_root=settings.BASE_DIR.parent / 'frontend' / 'css')
    urlpatterns += static('/js/', document_root=settings.BASE_DIR.parent / 'frontend' / 'js')
