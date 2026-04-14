import json
from backend.app import app, get_db, _insert_assignment_if_missing

with app.app_context():
    db = get_db()
    try:
        row = db.execute('SELECT * FROM tasks WHERE id = ?', (1,)).fetchone()
        print('row ok', bool(row))
        title = 'debug title'
        description = 'debug desc'
        status = 'Completed'
        due_date = None
        priority = 'HIGH'
        custom_fields = json.dumps(json.loads(row['custom_fields'] or '{}'))
        steps = [
            ('update', lambda: db.execute(
                'UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ?, priority = ?, custom_fields = ?, updated_at = datetime(\'now\') WHERE id = ?',
                (title, description, status, due_date, priority, custom_fields, 1),
            )),
            ('delete_assignments', lambda: db.execute('DELETE FROM task_assignments WHERE task_id = ?', (1,))),
            ('insert_assignment', lambda: _insert_assignment_if_missing(db, 'task_assignments', 'task_id', 'team_member_id', 1, 2)),
            ('activity_assigned', lambda: db.execute(
                'INSERT INTO task_activities (task_id, team_member_id, action, details) VALUES (?, ?, ?, ?)',
                (1, None, 'ASSIGNED', 'Task assignment updated'),
            )),
            ('activity_updated', lambda: db.execute(
                'INSERT INTO task_activities (task_id, team_member_id, action, details) VALUES (?, ?, ?, ?)',
                (1, None, 'UPDATED', 'Task updated'),
            )),
        ]
        for name, fn in steps:
            try:
                fn()
                print(name, 'ok')
            except Exception as e:
                print(name, type(e).__name__, e)
                break
    finally:
        db.rollback()
