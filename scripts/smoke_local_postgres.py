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
        login = _expect(
            c.post('/api/auth/login', json={'username': 'admin', 'password': 'admin'}),
            'login',
            allowed=(200,),
        )
        token = login.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        member = _expect(
            c.post(
                '/api/team',
                headers=headers,
                json={
                    'name': f'PG Smoke {suffix}',
                    'role': 'Team Member',
                    'email': f'pgsmoke{suffix}@example.com',
                },
            ),
            'create member',
        )
        member_id = member.get_json()['id']

        client = _expect(
            c.post(
                '/api/clients',
                headers=headers,
                json={
                    'name': f'Client {suffix}',
                    'company': 'Smoke Co',
                    'email': f'client{suffix}@example.com',
                    'tag_ids': [],
                },
            ),
            'create client',
        )
        client_id = client.get_json()['id']

        task = _expect(
            c.post(
                '/api/tasks',
                headers=headers,
                json={
                    'title': f'Task {suffix}',
                    'status': 'Not Started',
                    'assignee_ids': [member_id],
                },
            ),
            'create task',
        )
        task_id = task.get_json()['id']

        casting = _expect(
            c.post(
                '/api/castings',
                headers=headers,
                json={
                    'project_name': f'Casting {suffix}',
                    'client_name': f'Client {suffix}',
                    'status': 'NEW',
                    'priority': 'NORMAL',
                },
            ),
            'create casting',
        )
        casting_id = casting.get_json()['id']

        _expect(
            c.put(
                f'/api/castings/{casting_id}/assign',
                headers=headers,
                json={'team_member_ids': [member_id]},
            ),
            'assign casting',
            allowed=(200,),
        )
        _expect(
            c.post(
                f'/api/tasks/{task_id}/comments',
                headers=headers,
                json={'text': 'smoke comment', 'user_name': 'Admin'},
            ),
            'task comment',
        )
        _expect(
            c.put(
                f'/api/tasks/{task_id}/status',
                headers=headers,
                json={'status': 'Completed'},
            ),
            'task status',
            allowed=(200,),
        )
        _expect(
            c.put(
                f'/api/clients/{client_id}',
                headers=headers,
                json={
                    'name': f'Client {suffix} Updated',
                    'company': 'Smoke Co',
                    'email': f'client{suffix}@example.com',
                    'tag_ids': [],
                },
            ),
            'update client',
            allowed=(200,),
        )
        _expect(c.get('/api/dashboard', headers=headers), 'dashboard', allowed=(200,))
        _expect(c.get('/api/castings', headers=headers), 'castings list', allowed=(200,))
        _expect(c.get('/api/team', headers=headers), 'team list', allowed=(200,))
        _expect(c.get('/api/tasks', headers=headers), 'tasks list', allowed=(200,))

    print('Postgres smoke passed.')


if __name__ == '__main__':
    main()
