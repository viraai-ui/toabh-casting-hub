import importlib
import io
import os
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def fresh_app(runtime_root: str):
    os.environ['APP_RUNTIME_ROOT'] = runtime_root
    if 'backend.app' in sys.modules:
      del sys.modules['backend.app']
    module = importlib.import_module('backend.app')
    return module.app


def seed_casting(app):
    with app.app_context():
        from backend.app import get_db

        db = get_db()
        cursor = db.execute(
            '''
            INSERT INTO castings (
                client_name, client_company, client_contact, project_name, status,
                source, shoot_date_start, shoot_date_end, location, medium,
                project_type, requirements, priority, budget_min, budget_max
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                'Aisha Kapoor',
                'Southlight Studios',
                '+91 98765 43210',
                'Monsoon Campaign',
                'IN_PROGRESS',
                'Referral',
                '2026-04-02T09:00:00.000Z',
                '2026-04-03T18:00:00.000Z',
                'Mumbai',
                'Digital',
                'Commercial',
                'Need quick client turnaround',
                'High',
                50000,
                100000,
            ),
        )
        db.commit()
        return cursor.lastrowid


def main():
    with tempfile.TemporaryDirectory(prefix='toabh-phase3-backend-') as runtime_root:
        app = fresh_app(runtime_root)
        casting_id = seed_casting(app)
        client = app.test_client()

        note_response = client.post(
            '/api/comments',
            json={
                'casting_id': casting_id,
                'text': '@Rhea call sheet shared with the client.',
                'user_name': 'Team',
            },
        )
        assert note_response.status_code == 201, note_response.get_data(as_text=True)
        created_note = note_response.get_json()
        assert created_note['user_name'] == 'Team', created_note

        notes_response = client.get(f'/api/comments/{casting_id}')
        assert notes_response.status_code == 200, notes_response.get_data(as_text=True)
        notes = notes_response.get_json()
        assert notes[0]['user_name'] == 'Team', notes

        upload_response = client.post(
            f'/api/castings/{casting_id}/attachments',
            data={
                'user_name': 'Team',
                'file': (io.BytesIO(b'pdf-bytes'), 'lookbook.pdf'),
            },
            content_type='multipart/form-data',
        )
        assert upload_response.status_code == 201, upload_response.get_data(as_text=True)
        attachment = upload_response.get_json()
        assert attachment['original_filename'] == 'lookbook.pdf', attachment
        assert attachment['url'].startswith('/api/attachments/'), attachment

        attachments_response = client.get(f'/api/castings/{casting_id}/attachments')
        assert attachments_response.status_code == 200, attachments_response.get_data(as_text=True)
        attachments = attachments_response.get_json()['attachments']
        assert attachments[0]['original_filename'] == 'lookbook.pdf', attachments

        activities_response = client.get(f'/api/castings/{casting_id}/activities')
        assert activities_response.status_code == 200, activities_response.get_data(as_text=True)
        activities = activities_response.get_json()
        assert any(
            item.get('details') == '@Rhea call sheet shared with the client.' and item.get('team_member_name') == 'Team'
            for item in activities
        ), activities
        assert any(
            item.get('details') == 'Uploaded attachment: lookbook.pdf' and item.get('team_member_name') == 'Team'
            for item in activities
        ), activities

        dashboard_activities_response = client.get('/api/activities', query_string={'casting_id': casting_id})
        assert dashboard_activities_response.status_code == 200, dashboard_activities_response.get_data(as_text=True)
        dashboard_activities = dashboard_activities_response.get_json()['activities']
        assert any(
            item.get('description') == '@Rhea call sheet shared with the client.' and item.get('user_name') == 'Team'
            for item in dashboard_activities
        ), dashboard_activities
        assert any(
            item.get('description') == 'Uploaded attachment: lookbook.pdf' and item.get('user_name') == 'Team'
            for item in dashboard_activities
        ), dashboard_activities

        print('phase3 backend smoke passed')


if __name__ == '__main__':
    main()
