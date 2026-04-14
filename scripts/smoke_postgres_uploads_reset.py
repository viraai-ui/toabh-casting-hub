#!/usr/bin/env python3
import atexit
import io
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

        member = _expect(c.post('/api/team', headers=headers, json={'name': f'Upload {suffix}', 'role': 'Team Member', 'email': f'upload{suffix}@example.com'}), 'create member')
        member_id = member.get_json()['id']

        casting = _expect(c.post('/api/castings', headers=headers, json={'project_name': f'Upload Casting {suffix}', 'client_name': f'Upload Client {suffix}', 'status': 'NEW', 'priority': 'NORMAL'}), 'create casting')
        casting_id = casting.get_json()['id']

        avatar = _expect(
            c.post(
                f'/api/team/{member_id}/avatar',
                headers=headers,
                data={'file': (io.BytesIO(b'fakepngdata'), 'avatar.png')},
                content_type='multipart/form-data',
            ),
            'upload member avatar',
            allowed=(200,),
        )
        _expect(c.get(avatar.get_json()['avatar_url'], headers=headers), 'serve member avatar', allowed=(200,))

        attachment = _expect(
            c.post(
                f'/api/castings/{casting_id}/attachments',
                headers=headers,
                data={'file': (io.BytesIO(b'pdfdata'), 'brief.pdf')},
                content_type='multipart/form-data',
            ),
            'upload casting attachment',
            allowed=(201,),
        )
        _expect(c.get(f'/api/castings/{casting_id}/attachments', headers=headers), 'list casting attachments', allowed=(200,))
        _expect(c.get(attachment.get_json()['url'], headers=headers), 'serve casting attachment', allowed=(200,))

        _expect(c.post('/api/auth/forgot-password', json={'email': f'upload{suffix}@example.com'}), 'forgot password member', allowed=(200,))
        token_row = c.application.app_context()
        with token_row:
            db = app.view_functions['get_db']() if 'get_db' in app.view_functions else None

        from backend.app import get_db
        with app.app_context():
            db = get_db()
            row = db.execute('SELECT token FROM password_reset_tokens ORDER BY id DESC LIMIT 1').fetchone()
            reset_token = row['token']
        _expect(c.post('/api/auth/reset-password', json={'token': reset_token, 'password': 'Reset123!'}), 'reset password', allowed=(200,))

    print('Uploads/reset Postgres smoke passed.')


if __name__ == '__main__':
    main()
