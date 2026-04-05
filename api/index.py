import os
import sys

CURRENT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.dirname(CURRENT_DIR)
BACKEND_DIR = os.path.join(REPO_ROOT, 'backend')

for path in (REPO_ROOT, BACKEND_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

from backend.app import app

# Vercel Python runtime looks for a WSGI/ASGI application object named `app`.
