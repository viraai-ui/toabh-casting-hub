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

        tag = _expect(c.post('/api/settings/client-tags', headers=headers, json={'name': f'SmokeTag{suffix}', 'color': '#123456'}), 'create tag')
        tag_id = tag.get_json()['id']
        _expect(c.put(f'/api/settings/client-tags/{tag_id}', headers=headers, json={'name': f'SmokeTag{suffix}X', 'color': '#654321'}), 'update tag', allowed=(200,))

        source = _expect(c.post('/api/settings/sources', headers=headers, json={'name': f'SmokeSource{suffix}'}), 'create source', allowed=(200, 201))
        source_id = source.get_json()['id']
        _expect(c.put(f'/api/settings/sources/{source_id}', headers=headers, json={'name': f'SmokeSource{suffix}X'}), 'update source', allowed=(200,))

        pipe = _expect(c.post('/api/settings/pipeline', headers=headers, json={'name': f'SmokePipe{suffix}', 'color': '#999999'}), 'create pipeline', allowed=(200, 201))
        pipe_id = pipe.get_json()['id']
        _expect(c.put(f'/api/settings/pipeline/{pipe_id}', headers=headers, json={'name': f'SmokePipe{suffix}X', 'color': '#111111'}), 'update pipeline', allowed=(200,))
        _expect(c.put('/api/settings/pipeline/reorder', headers=headers, json={'stages': [{'id': pipe_id, 'sort_order': 99}]}), 'reorder pipeline', allowed=(200,))

        talent = _expect(c.post('/api/talents', headers=headers, json={'name': f'Smoke Talent {suffix}', 'instagram_handle': f'smoke{suffix}', 'phone': '999', 'email': f'smoke{suffix}@ex.com'}), 'create talent')
        talent_id = talent.get_json()['id']
        _expect(c.put(f'/api/talents/{talent_id}', headers=headers, json={'name': f'Smoke Talent {suffix} X', 'instagram_handle': f'smoke{suffix}x', 'phone': '998', 'email': f'smoke{suffix}x@ex.com'}), 'update talent', allowed=(200,))

        member = _expect(c.post('/api/team', headers=headers, json={'name': f'Resend {suffix}', 'role': 'Team Member', 'email': f'resend{suffix}@example.com'}), 'create member')
        member_id = member.get_json()['id']
        _expect(c.post(f'/api/team/{member_id}/toggle-status', headers=headers), 'toggle member', allowed=(200,))
        _expect(c.post(f'/api/team/{member_id}/resend-invite', headers=headers), 'resend invite', allowed=(200,))
        _expect(c.delete(f'/api/team/{member_id}', headers=headers), 'delete member', allowed=(200, 204))

    print('Extended Postgres smoke passed.')


if __name__ == '__main__':
    main()
