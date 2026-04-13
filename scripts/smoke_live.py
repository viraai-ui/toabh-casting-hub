import requests

base = 'https://tch.toabh.com'
s = requests.Session()
login = s.post(base + '/api/auth/login', json={'username': 'tony', 'password': 'Tony@TOABH2026'}, timeout=20)
print('login', login.status_code, login.text[:200])
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
    r = s.get(base + path, timeout=20)
    print(path, r.status_code, r.headers.get('content-type', ''), r.text[:180].replace('\n', ' '))
