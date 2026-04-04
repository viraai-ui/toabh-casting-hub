import os
import sqlite3
import json
import shutil
import smtplib
import mimetypes
import re
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, g, send_from_directory, send_file
from werkzeug.serving import make_server
from dotenv import load_dotenv
import threading

BASE_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.dirname(BASE_DIR)
READ_ONLY_DB_PATH = os.path.join(BASE_DIR, 'castings.db')
READ_ONLY_SETTINGS_DIR = os.path.join(BASE_DIR, 'settings')
DEFAULT_RUNTIME_ROOT = os.path.join('/tmp', 'toabh-casting-hub') if os.environ.get('VERCEL') else BASE_DIR
RUNTIME_ROOT = os.environ.get('APP_RUNTIME_ROOT', DEFAULT_RUNTIME_ROOT)
SETTINGS_DIR = os.path.join(RUNTIME_ROOT, 'settings')
UPLOADS_DIR = os.path.join(RUNTIME_ROOT, 'uploads')
DATABASE_PATH = os.path.join(RUNTIME_ROOT, 'castings.db')

load_dotenv(os.path.join(REPO_ROOT, '.env'))


def ensure_runtime_storage():
    os.makedirs(RUNTIME_ROOT, exist_ok=True)
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)

    if os.path.exists(READ_ONLY_SETTINGS_DIR):
        for name in os.listdir(READ_ONLY_SETTINGS_DIR):
            src = os.path.join(READ_ONLY_SETTINGS_DIR, name)
            dst = os.path.join(SETTINGS_DIR, name)
            if os.path.isfile(src) and not os.path.exists(dst):
                shutil.copy2(src, dst)

    if os.path.exists(READ_ONLY_DB_PATH) and not os.path.exists(DATABASE_PATH):
        shutil.copy2(READ_ONLY_DB_PATH, DATABASE_PATH)


ensure_runtime_storage()

app = Flask(__name__, static_folder=None)
app.config['DATABASE'] = DATABASE_PATH
app.config['UPLOADS_DIR'] = UPLOADS_DIR

# Path to frontend dist (now inside the same repo as this backend)
FRONTEND_DIST = os.path.join(REPO_ROOT, 'dist')

ALLOWED_ATTACHMENT_EXTENSIONS = {
    'pdf',
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'mp4', 'mov', 'avi', 'm4v', 'webm',
    'doc', 'docx', 'txt', 'rtf',
    'ppt', 'pptx', 'xls', 'xlsx'
}
ALLOWED_ATTACHMENT_MIME_PREFIXES = (
    'image/',
    'video/',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.',
    'application/vnd.ms-',
    'text/plain',
    'text/rtf',
)


def _ensure_uploads_dir(*parts):
    path = os.path.join(app.config['UPLOADS_DIR'], *parts)
    os.makedirs(path, exist_ok=True)
    return path


def _attachment_storage_dir(casting_id):
    return _ensure_uploads_dir('castings', str(casting_id))


def _attachment_public_url(attachment_id):
    return f'/api/attachments/{attachment_id}'


def _is_allowed_attachment(file_storage):
    filename = file_storage.filename or ''
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        return False, ext, f'File type not allowed. Use: {", ".join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}'

    mime_type = (file_storage.mimetype or '').lower()
    if mime_type and not (
        mime_type.startswith(ALLOWED_ATTACHMENT_MIME_PREFIXES)
        or mime_type in {'application/rtf', 'application/octet-stream'}
    ):
        return False, ext, 'File mime type not allowed'

    return True, ext, None

# Database helpers
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS castings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT DEFAULT 'manual',
            source_detail TEXT,
            client_name TEXT,
            client_company TEXT,
            client_contact TEXT,
            project_name TEXT,
            project_type TEXT,
            shoot_date_start TEXT,
            shoot_date_end TEXT,
            location TEXT,
            medium TEXT,
            usage TEXT,
            budget_min REAL,
            budget_max REAL,
            requirements TEXT,
            apply_to TEXT,
            status TEXT DEFAULT 'NEW',
            priority TEXT DEFAULT 'NORMAL',
            custom_fields TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT,
            email TEXT,
            phone TEXT,
            avatar_url TEXT,
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS casting_assignments (
            casting_id INTEGER,
            team_member_id INTEGER,
            PRIMARY KEY (casting_id, team_member_id),
            FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE,
            FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            casting_id INTEGER,
            team_member_id INTEGER,
            action TEXT,
            details TEXT,
            timestamp TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE,
            FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT,
            contact TEXT,
            email TEXT,
            phone TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS casting_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            casting_id INTEGER NOT NULL,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            mime_type TEXT,
            file_size INTEGER DEFAULT 0,
            file_ext TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE
        );
    ''')

    # Add custom_fields column if it doesn't exist (for existing databases)
    try:
        db.execute('ALTER TABLE castings ADD COLUMN custom_fields TEXT DEFAULT "{}"')
    except:
        pass

    # Add missing columns to team_members for existing databases
    for col_def in [
        'ALTER TABLE team_members ADD COLUMN email TEXT',
        'ALTER TABLE team_members ADD COLUMN phone TEXT',
        'ALTER TABLE team_members ADD COLUMN avatar_url TEXT',
    ]:
        try:
            db.execute(col_def)
        except:
            pass

    # Add clients table if it doesn't exist (for existing databases)
    try:
        db.execute('''
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT,
                contact TEXT,
                email TEXT,
                phone TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    except:
        pass

    # Attachment storage table for casting communication files
    db.execute('''
        CREATE TABLE IF NOT EXISTS casting_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            casting_id INTEGER NOT NULL,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            mime_type TEXT,
            file_size INTEGER DEFAULT 0,
            file_ext TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE
        )
    ''')

    # Seed team members if empty
    cursor = db.execute('SELECT COUNT(*) FROM team_members')
    if cursor.fetchone()[0] == 0:
        team_members = [
            ('Sangeeta S Bhatia', 'Team Member'),
            ('Toaney Bhatia', 'Founder'),
            ('Aryan Dhawan', 'Team Member'),
            ('Anvitha Dogra', 'Team Member'),
            ('Khadija Mithaiwala', 'Team Member'),
            ('Prashant Shreshta', 'Team Member'),
            ('Jhalak', 'Team Member'),
            ('Saloni Pomal', 'Team Member'),
            ('Saloni Kale', 'Team Member'),
        ]
        db.executemany('INSERT INTO team_members (name, role) VALUES (?, ?)', team_members)

    # Create settings tables if they don't exist
    db.execute('''
        CREATE TABLE IF NOT EXISTS settings_pipeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            sort_order INTEGER DEFAULT 0
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS settings_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    ''')

    # Seed pipeline stages if empty
    cursor = db.execute('SELECT COUNT(*) FROM settings_pipeline')
    if cursor.fetchone()[0] == 0:
        default_stages = [
            ('NEW', '#6366f1', 0),
            ('SOURCING', '#f59e0b', 1),
            ('SHORTLISTED', '#3b82f6', 2),
            ('INTERVIEW', '#8b5cf6', 3),
            ('OFFERED', '#10b981', 4),
            ('WON', '#22c55e', 5),
            ('LOST', '#ef4444', 6),
        ]
        db.executemany('INSERT INTO settings_pipeline (name, color, sort_order) VALUES (?, ?, ?)', default_stages)

    # Seed sources if empty
    cursor = db.execute('SELECT COUNT(*) FROM settings_sources')
    if cursor.fetchone()[0] == 0:
        default_sources = [
            ('Email',),
            ('WhatsApp',),
            ('Instagram',),
            ('Referral',),
            ('Direct Call',),
            ('Social Media',),
            ('Website',),
        ]
        db.executemany('INSERT INTO settings_sources (name) VALUES (?)', default_sources)

    db.commit()

# ==================== ACTIVITIES ROUTES ====================

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'ok': True}), 200


@app.route('/api/activities', methods=['GET'])
def list_activities():
    db = get_db()
    casting_id = request.args.get('casting_id')

    query = '''
        SELECT a.id, a.casting_id, a.action, a.details as description,
               COALESCE(tm.name, a.details) as user_name, a.timestamp as created_at
        FROM activities a
        LEFT JOIN team_members tm ON a.team_member_id = tm.id
    '''

    conditions = []
    params = []

    if casting_id:
        conditions.append('a.casting_id = ?')
        params.append(int(casting_id))

    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)

    query += ' ORDER BY a.timestamp DESC'

    rows = db.execute(query, params).fetchall()
    return jsonify({'activities': [_activity_row_to_dict(row) for row in rows]})

def _extract_mentions(text):
    if not text:
        return []
    return list(dict.fromkeys(re.findall(r'@([A-Za-z0-9_.-]+)', text)))


def _parse_note_details(raw_details, fallback_user='Admin'):
    if not raw_details:
        return {
            'text': '',
            'user_name': fallback_user,
            'parent_id': None,
            'mentions': [],
        }

    if isinstance(raw_details, str):
        try:
            payload = json.loads(raw_details)
            if isinstance(payload, dict) and 'text' in payload:
                text = payload.get('text') or ''
                user_name = payload.get('user_name') or fallback_user
                parent_id = payload.get('parent_id')
                mentions = payload.get('mentions') or _extract_mentions(text)
                return {
                    'text': text,
                    'user_name': user_name,
                    'parent_id': parent_id,
                    'mentions': mentions if isinstance(mentions, list) else _extract_mentions(text),
                }
        except Exception:
            pass

    text = raw_details if isinstance(raw_details, str) else str(raw_details)
    return {
        'text': text,
        'user_name': fallback_user,
        'parent_id': None,
        'mentions': _extract_mentions(text),
    }


def _serialize_note_details(text, user_name, parent_id=None, mentions=None):
    payload = {
        'text': text,
        'user_name': user_name or 'Admin',
        'parent_id': parent_id,
        'mentions': mentions if isinstance(mentions, list) else _extract_mentions(text),
    }
    return json.dumps(payload)


def _activity_row_to_dict(row):
    item = dict(row)
    if item.get('action') == 'NOTE':
        parsed = _parse_note_details(item.get('details'), item.get('user_name') or item.get('team_member_name') or 'Admin')
        item['details'] = parsed['text']
        item['description'] = parsed['text']
        item['user_name'] = parsed['user_name']
        item['parent_id'] = parsed['parent_id']
        item['mentions'] = parsed['mentions']
    return item


@app.route('/api/comments/<int:casting_id>', methods=['GET'])
def get_comments(casting_id):
    db = get_db()
    rows = db.execute('''
        SELECT a.id, a.casting_id, a.details, a.timestamp as created_at,
               COALESCE(tm.name, 'Admin') as default_user_name
        FROM activities a
        LEFT JOIN team_members tm ON a.team_member_id = tm.id
        WHERE a.casting_id = ? AND a.action = 'NOTE'
        ORDER BY a.timestamp ASC
    ''', (casting_id,)).fetchall()

    comments = []
    for row in rows:
        parsed = _parse_note_details(row['details'], row['default_user_name'])
        comments.append({
            'id': row['id'],
            'casting_id': row['casting_id'],
            'text': parsed['text'],
            'user_name': parsed['user_name'],
            'parent_id': parsed['parent_id'],
            'mentions': parsed['mentions'],
            'created_at': row['created_at'],
        })

    return jsonify(comments)

@app.route('/api/comments', methods=['POST'])
def add_comment():
    db = get_db()
    data = request.json or {}

    casting_id = data.get('casting_id')
    text = (data.get('text') or '').strip()
    user_name = (data.get('user_name') or 'Admin').strip() or 'Admin'
    parent_id = data.get('parent_id')
    mentions = data.get('mentions')

    if not casting_id or not text:
        return jsonify({'error': 'casting_id and text are required'}), 400

    serialized = _serialize_note_details(text, user_name, parent_id, mentions)

    cursor = db.execute('''
        INSERT INTO activities (casting_id, action, details)
        VALUES (?, 'NOTE', ?)
    ''', (casting_id, serialized))
    db.commit()

    return jsonify({
        'id': cursor.lastrowid,
        'casting_id': casting_id,
        'text': text,
        'user_name': user_name,
        'parent_id': parent_id,
        'mentions': mentions if isinstance(mentions, list) else _extract_mentions(text),
        'created_at': datetime.now().isoformat()
    }), 201

# ==================== ROLES SETTINGS ====================

@app.route('/api/settings/roles', methods=['GET'])
def get_roles():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'roles.json')) as f:
            return jsonify(json.load(f))
    except:
        # Default roles
        return jsonify({
            'roles': [
                {'id': 1, 'name': 'Admin', 'permissions': [
                    'castings_view', 'castings_edit', 'castings_delete',
                    'clients_view', 'clients_edit',
                    'team_view', 'team_manage',
                    'settings_access',
                    'reports_view', 'reports_export'
                ]},
                {'id': 2, 'name': 'Booker', 'permissions': [
                    'castings_view', 'castings_edit',
                    'clients_view', 'clients_edit',
                    'team_view',
                    'reports_view'
                ]},
                {'id': 3, 'name': 'Viewer', 'permissions': [
                    'castings_view',
                    'clients_view',
                    'team_view',
                    'reports_view'
                ]}
            ]
        })

@app.route('/api/settings/roles', methods=['PUT'])
def update_roles():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'roles.json'), 'w') as f:
        json.dump(data, f)
    return jsonify(data)

# ==================== CASTING ROUTES ====================

@app.route('/api/castings', methods=['GET', 'POST'])
def list_castings():
    db = get_db()
    if request.method == 'POST':
        data = request.json

        # Handle assignment
        assigned_members = data.pop('assigned_to', [])

        cursor = db.execute('''
            INSERT INTO castings (
                source, source_detail, client_name, client_company, client_contact,
                project_name, project_type, shoot_date_start, shoot_date_end,
                location, medium, usage, budget_min, budget_max, requirements,
                apply_to, status, priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('source', 'manual'),
            data.get('source_detail'),
            data.get('client_name'),
            data.get('client_company'),
            data.get('client_contact'),
            data.get('project_name'),
            data.get('project_type'),
            data.get('shoot_date_start'),
            data.get('shoot_date_end'),
            data.get('location'),
            data.get('medium'),
            data.get('usage'),
            data.get('budget_min'),
            data.get('budget_max'),
            data.get('requirements'),
            data.get('apply_to'),
            data.get('status', 'NEW'),
            data.get('priority', 'NORMAL'),
        ))
        casting_id = cursor.lastrowid

        # Assign team members
        for member_id in assigned_members:
            db.execute('INSERT INTO casting_assignments (casting_id, team_member_id) VALUES (?, ?)',
                      (casting_id, member_id))

        # Log activity
        db.execute('''
            INSERT INTO activities (casting_id, action, details)
            VALUES (?, 'CREATED', ?)
        ''', (casting_id, f"Casting created: {data.get('project_name', 'Untitled')}"))

        db.commit()
        return jsonify({'id': casting_id, 'message': 'Casting created'}), 201

    # GET - list with filters
    query = '''
        SELECT c.*, GROUP_CONCAT(ca.team_member_id) as assigned_ids,
               GROUP_CONCAT(tm.name) as assigned_names
        FROM castings c
        LEFT JOIN casting_assignments ca ON c.id = ca.casting_id
        LEFT JOIN team_members tm ON ca.team_member_id = tm.id
    '''

    conditions = []
    params = []

    status = request.args.get('status')
    if status:
        conditions.append('c.status = ?')
        params.append(status)

    source = request.args.get('source')
    if source:
        conditions.append('c.source = ?')
        params.append(source)

    team_member_id = request.args.get('team_member_id')
    if team_member_id:
        conditions.append('ca.team_member_id = ?')
        params.append(int(team_member_id))

    search = request.args.get('search')
    if search:
        conditions.append('(c.client_name LIKE ? OR c.project_name LIKE ?)')
        params.extend([f'%{search}%', f'%{search}%'])

    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)

    query += ' GROUP BY c.id ORDER BY c.created_at DESC'

    rows = db.execute(query, params).fetchall()
    castings = []
    for row in rows:
        casting = dict(row)
        if casting['assigned_ids']:
            casting['assigned_to'] = [
                {'id': int(id), 'name': name}
                for id, name in zip(casting['assigned_ids'].split(','), casting['assigned_names'].split(','))
            ]
        else:
            casting['assigned_to'] = []
        castings.append(casting)

    return jsonify(castings)

@app.route('/api/castings/<int:casting_id>', methods=['GET', 'PUT', 'DELETE'])
def single_casting(casting_id):
    db = get_db()

    if request.method == 'GET':
        row = db.execute('''
            SELECT c.*, GROUP_CONCAT(ca.team_member_id) as assigned_ids,
                   GROUP_CONCAT(tm.name) as assigned_names
            FROM castings c
            LEFT JOIN casting_assignments ca ON c.id = ca.casting_id
            LEFT JOIN team_members tm ON ca.team_member_id = tm.id
            WHERE c.id = ?
            GROUP BY c.id
        ''', (casting_id,)).fetchone()

        if not row:
            return jsonify({'error': 'Not found'}), 404

        casting = dict(row)
        if casting['assigned_ids']:
            casting['assigned_to'] = [
                {'id': int(id), 'name': name}
                for id, name in zip(casting['assigned_ids'].split(','), casting['assigned_names'].split(','))
            ]
        else:
            casting['assigned_to'] = []

        return jsonify(casting)

    elif request.method == 'PUT':
        data = request.json
        fields = []
        values = []

        for field in ['source', 'source_detail', 'client_name', 'client_company', 'client_contact',
                      'project_name', 'project_type', 'shoot_date_start', 'shoot_date_end',
                      'location', 'medium', 'usage', 'budget_min', 'budget_max',
                      'requirements', 'apply_to', 'status', 'priority']:
            if field in data:
                fields.append(f'{field} = ?')
                values.append(data[field])

        fields.append('updated_at = datetime("now")')
        values.append(casting_id)

        db.execute(f'UPDATE castings SET {", ".join(fields)} WHERE id = ?', values)

        # Handle team assignment if provided
        if 'assigned_to' in data:
            db.execute('DELETE FROM casting_assignments WHERE casting_id = ?', (casting_id,))
            for member_id in data['assigned_to']:
                db.execute('INSERT INTO casting_assignments (casting_id, team_member_id) VALUES (?, ?)',
                          (casting_id, member_id))
            db.execute('''
                INSERT INTO activities (casting_id, action, details)
                VALUES (?, 'REASSIGNED', ?)
            ''', (casting_id, f"Team reassigned"))

        db.commit()
        return jsonify({'message': 'Updated'})

    elif request.method == 'DELETE':
        attachments = db.execute(
            'SELECT stored_filename, file_ext FROM casting_attachments WHERE casting_id = ?',
            (casting_id,)
        ).fetchall()
        for attachment in attachments:
            stored_filename = attachment['stored_filename']
            file_ext = attachment['file_ext'] or ''
            filepath = os.path.join(_attachment_storage_dir(casting_id), stored_filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except:
                    pass
            if file_ext:
                # Best-effort cleanup for any leftover renamed variants.
                alt_path = os.path.join(_attachment_storage_dir(casting_id), f'{stored_filename}.{file_ext}')
                if os.path.exists(alt_path):
                    try:
                        os.remove(alt_path)
                    except:
                        pass
        db.execute('DELETE FROM casting_attachments WHERE casting_id = ?', (casting_id,))
        db.execute('DELETE FROM castings WHERE id = ?', (casting_id,))
        db.commit()
        return jsonify({'message': 'Deleted'})

@app.route('/api/castings/<int:casting_id>/status', methods=['PUT'])
def update_status(casting_id):
    db = get_db()
    data = request.json
    new_status = data.get('status')

    old_row = db.execute('SELECT status FROM castings WHERE id = ?', (casting_id,)).fetchone()
    if not old_row:
        return jsonify({'error': 'Not found'}), 404

    db.execute('UPDATE castings SET status = ?, updated_at = datetime("now") WHERE id = ?',
              (new_status, casting_id))

    db.execute('''
        INSERT INTO activities (casting_id, action, details)
        VALUES (?, 'STATUS_CHANGE', ?)
    ''', (casting_id, f"Status changed from {old_row['status']} to {new_status}"))

    db.commit()
    return jsonify({'message': 'Status updated'})

@app.route('/api/castings/<int:casting_id>/assign', methods=['PUT'])
def assign_casting(casting_id):
    db = get_db()
    data = request.json
    team_member_ids = data.get('team_member_ids', [])

    db.execute('DELETE FROM casting_assignments WHERE casting_id = ?', (casting_id,))

    names = []
    for member_id in team_member_ids:
        db.execute('INSERT INTO casting_assignments (casting_id, team_member_id) VALUES (?, ?)',
                  (casting_id, member_id))
        member = db.execute('SELECT name FROM team_members WHERE id = ?', (member_id,)).fetchone()
        if member:
            names.append(member['name'])

    db.execute('''
        INSERT INTO activities (casting_id, action, details)
        VALUES (?, 'ASSIGNED', ?)
    ''', (casting_id, f"Assigned to: {', '.join(names)}"))

    db.commit()
    return jsonify({'message': 'Assigned'})

@app.route('/api/castings/<int:casting_id>/activities', methods=['GET'])
def get_activities(casting_id):
    db = get_db()
    rows = db.execute('''
        SELECT a.*, tm.name as team_member_name
        FROM activities a
        LEFT JOIN team_members tm ON a.team_member_id = tm.id
        WHERE a.casting_id = ?
        ORDER BY a.timestamp DESC
    ''', (casting_id,)).fetchall()

    return jsonify([_activity_row_to_dict(row) for row in rows])

@app.route('/api/castings/<int:casting_id>/notes', methods=['POST'])
def add_note(casting_id):
    db = get_db()
    data = request.json

    db.execute('''
        INSERT INTO activities (casting_id, team_member_id, action, details)
        VALUES (?, ?, 'NOTE', ?)
    ''', (casting_id, data.get('team_member_id'), data.get('note')))

    db.commit()
    return jsonify({'message': 'Note added'})


@app.route('/api/castings/<int:casting_id>/attachments', methods=['GET'])
def list_casting_attachments(casting_id):
    db = get_db()
    casting = db.execute('SELECT id FROM castings WHERE id = ?', (casting_id,)).fetchone()
    if not casting:
        return jsonify({'error': 'Not found'}), 404

    rows = db.execute('''
        SELECT id, casting_id, original_filename, stored_filename, mime_type,
               file_size, file_ext, created_at
        FROM casting_attachments
        WHERE casting_id = ?
        ORDER BY created_at DESC, id DESC
    ''', (casting_id,)).fetchall()

    attachments = []
    for row in rows:
        item = dict(row)
        item['url'] = _attachment_public_url(item['id'])
        attachments.append(item)

    return jsonify({'attachments': attachments})


@app.route('/api/castings/<int:casting_id>/attachments', methods=['POST'])
def upload_casting_attachment(casting_id):
    db = get_db()
    casting = db.execute('SELECT id FROM castings WHERE id = ?', (casting_id,)).fetchone()
    if not casting:
        return jsonify({'error': 'Not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    allowed, ext, error = _is_allowed_attachment(file)
    if not allowed:
        return jsonify({'error': error}), 400

    upload_dir = _attachment_storage_dir(casting_id)
    existing_count = db.execute(
        'SELECT COUNT(*) as cnt FROM casting_attachments WHERE casting_id = ?',
        (casting_id,)
    ).fetchone()['cnt']
    created_stamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    stored_filename = f'attachment_{casting_id}_{created_stamp}_{existing_count + 1}.{ext}'
    filepath = os.path.join(upload_dir, stored_filename)
    file.save(filepath)

    file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
    mime_type = file.mimetype or mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'

    cursor = db.execute('''
        INSERT INTO casting_attachments (
            casting_id, original_filename, stored_filename, mime_type, file_size, file_ext
        ) VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        casting_id,
        file.filename,
        stored_filename,
        mime_type,
        file_size,
        ext,
    ))
    db.commit()

    attachment = db.execute('''
        SELECT id, casting_id, original_filename, stored_filename, mime_type,
               file_size, file_ext, created_at
        FROM casting_attachments
        WHERE id = ?
    ''', (cursor.lastrowid,)).fetchone()

    result = dict(attachment)
    result['url'] = _attachment_public_url(result['id'])
    return jsonify(result), 201


@app.route('/api/attachments/<int:attachment_id>', methods=['GET'])
def serve_casting_attachment(attachment_id):
    db = get_db()
    attachment = db.execute('''
        SELECT id, casting_id, original_filename, stored_filename, file_ext
        FROM casting_attachments
        WHERE id = ?
    ''', (attachment_id,)).fetchone()
    if not attachment:
        return jsonify({'error': 'Not found'}), 404

    filepath = os.path.join(
        _attachment_storage_dir(attachment['casting_id']),
        attachment['stored_filename']
    )
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404

    return send_file(filepath, download_name=attachment['original_filename'])

# ==================== TEAM ROUTES ====================

@app.route('/api/team', methods=['GET', 'POST'])
def list_team():
    db = get_db()

    if request.method == 'POST':
        data = request.json
        name = data.get('name', '').strip()
        role = data.get('role', 'Team Member').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()
        avatar_url = data.get('avatar_url', '').strip()

        if not name:
            return jsonify({'error': 'Name is required'}), 400

        cursor = db.execute(
            'INSERT INTO team_members (name, role, email, phone, avatar_url, is_active) VALUES (?, ?, ?, ?, ?, 1)',
            (name, role, email or None, phone or None, avatar_url or None)
        )
        db.commit()

        member = db.execute('SELECT * FROM team_members WHERE id = ?', (cursor.lastrowid,)).fetchone()
        return jsonify(dict(member)), 201

    rows = db.execute('SELECT * FROM team_members ORDER BY name').fetchall()
    team = []
    for row in rows:
        member = dict(row)
        # Count active castings for this member
        count = db.execute('''
            SELECT COUNT(*) as cnt FROM casting_assignments ca
            JOIN castings c ON ca.casting_id = c.id
            WHERE ca.team_member_id = ? AND c.status NOT IN ('WON', 'LOST', 'INVOICED', 'PAID')
        ''', (member['id'],)).fetchone()
        member['active_castings_count'] = count['cnt'] if count else 0
        team.append(member)

    return jsonify(team)

@app.route('/api/team/<int:member_id>', methods=['GET', 'PUT', 'DELETE'])
def single_team_member(member_id):
    db = get_db()

    if request.method == 'DELETE':
        db.execute('DELETE FROM team_members WHERE id = ?', (member_id,))
        db.commit()
        return jsonify({'message': 'Deleted'})

    elif request.method == 'PUT':
        data = request.json
        
        name = data.get('name')
        role = data.get('role')
        is_active = data.get('is_active')
        email = data.get('email')
        phone = data.get('phone')
        avatar_url = data.get('avatar_url')
        
        updates = []
        params = []
        if name is not None:
            updates.append('name = ?')
            params.append(name)
        if role is not None:
            updates.append('role = ?')
            params.append(role)
        if is_active is not None:
            updates.append('is_active = ?')
            params.append(is_active)
        if email is not None:
            updates.append('email = ?')
            params.append(email or None)
        if phone is not None:
            updates.append('phone = ?')
            params.append(phone or None)
        if avatar_url is not None:
            updates.append('avatar_url = ?')
            params.append(avatar_url or None)

        if not updates:
            return jsonify({'error': 'No fields to update'}), 400

        params.append(member_id)
        db.execute(f'UPDATE team_members SET {", ".join(updates)} WHERE id = ?', params)
        db.commit()

        member = db.execute('SELECT * FROM team_members WHERE id = ?', (member_id,)).fetchone()
        return jsonify(dict(member))

    row = db.execute('SELECT * FROM team_members WHERE id = ?', (member_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404

    # Get assigned castings
    castings = db.execute('''
        SELECT c.* FROM castings c
        JOIN casting_assignments ca ON c.id = ca.casting_id
        WHERE ca.team_member_id = ?
        ORDER BY c.created_at DESC
    ''', (member_id,)).fetchall()

    member = dict(row)
    member['castings'] = [dict(c) for c in castings]
    return jsonify(member)

# ==================== TEAM MEMBER UPLOAD ====================
@app.route('/api/team/<int:member_id>/avatar', methods=['POST'])
def upload_team_avatar(member_id):
    """Upload a profile picture for a team member."""
    db = get_db()
    member = db.execute('SELECT id FROM team_members WHERE id = ?', (member_id,)).fetchone()
    if not member:
        return jsonify({'error': 'Team member not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    # Validate file type
    allowed = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed:
        return jsonify({'error': f'File type not allowed. Use: {", ".join(allowed)}'}), 400

    # Save to uploads directory
    upload_dir = os.path.join(UPLOADS_DIR, 'avatars')
    os.makedirs(upload_dir, exist_ok=True)

    # Use a safe filename: avatar_{member_id}.{ext}
    filename = f'avatar_{member_id}.{ext}'
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    # Store relative URL
    avatar_url = f'/api/team/{member_id}/avatar'
    db.execute('UPDATE team_members SET avatar_url = ? WHERE id = ?', (avatar_url, member_id))
    db.commit()

    return jsonify({'avatar_url': avatar_url}), 200

@app.route('/api/team/<int:member_id>/avatar')
def serve_team_avatar(member_id):
    """Serve the uploaded avatar image."""
    upload_dir = os.path.join(UPLOADS_DIR, 'avatars')
    for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
        filepath = os.path.join(upload_dir, f'avatar_{member_id}.{ext}')
        if os.path.exists(filepath):
            return send_file(filepath)
    return jsonify({'error': 'Avatar not found'}), 404

# ==================== CLIENTS ROUTES ====================

@app.route('/api/clients', methods=['GET'])
def get_clients():
    db = get_db()
    clients = db.execute('SELECT * FROM clients ORDER BY name').fetchall()
    return jsonify([dict(c) for c in clients])

@app.route('/api/clients', methods=['POST'])
def create_client():
    data = request.json
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Client name is required'}), 400

    db = get_db()
    cursor = db.execute(
        'INSERT INTO clients (name, company, contact, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?)',
        (name, data.get('company'), data.get('contact'), data.get('email'), data.get('phone'), data.get('notes'))
    )
    db.commit()

    client = db.execute('SELECT * FROM clients WHERE id = ?', (cursor.lastrowid,)).fetchone()
    return jsonify(dict(client)), 201

@app.route('/api/clients/<int:client_id>', methods=['PUT'])
def update_client(client_id):
    data = request.json
    db = get_db()

    name = data.get('name')
    company = data.get('company')
    contact = data.get('contact')
    email = data.get('email')
    phone = data.get('phone')
    notes = data.get('notes')

    db.execute(
        'UPDATE clients SET name=?, company=?, contact=?, email=?, phone=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        (name, company, contact, email, phone, notes, client_id)
    )
    db.commit()

    client = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    return jsonify(dict(client))

@app.route('/api/clients/<int:client_id>', methods=['DELETE'])
def delete_client(client_id):
    db = get_db()
    db.execute('DELETE FROM clients WHERE id = ?', (client_id,))
    db.commit()
    return jsonify({'message': 'Client deleted'})

# ==================== DASHBOARD ROUTES ====================

@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    db = get_db()

    # Total, active, and closed casting counts
    total_castings = db.execute('SELECT COUNT(*) as cnt FROM castings').fetchone()['cnt']

    active_statuses = ('NEW', 'REVIEWING', 'PROPOSED', 'NEGOTIATING', 'CONFIRMED', 'IN_PROGRESS')
    closed_statuses = ('WON', 'LOST', 'INVOICED', 'PAID', 'COMPLETED', 'DECLINED')

    active_castings = db.execute(
        'SELECT COUNT(*) as cnt FROM castings WHERE status IN (?, ?, ?, ?, ?, ?)',
        active_statuses
    ).fetchone()['cnt']

    closed_castings = db.execute(
        'SELECT COUNT(*) as cnt FROM castings WHERE status IN (?, ?, ?, ?, ?, ?)',
        closed_statuses
    ).fetchone()['cnt']

    # Pipeline counts
    pipeline = db.execute('''
        SELECT status as status, COUNT(*) as count
        FROM castings
        GROUP BY status
    ''').fetchall()

    # Team workload
    workload = db.execute('''
        SELECT tm.id, tm.name, COUNT(ca.casting_id) as count
        FROM team_members tm
        LEFT JOIN casting_assignments ca ON tm.id = ca.team_member_id
        LEFT JOIN castings c ON ca.casting_id = c.id AND c.status NOT IN ('WON', 'LOST', 'INVOICED', 'PAID')
        WHERE tm.is_active = 1
        GROUP BY tm.id
    ''').fetchall()

    # Recent activity
    recent = db.execute('''
        SELECT a.id, a.casting_id, a.action, a.details as description,
               COALESCE(tm.name, a.details) as user_name, a.timestamp as created_at
        FROM activities a
        LEFT JOIN team_members tm ON a.team_member_id = tm.id
        ORDER BY a.timestamp DESC
        LIMIT 10
    ''').fetchall()

    # Source breakdown
    sources = db.execute('''
        SELECT source, COUNT(*) as count
        FROM castings
        GROUP BY source
    ''').fetchall()

    # Total revenue (sum of budget_max where status indicates won/paid)
    revenue_row = db.execute('''
        SELECT COALESCE(SUM(budget_max), 0) as total
        FROM castings
        WHERE status IN ('WON', 'INVOICED', 'PAID')
    ''').fetchone()
    total_revenue = revenue_row['total'] if revenue_row else 0

    # Total clients (unique client names)
    clients_row = db.execute('''
        SELECT COUNT(DISTINCT client_name) as total
        FROM castings
        WHERE client_name IS NOT NULL AND client_name != ''
    ''').fetchone()
    total_clients = clients_row['total'] if clients_row else 0

    # Monthly trend (last 6 months of castings created)
    from datetime import datetime, timedelta
    months = []
    now = datetime.now()
    for i in range(5, -1, -1):
        # Calculate month start and end
        month_start = datetime(now.year, now.month, 1) - timedelta(days=30 * i)
        if month_start.month == 12:
            month_end = datetime(month_start.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = datetime(month_start.year, month_start.month + 1, 1) - timedelta(days=1)

        month_name = month_start.strftime('%b')

        count_row = db.execute('''
            SELECT COUNT(*) as cnt FROM castings
            WHERE created_at >= ? AND created_at <= ?
        ''', (month_start.isoformat(), month_end.isoformat())).fetchone()

        months.append({
            'month': month_name,
            'count': count_row['cnt'] if count_row else 0
        })

    return jsonify({
        'total_castings': total_castings,
        'active_castings': active_castings,
        'closed_castings': closed_castings,
        'pipeline': [dict(p) for p in pipeline],
        'workload': [dict(w) for w in workload],
        'recent_activity': [dict(a) for a in recent],
        'sources': [dict(s) for s in sources],
        'total_revenue': total_revenue,
        'total_clients': total_clients,
        'trend': months
    })

# ==================== MESSAGE PARSER ====================

@app.route('/api/parse', methods=['POST'])
def parse_message():
    import sys
    import os
    sys.path.insert(0, os.path.dirname(__file__))
    from utils.parser import parse_casting_message
    data = request.json
    raw_text = data.get('text', '')

    parsed = parse_casting_message(raw_text)
    return jsonify(parsed)

# ==================== SETTINGS ROUTES ====================

# Password verification
@app.route('/api/auth/verify-password', methods=['POST'])
def verify_password():
    data = request.json
    correct = os.getenv('ADMIN_PASSWORD', 'toabh2026')
    return jsonify({'valid': data.get('password') == correct})

# Pipeline stages
@app.route('/api/settings/pipeline', methods=['GET'])
def get_pipeline():
    db = get_db()
    rows = db.execute('SELECT id, name, color FROM settings_pipeline ORDER BY sort_order, id').fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/settings/pipeline', methods=['POST'])
def create_pipeline():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    color = data.get('color') or '#6366f1'
    if not name:
        return jsonify({'error': 'name required'}), 400
    db = get_db()
    # Duplicate check
    existing = db.execute(
        'SELECT id FROM settings_pipeline WHERE LOWER(name)=LOWER(?)', (name,)
    ).fetchone()
    if existing:
        return jsonify({'error': f'A stage named "{name}" already exists'}), 409
    # Get max sort_order
    max_order = db.execute('SELECT MAX(sort_order) FROM settings_pipeline').fetchone()[0] or 0
    cursor = db.execute(
        'INSERT INTO settings_pipeline (name, color, sort_order) VALUES (?, ?, ?)',
        (name, color, max_order + 1)
    )
    db.commit()
    return jsonify({'id': cursor.lastrowid, 'name': name, 'color': color})

@app.route('/api/settings/pipeline/<int:item_id>', methods=['PUT'])
def update_pipeline_item(item_id):
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    color = data.get('color') or '#6366f1'
    if not name:
        return jsonify({'error': 'name required'}), 400
    db = get_db()
    # Duplicate check (excluding current item)
    existing = db.execute(
        'SELECT id FROM settings_pipeline WHERE LOWER(name)=LOWER(?) AND id!=?',
        (name, item_id)
    ).fetchone()
    if existing:
        return jsonify({'error': f'A stage named "{name}" already exists'}), 409
    db.execute('UPDATE settings_pipeline SET name=?, color=? WHERE id=?', (name, color, item_id))
    db.commit()
    return jsonify({'id': item_id, 'name': name, 'color': color})

@app.route('/api/settings/pipeline/<int:item_id>', methods=['DELETE'])
def delete_pipeline_item(item_id):
    db = get_db()
    # Minimum guard: prevent deleting last stage
    count = db.execute('SELECT COUNT(*) as cnt FROM settings_pipeline').fetchone()['cnt']
    if count <= 1:
        return jsonify({'error': 'Cannot delete the last pipeline stage. At least one stage is required.'}), 400
    db.execute('DELETE FROM settings_pipeline WHERE id=?', (item_id,))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/settings/pipeline/reorder', methods=['PUT'])
def reorder_pipeline():
    data = request.get_json()
    stages = data.get('stages', [])
    db = get_db()
    for s in stages:
        db.execute('UPDATE settings_pipeline SET sort_order=? WHERE id=?',
                   (s.get('sort_order', 0), s['id']))
    db.commit()
    return jsonify({'success': True})

# Lead sources
@app.route('/api/settings/sources', methods=['GET'])
def get_sources():
    db = get_db()
    rows = db.execute('SELECT id, name FROM settings_sources ORDER BY id').fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/settings/sources', methods=['POST'])
def create_source():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name required'}), 400
    db = get_db()
    # Duplicate check
    existing = db.execute(
        'SELECT id FROM settings_sources WHERE LOWER(name)=LOWER(?)', (name,)
    ).fetchone()
    if existing:
        return jsonify({'error': f'A lead source named "{name}" already exists'}), 409
    cursor = db.execute('INSERT INTO settings_sources (name) VALUES (?)', (name,))
    db.commit()
    return jsonify({'id': cursor.lastrowid, 'name': name})

@app.route('/api/settings/sources/<int:item_id>', methods=['PUT'])
def update_source_item(item_id):
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name required'}), 400
    db = get_db()
    # Duplicate check (excluding current item)
    existing = db.execute(
        'SELECT id FROM settings_sources WHERE LOWER(name)=LOWER(?) AND id!=?',
        (name, item_id)
    ).fetchone()
    if existing:
        return jsonify({'error': f'A lead source named "{name}" already exists'}), 409
    db.execute('UPDATE settings_sources SET name=? WHERE id=?', (name, item_id))
    db.commit()
    return jsonify({'id': item_id, 'name': name})

@app.route('/api/settings/sources/<int:item_id>', methods=['DELETE'])
def delete_source_item(item_id):
    db = get_db()
    # Minimum guard: prevent deleting last source
    count = db.execute('SELECT COUNT(*) as cnt FROM settings_sources').fetchone()['cnt']
    if count <= 1:
        return jsonify({'error': 'Cannot delete the last lead source. At least one source is required.'}), 400
    db.execute('DELETE FROM settings_sources WHERE id=?', (item_id,))
    db.commit()
    return jsonify({'success': True})

# Custom fields
@app.route('/api/settings/custom-fields', methods=['GET'])
def get_custom_fields():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'custom_fields.json')) as f:
            return jsonify(json.load(f))
    except:
        return jsonify([
            {'id':'cf1','name':'Talent Age Range','type':'text','tab':'Project Info','required':False},
            {'id':'cf2','name':'Languages Known','type':'text','tab':'Project Info','required':False},
            {'id':'cf3','name':'Required Equipment Type','type':'dropdown','options':['Yes','No'],'tab':'Project Info','required':False},
        ])

@app.route('/api/settings/custom-fields', methods=['PUT'])
def update_custom_fields():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'custom_fields.json'), 'w') as f:
        json.dump(data['fields'], f)
    return jsonify(data['fields'])

@app.route('/api/settings/custom-fields', methods=['POST'])
def create_custom_field():
    field_data = request.get_json()
    if not field_data:
        return jsonify({'error': 'No data'}), 400
    name = (field_data.get('name') or '').strip()
    field_type = field_data.get('type', 'text')
    tab = field_data.get('tab', 'Custom')
    options = field_data.get('options', [])
    required = field_data.get('required', False)
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if field_type == 'dropdown' and not options:
        return jsonify({'error': 'Dropdown fields need at least one option'}), 400
    # Load existing fields
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'custom_fields.json')) as f:
            fields = json.load(f)
    except:
        fields = []
    # Generate new id
    existing_ids = [f.get('id', '') for f in fields]
    nums = [int(f.replace('cf', '')) for f in existing_ids if f.startswith('cf') and f[2:].isdigit()]
    new_id = f"cf{(max(nums) + 1) if nums else 1:03d}"
    new_field = {
        'id': new_id,
        'name': name,
        'type': field_type,
        'tab': tab,
        'options': options,
        'required': required
    }
    fields.append(new_field)
    with open(os.path.join(SETTINGS_DIR, 'custom_fields.json'), 'w') as f:
        json.dump(fields, f)
    return jsonify(new_field), 201

# Dashboard modules toggle
@app.route('/api/settings/dashboard-modules', methods=['GET'])
def get_dashboard_modules():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'dashboard_modules.json')) as f:
            return jsonify(json.load(f))
    except:
        return jsonify({'kanban':True,'calendar':True,'activityFeed':True,'quickActions':True,'charts':True})

@app.route('/api/settings/dashboard-modules', methods=['PUT'])
def update_dashboard_modules():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    # Store the full object (includes default_view + module flags)
    with open(os.path.join(SETTINGS_DIR, 'dashboard_modules.json'), 'w') as f:
        json.dump(data, f)
    return jsonify(data)

# Workflow automation settings (Phase 5 ready foundation)
@app.route('/api/settings/automation-rules', methods=['GET'])
def get_automation_rules():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    default_rules = {
        'rules': [
            {
                'id': 'note_mention',
                'label': 'Note mentions',
                'description': 'Prepare alerts when a teammate is mentioned in an internal note.',
                'channels': ['in_app', 'email'],
                'enabled': True,
            },
            {
                'id': 'attachment_uploaded',
                'label': 'Attachment uploaded',
                'description': 'Queue notifications when a new brief, deck, or document is added.',
                'channels': ['in_app'],
                'enabled': True,
            },
            {
                'id': 'status_changed',
                'label': 'Status changed',
                'description': 'Keep the team informed when a casting moves across the pipeline.',
                'channels': ['in_app', 'email'],
                'enabled': True,
            },
            {
                'id': 'assignment_changed',
                'label': 'Assignment changed',
                'description': 'Trigger future handoff alerts when owners are updated.',
                'channels': ['in_app', 'email'],
                'enabled': True,
            },
        ]
    }
    try:
        with open(os.path.join(SETTINGS_DIR, 'automation_rules.json')) as f:
            return jsonify(json.load(f))
    except:
        return jsonify(default_rules)

@app.route('/api/settings/automation-rules', methods=['PUT'])
def update_automation_rules():
    data = request.json or {}
    payload = {'rules': data.get('rules', [])}
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'automation_rules.json'), 'w') as f:
        json.dump(payload, f)
    return jsonify({'message': 'Automation rules saved', 'rules': payload['rules']})

# Email config (store SMTP settings - basic)
@app.route('/api/settings/email-config', methods=['GET'])
def get_email_config():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'email_config.json')) as f:
            return jsonify(json.load(f))
    except:
        return jsonify({'from_email':'noreply@toabh.com','from_name':'TOABH Casting','smtp_host':'','smtp_port':587})

@app.route('/api/settings/email-config', methods=['PUT'])
def update_email_config():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'email_config.json'), 'w') as f:
        json.dump(data, f)
    return jsonify({'message':'Email config saved'})

@app.route('/api/settings/email-config/test', methods=['POST'])
def test_email_config():
    data = request.get_json() or {}
    host = data.get('smtp_host', '')
    port = int(data.get('smtp_port', 587) or 587)
    username = data.get('smtp_username', '')
    password = data.get('smtp_password', '')
    from_email = data.get('from_email', data.get('from_address', ''))
    if not host or not username:
        return jsonify({'success': False, 'message': 'SMTP host and username are required'}), 400
    try:
        server = smtplib.SMTP(host, port, timeout=10)
        server.ehlo()
        server.starttls()
        server.login(username, password)
        server.quit()
        return jsonify({'success': True, 'message': f'Connection successful! Connected to {host}:{port}'})
    except smtplib.SMTPAuthenticationError:
        return jsonify({'success': False, 'message': 'Authentication failed. Check username and password.'}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': f'Connection failed: {str(e)}'}), 400

# Email templates
@app.route('/api/settings/email-templates', methods=['GET'])
def get_email_templates():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'email_templates.json')) as f:
            templates = json.load(f)
    except:
        templates = [
            {'id':'tpl1','name':'Casting Confirmed','subject':'Your casting has been confirmed','body':'Hi {{client_name}},\n\nYour casting for {{project_name}} on {{shoot_date}} has been confirmed.\n\nBest,\nTOABH Team'},
            {'id':'tpl2','name':'Casting Reminder','subject':'Reminder: {{project_name}} shoot tomorrow','body':'Hi {{client_name}},\n\nThis is a reminder that {{project_name}} shoot is scheduled for {{shoot_date}}.\n\nBest,\nTOABH Team'},
        ]
    # Return as flat array (frontend expects this)
    return jsonify(templates)

@app.route('/api/settings/email-templates', methods=['PUT'])
def update_email_templates():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'email_templates.json'), 'w') as f:
        json.dump(data['templates'], f)
    return jsonify({'message':'Templates saved'})

@app.route('/api/settings/email-templates', methods=['POST'])
def create_email_template():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400
    name = (data.get('name') or '').strip()
    subject = (data.get('subject') or '').strip()
    body = (data.get('body') or '').strip()
    if not name or not subject:
        return jsonify({'error': 'Name and subject are required'}), 400
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'email_templates.json')) as f:
            templates = json.load(f)
    except:
        templates = []
    existing_ids = [t.get('id', 0) for t in templates if isinstance(t.get('id'), int)]
    new_id = (max(existing_ids) + 1) if existing_ids else 1
    new_template = {'id': new_id, 'name': name, 'subject': subject, 'body': body}
    templates.append(new_template)
    with open(os.path.join(SETTINGS_DIR, 'email_templates.json'), 'w') as f:
        json.dump(templates, f)
    return jsonify(new_template), 201

@app.route('/api/settings/email-templates/<int:template_id>', methods=['PUT'])
def update_single_email_template(template_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400
    name = (data.get('name') or '').strip()
    subject = (data.get('subject') or '').strip()
    body = (data.get('body') or '').strip()
    if not name or not subject:
        return jsonify({'error': 'Name and subject are required'}), 400
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'email_templates.json')) as f:
            templates = json.load(f)
    except:
        templates = []
    for t in templates:
        if t.get('id') == template_id:
            t['name'] = name
            t['subject'] = subject
            t['body'] = body
            break
    with open(os.path.join(SETTINGS_DIR, 'email_templates.json'), 'w') as f:
        json.dump(templates, f)
    return jsonify({'id': template_id, 'name': name, 'subject': subject, 'body': body})

@app.route('/api/settings/email-templates/<int:template_id>', methods=['DELETE'])
def delete_email_template(template_id):
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'email_templates.json')) as f:
            templates = json.load(f)
    except:
        templates = []
    templates = [t for t in templates if t.get('id') != template_id]
    with open(os.path.join(SETTINGS_DIR, 'email_templates.json'), 'w') as f:
        json.dump(templates, f)
    return jsonify({'success': True})

# Users management (in-memory for now)
USERS = [
    {'id':1,'name':'Toaney Bhatia','email':'toaney@toabh.com','role':'admin','is_active':True},
    {'id':2,'name':'Ainesh Sikdar','email':'ainesh@toabh.com','role':'booker','is_active':True},
]

@app.route('/api/users', methods=['GET'])
def get_users():
    return jsonify(USERS)

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    new_user = {
        'id': max(u['id'] for u in USERS) + 1,
        'name': data['name'],
        'email': data['email'],
        'role': data.get('role','viewer'),
        'is_active': True
    }
    USERS.append(new_user)
    return jsonify(new_user), 201

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    for u in USERS:
        if u['id'] == user_id:
            u.update({k:v for k,v in data.items() if k in ['name','email','role','is_active']})
            return jsonify(u)
    return jsonify({'error':'Not found'}), 404

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    global USERS
    USERS = [u for u in USERS if u['id'] != user_id]
    return jsonify({'message':'Deleted'})

# ==================== SEARCH ROUTE ====================

@app.route('/api/search', methods=['GET'])
def search():
    db = get_db()
    q = (request.args.get('q') or '').strip()

    if not q:
        return jsonify({'castings': [], 'clients': [], 'team': []})

    like = f'%{q}%'

    casting_rows = db.execute('''
        SELECT
            c.id,
            COALESCE(c.project_name, '') as project_name,
            COALESCE(c.client_name, '') as client_name,
            COALESCE(c.client_company, '') as client_company,
            COALESCE(c.client_contact, '') as client_contact,
            COALESCE(c.status, '') as status,
            COALESCE(c.created_at, '') as created_at,
            COALESCE(c.updated_at, '') as updated_at
        FROM castings c
        WHERE
            COALESCE(c.project_name, '') LIKE ?
            OR COALESCE(c.client_name, '') LIKE ?
            OR COALESCE(c.client_company, '') LIKE ?
            OR COALESCE(c.client_contact, '') LIKE ?
        ORDER BY c.updated_at DESC, c.created_at DESC
        LIMIT 8
    ''', (like, like, like, like)).fetchall()

    client_rows = db.execute('''
        SELECT
            cl.id,
            COALESCE(cl.name, '') as name,
            COALESCE(cl.company, '') as company,
            COALESCE(cl.phone, '') as phone,
            COALESCE(cl.email, '') as email,
            COALESCE(cl.notes, '') as notes,
            COALESCE(cl.created_at, '') as created_at,
            COALESCE(cl.updated_at, '') as updated_at
        FROM clients cl
        WHERE
            COALESCE(cl.name, '') LIKE ?
            OR COALESCE(cl.company, '') LIKE ?
            OR COALESCE(cl.phone, '') LIKE ?
            OR COALESCE(cl.email, '') LIKE ?
        ORDER BY cl.updated_at DESC, cl.created_at DESC
        LIMIT 5
    ''', (like, like, like, like)).fetchall()

    team_rows = db.execute('''
        SELECT
            tm.id,
            COALESCE(tm.name, '') as name,
            COALESCE(tm.role, '') as role,
            COALESCE(tm.email, '') as email,
            COALESCE(tm.phone, '') as phone,
            COALESCE(tm.avatar_url, '') as avatar_url,
            COALESCE(tm.is_active, 1) as is_active
        FROM team_members tm
        WHERE
            COALESCE(tm.name, '') LIKE ?
            OR COALESCE(tm.role, '') LIKE ?
            OR COALESCE(tm.email, '') LIKE ?
            OR COALESCE(tm.phone, '') LIKE ?
        ORDER BY tm.is_active DESC, tm.name ASC
        LIMIT 4
    ''', (like, like, like, like)).fetchall()

    return jsonify({
        'castings': [dict(r) for r in casting_rows],
        'clients': [dict(r) for r in client_rows],
        'team': [dict(r) for r in team_rows],
    })

# ==================== STATIC FILES (MUST BE LAST) ====================

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIST, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # API routes are handled above, so if we get here it's for static files
    file_path = os.path.join(FRONTEND_DIST, path)
    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIST, path)
    # Fallback to index.html for SPA routing
    return send_from_directory(FRONTEND_DIST, 'index.html')

# Initialize DB on startup
with app.app_context():
    init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
