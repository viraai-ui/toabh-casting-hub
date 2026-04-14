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

PERMISSIONS_FILE = ROOT / 'backend' / 'permissions.json'
PERMISSIONS_BACKUP = PERMISSIONS_FILE.read_text() if PERMISSIONS_FILE.exists() else None


def _restore_permissions_file():
    if PERMISSIONS_BACKUP is None:
        if PERMISSIONS_FILE.exists():
            PERMISSIONS_FILE.unlink()
    else:
        PERMISSIONS_FILE.write_text(PERMISSIONS_BACKUP)


atexit.register(_restore_permissions_file)

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

        _expect(c.put('/api/profile', headers=headers, json={'name': f'Tony {suffix}', 'email': f'tony{suffix}@toabh.com', 'phone': '9999999999', 'date_of_birth': '1990-01-01'}), 'update profile', allowed=(200,))
        _expect(c.put('/api/settings/custom-fields', headers=headers, json={'fields': [{'id': 'cf999', 'name': f'Field {suffix}', 'type': 'text', 'tab': 'Custom', 'required': False}]}), 'update custom fields', allowed=(200,))
        _expect(c.post('/api/settings/custom-fields', headers=headers, json={'name': f'Field Created {suffix}', 'type': 'text', 'tab': 'Custom', 'required': False}), 'create custom field', allowed=(201,))
        _expect(c.put('/api/settings/dashboard-modules', headers=headers, json={'kanban': True, 'calendar': False, 'activityFeed': True, 'quickActions': True, 'charts': False, 'default_view': 'list'}), 'update dashboard modules', allowed=(200,))
        _expect(c.put('/api/settings/automation-rules', headers=headers, json={'rules': [{'id': 'status_changed', 'label': 'Status changed', 'description': 'x', 'channels': ['in_app'], 'enabled': True}]}), 'update automation rules', allowed=(200,))
        _expect(c.put('/api/settings/email-config', headers=headers, json={'from_email': f'noreply{suffix}@toabh.com', 'from_name': 'TOABH', 'smtp_host': 'smtp.test.com', 'smtp_port': 587, 'smtp_username': 'user', 'smtp_password': 'pass'}), 'update email config', allowed=(200,))
        template = _expect(c.post('/api/settings/email-templates', headers=headers, json={'name': f'Template {suffix}', 'subject': 'Subject', 'body': 'Body'}), 'create email template', allowed=(201,))
        template_id = template.get_json()['id']
        _expect(c.put(f'/api/settings/email-templates/{template_id}', headers=headers, json={'name': f'Template {suffix}X', 'subject': 'Subject X', 'body': 'Body X'}), 'update email template', allowed=(200,))
        _expect(c.delete(f'/api/settings/email-templates/{template_id}', headers=headers), 'delete email template', allowed=(200, 204))
        _expect(c.put('/api/settings/permissions', headers=headers, json={'admin': {'dashboard': 1}}), 'update permissions', allowed=(200,))
        _expect(c.put('/api/settings/roles', headers=headers, json=[{'id': 1, 'name': 'Admin', 'permissions': ['dashboard_view']}]), 'update roles', allowed=(200,))
        _expect(c.put('/api/settings/task-stages', headers=headers, json={'stages': [{'id': 1, 'name': 'Queued', 'color': '#111111', 'sort_order': 0}, {'id': 2, 'name': 'Done', 'color': '#222222', 'sort_order': 1}]}), 'update task stages', allowed=(200,))

    print('Settings/files Postgres smoke passed.')


if __name__ == '__main__':
    main()
