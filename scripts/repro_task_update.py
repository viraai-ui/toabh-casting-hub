import os

from backend.app import app

username = os.environ.get('TOABH_SMOKE_USERNAME', 'boss')
password = os.environ.get('TOABH_SMOKE_PASSWORD', 'Boss@2026!')

with app.test_client() as c:
    login = c.post('/api/auth/login', json={'username': username, 'password': password})
    print('login', login.status_code, login.get_data(as_text=True)[:200])
    create = c.post('/api/tasks', json={
        'title': 'repro task',
        'description': 'tmp',
        'status': 'Not Started',
        'priority': 'NORMAL',
        'assignee_ids': [2],
    })
    print('create', create.status_code, create.get_data(as_text=True)[:400])
    if create.status_code not in (200, 201):
        raise SystemExit(1)
    task_id = create.get_json()['id']
    update = c.put(f'/api/tasks/{task_id}', json={
        'title': 'repro task updated',
        'description': 'tmp2',
        'status': 'Completed',
        'priority': 'HIGH',
        'assignee_ids': [2],
    })
    print('update', update.status_code, update.get_data(as_text=True)[:1200])
    c.delete(f'/api/tasks/{task_id}')
