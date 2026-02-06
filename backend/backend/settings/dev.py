from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-_1@di!l(smqkmg8mim9!@7pf7q283n)=hdvt!&-mn)g@o*-p1v"

# SECURITY WARNING: define the correct hosts in production!
ALLOWED_HOSTS = ["*"]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


try:
    from .local import *
except ImportError:
    pass

# Wagtail API
WAGTAILAPI_BASE_URL = 'http://188.120.229.244'

# CORS for React frontend
INSTALLED_APPS += ['corsheaders']
MIDDLEWARE.insert(1, 'corsheaders.middleware.CorsMiddleware')
CORS_ALLOW_ALL_ORIGINS = True

MEDIA_URL = '/oilgascity-media/'

STATIC_URL = '/oilgascity-static/'
