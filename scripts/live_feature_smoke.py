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
talent_phone = f"9{stamp[-9:]}"

client_payload = {
    'name': f'Vira Client {stamp}',
    'company': 'Vira QA Co',
    'contact': 'QA Contact',
    'email': f'vira{stamp}@example.com',
    'phone': '9999999999',
    'notes': 'Temporary smoke client',
}
client = s.post(base + '/api/clients', json=client_payload, timeout=20)
print('create_client', client.status_code, client.text[:200])
client_id = client.json().get('id') if client.ok else None

casting_payload = {
    'project_name': f'Vira Casting {stamp}',
    'client_name': client_payload['name'],
    'client_company': client_payload['company'],
    'client_contact': client_payload['contact'],
    'client_email': client_payload['email'],
    'status': 'NEW',
    'priority': 'NORMAL',
    'assigned_to': [2],
}
casting = s.post(base + '/api/castings', json=casting_payload, timeout=20)
print('create_casting', casting.status_code, casting.text[:220])
casting_id = casting.json().get('id') if casting.ok else None

team_payload = {
    'name': f'Vira Member {stamp}',
    'email': f'vira.member.{stamp}@example.com',
    'role': 'Team Member',
    'phone': '8888888888',
}
team = s.post(base + '/api/team', json=team_payload, timeout=20)
print('create_team', team.status_code, team.text[:220])
team_id = team.json().get('id') if team.ok else None

csv_buf = io.StringIO()
writer = csv.DictWriter(csv_buf, fieldnames=['name','instagram_handle','phone','email'])
writer.writeheader()
writer.writerow({'name': f'Vira Talent {stamp}', 'instagram_handle': f'vira.talent.{stamp}', 'phone': talent_phone, 'email': f'vira.talent.{stamp}@example.com'})
files = {'file': ('talents.csv', csv_buf.getvalue(), 'text/csv')}
import_resp = s.post(base + '/api/talents/import', files=files, timeout=30)
print('import_talent', import_resp.status_code, import_resp.text[:260])
confirm_count = 0
if import_resp.ok:
    data = import_resp.json()
    rows = data.get('importable') or data.get('rows') or data.get('preview') or []
    confirm = s.post(base + '/api/talents/import/confirm', json={'importable': rows}, timeout=30)
    print('confirm_talent_import', confirm.status_code, confirm.text[:260])
    if confirm.ok:
        confirm_count = int(confirm.json().get('imported') or 0)

if casting_id:
    assign = s.put(base + f'/api/castings/{casting_id}/assign', json={'assigned_to': [2]}, timeout=20)
    print('assign_casting', assign.status_code, assign.text[:200])
    note = s.post(base + f'/api/castings/{casting_id}/notes', json={'note': 'Smoke note'}, timeout=20)
    print('note_casting', note.status_code, note.text[:200])
    status = s.put(base + f'/api/castings/{casting_id}/status', json={'status': 'SHORTLISTED'}, timeout=20)
    print('status_casting', status.status_code, status.text[:200])

if team_id:
    toggle = s.post(base + f'/api/team/{team_id}/toggle-status', timeout=20)
    print('toggle_team', toggle.status_code, toggle.text[:200])

if casting_id:
    delete_casting = s.delete(base + f'/api/castings/{casting_id}', timeout=20)
    print('delete_casting', delete_casting.status_code, delete_casting.text[:200])
if client_id:
    delete_client = s.delete(base + f'/api/clients/{client_id}', timeout=20)
    print('delete_client', delete_client.status_code, delete_client.text[:200])
if team_id:
    delete_team = s.delete(base + f'/api/team/{team_id}', timeout=20)
    print('delete_team', delete_team.status_code, delete_team.text[:200])

print('talent_created_count', confirm_count)
