import csv
import io
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
phone = f"9{stamp[-9:]}"
csv_buf = io.StringIO()
writer = csv.DictWriter(csv_buf, fieldnames=['name','instagram_handle','phone','email'])
writer.writeheader()
writer.writerow({'name': f'Vira Talent {stamp}', 'instagram_handle': f'vira.talent.{stamp}', 'phone': phone, 'email': f'vira.talent.{stamp}@example.com'})
files = {'file': ('talents.csv', csv_buf.getvalue(), 'text/csv')}
preview = s.post(base + '/api/talents/import', files=files, timeout=30)
print('preview', preview.status_code, preview.text[:260])
if preview.ok:
    data = preview.json()
    confirm = s.post(base + '/api/talents/import/confirm', json={'importable': data.get('importable', [])}, timeout=30)
    print('confirm', confirm.status_code, confirm.text[:260])
    search = s.get(base + '/api/talents/search', params={'q': f'Vira Talent {stamp}'}, timeout=20)
    print('search', search.status_code, search.text[:260])
