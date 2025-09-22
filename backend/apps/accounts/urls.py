"""
URL configuration for SafeSend accounts API.
All authentication and user management endpoints.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from django.views.decorators.csrf import csrf_exempt
from . import views

app_name = 'accounts'

urlpatterns = [
    # Authentication endpoints
    path('register/', csrf_exempt(views.UserRegistrationView.as_view()), name='register'),
    path('login/', csrf_exempt(views.UserLoginView.as_view()), name='login'),
    path('logout/', csrf_exempt(views.logout_view), name='logout'),
    path('refresh/', csrf_exempt(TokenRefreshView.as_view()), name='token_refresh'),

    # User profile endpoints
    path('profile/', views.UserProfileView.as_view(), name='profile'),
    path('profile/update/', views.ProfileUpdateView.as_view(), name='profile_update'),

    # Utility endpoints
    path('check-email/', views.check_email_availability, name='check_email'),
    path('check-username/', views.check_username_availability, name='check_username'),

    # Dashboard data
    path('dashboard/stats/', views.dashboard_stats, name='dashboard_stats'),
]