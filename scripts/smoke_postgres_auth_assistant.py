#!/usr/bin/env python3
import atexit
import shutil
import tempfile
from pathlib import Path

import os

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
load_dotenv(ROOT / '.env.staging.local')

RUNTIME_ROOT = Path(tempfile.mkdtemp(prefix='toabh-pg-smoke-'))
atexit.register(lambda: shutil.rmtree(RUNTIME_ROOT, ignore_errors=True))
os.environ['APP_RUNTIME_ROOT'] = str(RUNTIME_ROOT)

from backend.app import app  # noqa: E402


def _preview(response):
    return response.get_data(as_text=True).replace('\n', ' ')[:220]


def _expect(response, label, allowed=(200, 201)):
    print(f'{label}: {response.status_code} {_preview(response)}')
    if response.status_code not in allowed:
        raise SystemExit(f'{label} failed with {response.status_code}')
    return response


def main():
    with app.test_client() as c:
        login = _expect(c.post('/api/auth/login', json={'username': 'admin', 'password': 'admin'}), 'login', allowed=(200,))
        token = login.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        _expect(c.post('/api/assistant/query', headers=headers, json={'query': 'show recent castings'}), 'assistant query', allowed=(200,))
        _expect(c.post('/api/parse', json={'text': 'Client: Nike, Project: Campaign, Shoot date: tomorrow, Budget: Rs. 50000'}), 'parse message', allowed=(200,))
        _expect(c.post('/api/auth/verify-password', json={'password': 'toabh2026'}), 'verify admin password', allowed=(200,))
        _expect(c.post('/api/auth/forgot-password', json={'email': 'admin@toabh.com'}), 'forgot password', allowed=(200,))
        _expect(c.post('/api/auth/change-password', headers=headers, json={'current_password': 'admin', 'new_password': 'admin'}), 'change password', allowed=(200,))

    print('Auth/assistant Postgres smoke passed.')


if __name__ == '__main__':
    main()
