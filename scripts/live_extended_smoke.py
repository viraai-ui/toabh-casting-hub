import os
import requests
import time

base = os.environ.get('TOABH_BASE_URL', 'https://tch.toabh.com')
username = os.environ.get('TOABH_SMOKE_USERNAME', 'boss')
password = os.environ.get('TOABH_SMOKE_PASSWORD', 'Boss@2026!')
s = requests.Session()
login = s.post(base + '/api/auth/login', json={'username': username, 'password': password}, timeout=20)
print('login', login.status_code)

# profile
profile = s.get(base + '/api/profile', timeout=20)
print('profile_get', profile.status_code, profile.text[:220])
original_profile = profile.json() if profile.ok else {}
stamp = str(int(time.time()))
profile_update = s.put(base + '/api/profile', json={
    'name': original_profile.get('name') or f'Boss Smoke {stamp}',
    'email': original_profile.get('email') or f'boss.smoke.{stamp}@example.com',
    'phone': original_profile.get('phone') or f'9{stamp[-9:]}',
    'date_of_birth': original_profile.get('date_of_birth') or '',
}, timeout=20)
print('profile_put', profile_update.status_code, profile_update.text[:220])

# task comments
create_task = s.post(base + '/api/tasks', json={'title': f'Comment smoke {stamp}', 'description': 'tmp', 'assignee_ids': [2]}, timeout=20)
print('task_create', create_task.status_code, create_task.text[:220])
if create_task.ok:
    task_id = create_task.json().get('id')
    comment = s.post(base + f'/api/tasks/{task_id}/comments', json={'text': f'Note {stamp}', 'user_name': 'Tony'}, timeout=20)
    print('task_comment', comment.status_code, comment.text[:220])
    comments = s.get(base + f'/api/tasks/{task_id}/comments', timeout=20)
    print('task_comments_get', comments.status_code, comments.text[:220])
    s.delete(base + f'/api/tasks/{task_id}', timeout=20)

# settings email templates
get_templates = s.get(base + '/api/settings/email-templates', timeout=20)
print('email_templates_get', get_templates.status_code, get_templates.text[:220])

# audit log
get_audit = s.get(base + '/api/audit-log', timeout=20)
print('audit_log_get', get_audit.status_code, get_audit.text[:220])

# users endpoint
users = s.get(base + '/api/users', timeout=20)
print('users_get', users.status_code, users.text[:220])
