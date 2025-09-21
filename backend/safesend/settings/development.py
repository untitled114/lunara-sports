"""
Development settings for SafeSend project.
Local development with SQLite database.
"""

from .base import *
import os

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-dev-key-change-in-production'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

# Database - SQLite for local development
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Development-specific apps (optional)
# INSTALLED_APPS += [
#     'django_extensions',  # Useful development tools
# ]

# Debug toolbar disabled for now
# if DEBUG:
#     try:
#         import debug_toolbar
#         INSTALLED_APPS += ['debug_toolbar']
#         MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')
#     except ImportError:
#         pass

#     # Debug toolbar configuration
#     INTERNAL_IPS = ['127.0.0.1', 'localhost']
#     DEBUG_TOOLBAR_CONFIG = {
#         'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,
#     }

# Cache - Use local memory for development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# Email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Logging configuration
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
            'level': 'INFO',
        },
        'safesend': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# Development CORS settings - Allow all origins
CORS_ALLOW_ALL_ORIGINS = True

# Override JWT signing key for development
SIMPLE_JWT['SIGNING_KEY'] = SECRET_KEY

# Static files serving in development
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'