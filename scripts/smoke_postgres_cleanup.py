#!/usr/bin/env python3
import atexit
import shutil
import tempfile
import time
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
    suffix = str(int(time.time()))[-6:]
    with app.test_client() as c:
        login = _expect(c.post('/api/auth/login', json={'username': 'admin', 'password': 'admin'}), 'login', allowed=(200,))
        token = login.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        tag = _expect(c.post('/api/settings/client-tags', headers=headers, json={'name': f'CleanupTag{suffix}', 'color': '#123456'}), 'create tag')
        tag_id = tag.get_json()['id']

        client = _expect(c.post('/api/clients', headers=headers, json={'name': f'Cleanup Client {suffix}', 'company': 'Smoke Co', 'email': f'cleanup{suffix}@example.com', 'tag_ids': [tag_id]}), 'create client')
        client_id = client.get_json()['id']

        talent = _expect(c.post('/api/talents', headers=headers, json={'name': f'Cleanup Talent {suffix}', 'instagram_handle': f'cleanup{suffix}', 'phone': '999', 'email': f'cleanup-talent{suffix}@ex.com'}), 'create talent')
        talent_id = talent.get_json()['id']

        casting = _expect(c.post('/api/castings', headers=headers, json={'project_name': f'Cleanup Casting {suffix}', 'client_name': f'Cleanup Client {suffix}', 'status': 'NEW', 'priority': 'NORMAL'}), 'create casting')
        casting_id = casting.get_json()['id']

        _expect(c.post(f'/api/castings/{casting_id}/talents', headers=headers, json={'talent_ids': [talent_id]}), 'attach talent', allowed=(200, 201))
        _expect(c.post(f'/api/clients/{client_id}/tags', headers=headers, json={'tag_id': tag_id}), 'attach tag', allowed=(200, 201, 409))
        _expect(c.delete(f'/api/clients/{client_id}/tags/{tag_id}', headers=headers), 'detach tag', allowed=(200, 204))
        _expect(c.delete(f'/api/castings/{casting_id}', headers=headers), 'delete casting', allowed=(200, 204))
        _expect(c.delete(f'/api/talents/{talent_id}', headers=headers), 'delete talent', allowed=(200, 204))
        _expect(c.delete(f'/api/clients/{client_id}', headers=headers), 'delete client', allowed=(200, 204))
        _expect(c.delete(f'/api/settings/client-tags/{tag_id}', headers=headers), 'delete tag', allowed=(200, 204))

    print('Cleanup Postgres smoke passed.')


if __name__ == '__main__':
    main()
