from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# Ключ только для локальной разработки; прод берёт свой из DJANGO_SECRET_KEY (production.py)
SECRET_KEY = "django-insecure-_1@di!l(smqkmg8mim9!@7pf7q283n)=hdvt!&-mn)g@o*-p1v"

ALLOWED_HOSTS = ["*"]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


try:
    from .local import *
except ImportError:
    pass
