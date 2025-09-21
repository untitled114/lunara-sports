"""
Production settings for SafeSend project.
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
ALLOWED_HOSTS = [
    os.environ.get('WEBSITE_HOSTNAME', 'localhost'),
    'lunara-backend.azurewebsites.net',
    'gentle-dune-04dd3000f.1.azurestaticapps.net',  # Your Static Web App
]

# Database - PostgreSQL on Azure
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('AZURE_POSTGRESQL_NAME'),
        'USER': os.environ.get('AZURE_POSTGRESQL_USER'),
        'PASSWORD': os.environ.get('AZURE_POSTGRESQL_PASSWORD'),
        'HOST': os.environ.get('AZURE_POSTGRESQL_HOST'),
        'PORT': '5432',
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
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Session security
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://gentle-dune-04dd3000f.1.azurestaticapps.net",  # Your Static Web App
    "https://lunara-backend.azurewebsites.net",  # Your API domain
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
        'safesend': {
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
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@safesend.com')

# Override JWT signing key from environment
SIMPLE_JWT['SIGNING_KEY'] = SECRET_KEY