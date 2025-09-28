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
from django.http import JsonResponse, HttpResponse
from django.views.decorators.cache import never_cache
import os

def health_check(request):
    """Health check endpoint for container monitoring"""
    return JsonResponse({"status": "healthy", "service": "lunara-backend"})

def empty_source_map(request):
    """Return valid empty source map for missing browser extension files"""
    return JsonResponse({
        "version": 3,
        "sources": ["<no-source>"],
        "names": [],
        "mappings": "",
        "file": "empty.js"
    })

@never_cache
def serve_favicon(request, filename):
    """Serve favicon files with proper cache headers"""
    from django.views.static import serve
    from django.http import HttpResponse
    file_path = settings.BASE_DIR / 'static' / filename
    if file_path.exists():
        response = serve(request, filename, document_root=settings.BASE_DIR / 'static')
        response['Cache-Control'] = 'public, max-age=86400'  # Cache for 1 day
        return response
    else:
        return HttpResponse('Favicon not found', status=404)

@never_cache
def serve_js_file(request, filename):
    """Serve JavaScript files with no-cache headers for development"""
    file_path = settings.BASE_DIR.parent / 'frontend' / 'js' / filename
    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        response = HttpResponse(content, content_type='application/javascript')
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
    else:
        return HttpResponse('File not found', status=404)

urlpatterns = [
    # Health check for container monitoring
    path('health/', health_check, name='health'),

    # Admin interface
    path('admin/', admin.site.urls),

    # API endpoints
    path('api/auth/', include('apps.accounts.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/payments/', include('apps.payments.urls')),

    # Frontend routes (serve static files in development)
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('index.html', TemplateView.as_view(template_name='index.html'), name='index'),
    path('signin.html', TemplateView.as_view(template_name='signin.html'), name='signin'),
    path('signup.html', TemplateView.as_view(template_name='signup.html'), name='signup'),
    path('dashboard.html', TemplateView.as_view(template_name='dashboard.html'), name='dashboard'),
    path('projects.html', TemplateView.as_view(template_name='projects.html'), name='projects'),
    path('payments.html', TemplateView.as_view(template_name='payments.html'), name='payments'),
    path('messages.html', TemplateView.as_view(template_name='messages.html'), name='messages'),
    path('user_profile.html', TemplateView.as_view(template_name='user_profile.html'), name='user_profile'),
    path('support.html', TemplateView.as_view(template_name='support.html'), name='support'),
    path('test_flow.html', TemplateView.as_view(template_name='test_flow.html'), name='test_flow'),

    # Handle missing source map files from browser extensions
    path('passkeys.js.map', empty_source_map, name='passkeys_map'),
    path('nordpass-script.js.map', empty_source_map, name='nordpass_map'),
]

# Serve static files in development
if settings.DEBUG:
    # Serve collected static files and individual static directories
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    # Serve individual favicon files from backend static directory
    urlpatterns += [
        path('favicon.ico', serve_favicon, {'filename': 'favicon.ico'}),
        path('favicon-16x16.png', serve_favicon, {'filename': 'favicon-16x16.png'}),
        path('favicon-32x32.png', serve_favicon, {'filename': 'favicon-32x32.png'}),
        path('apple-touch-icon.png', serve_favicon, {'filename': 'apple-touch-icon.png'}),
    ]

    # Serve frontend static files directly
    urlpatterns += static('/css/', document_root=settings.BASE_DIR.parent / 'frontend' / 'css')

    # Add no-cache JS file serving for development
    urlpatterns += [
        path('js/<str:filename>', serve_js_file, name='serve_js'),
    ]
    urlpatterns += static('/js/', document_root=settings.BASE_DIR.parent / 'frontend' / 'js')
