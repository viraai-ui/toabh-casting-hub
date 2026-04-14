import os
import time
import requests

base = os.environ.get('TOABH_BASE_URL', 'https://tch.toabh.com')
username = os.environ.get('TOABH_SMOKE_USERNAME', 'boss')
password = os.environ.get('TOABH_SMOKE_PASSWORD', 'Boss@2026!')
s = requests.Session()
login = s.post(base + '/api/auth/login', json={'username': username, 'password': password}, timeout=20)
print('login', login.status_code)

stamp = str(int(time.time()))
created_task_id = None

payload = {
    'title': f'Vira smoke task {stamp}',
    'description': 'Temporary live smoke test task',
    'status': 'Not Started',
    'priority': 'NORMAL',
    'assignee_ids': [2],
}
create = s.post(base + '/api/tasks', json=payload, timeout=20)
print('create_task', create.status_code, create.text[:220])
if create.ok:
    created_task_id = create.json().get('id')

if created_task_id:
    update = s.put(base + f'/api/tasks/{created_task_id}', json={
        'title': f'Vira smoke task {stamp} updated',
        'description': 'Updated during live smoke test',
        'status': 'Completed',
        'priority': 'HIGH',
        'assignee_ids': [2],
    }, timeout=20)
    print('update_task', update.status_code, update.text[:220])

    detail = s.get(base + f'/api/tasks/{created_task_id}', timeout=20)
    print('task_detail', detail.status_code, detail.text[:220])

    delete = s.delete(base + f'/api/tasks/{created_task_id}', timeout=20)
    print('delete_task', delete.status_code, delete.text[:220])

    check = s.get(base + f'/api/tasks/{created_task_id}', timeout=20)
    print('post_delete_detail', check.status_code, check.text[:220])
