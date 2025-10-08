"""
Production settings for Lunara project.
Azure deployment with PostgreSQL database.
"""

from .base import *
import os
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

# Security
DEBUG = False
SECRET_KEY = os.environ.get('SECRET_KEY')

# Azure App Service automatically sets WEBSITE_HOSTNAME
# Production allowed hosts - specific domains only
ALLOWED_HOSTS = [
    'lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io',  # Azure Container Apps
    'api.lunara-app.com',  # Custom domain
    'localhost',  # Local testing
    '127.0.0.1',  # Local testing
]

# Database - PostgreSQL on Azure (using Neon)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'OPTIONS': {
            'sslmode': 'require',
        },
    }
}

# Redis Cache on Azure
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('AZURE_REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# Azure Blob Storage for media files
DEFAULT_FILE_STORAGE = 'storages.backends.azure_storage.AzureStorage'
AZURE_ACCOUNT_NAME = os.environ.get('AZURE_STORAGE_ACCOUNT_NAME')
AZURE_ACCOUNT_KEY = os.environ.get('AZURE_STORAGE_ACCOUNT_KEY')
AZURE_CONTAINER = 'media'

# Static files - WhiteNoise for static file serving
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Security settings for production
# SSL/TLS Configuration
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# HTTP Strict Transport Security (HSTS)
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Session and CSRF security
SESSION_COOKIE_SECURE = True  # Only send over HTTPS
CSRF_COOKIE_SECURE = True  # Only send over HTTPS
SESSION_COOKIE_HTTPONLY = True  # Prevent JavaScript access
CSRF_COOKIE_HTTPONLY = True  # Prevent JavaScript access
SESSION_COOKIE_SAMESITE = 'Lax'  # CSRF protection
CSRF_COOKIE_SAMESITE = 'Lax'  # CSRF protection

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://salmon-coast-0c72e310f.2.azurestaticapps.net",  # NEW Static Web App
    "https://lunara-app.com",  # Custom domain (primary)
    "https://www.lunara-app.com",  # Custom domain with www
    "https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io",  # NEW Backend container
]

# Allow credentials for CORS
CORS_ALLOW_CREDENTIALS = True

# Disable promiscuous CORS for production security
CORS_ALLOW_ALL_ORIGINS = False  # Use explicit CORS_ALLOWED_ORIGINS only
CORS_ALLOWED_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# Logging for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
        },
        'lunara': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Email settings (configure with your email service)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@lunara-app.com')

# Override JWT signing key from environment
SIMPLE_JWT['SIGNING_KEY'] = SECRET_KEY