import os
from backend.app import app

with app.test_client() as c:
    login = c.post('/api/auth/login', json={'username': 'tony', 'password': 'Tony@TOABH2026'})
    print('login', login.status_code, login.get_data(as_text=True)[:200])
    for path in [
        '/api/auth/me',
        '/api/dashboard',
        '/api/castings',
        '/api/clients',
        '/api/team',
        '/api/tasks',
        '/api/talents',
        '/api/settings/pipeline',
        '/api/settings/sources',
        '/api/settings/client-tags',
        '/api/notifications',
        '/api/activities',
        '/api/search?q=tony',
    ]:
        r = c.get(path)
        print(path, r.status_code, r.get_data(as_text=True)[:220].replace('\n', ' '))
