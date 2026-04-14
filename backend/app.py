import os
import json
import shutil
import smtplib
import mimetypes
import re
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import quote
from flask import Flask, request, jsonify, g, send_from_directory, send_file, redirect
from werkzeug.serving import make_server
from dotenv import load_dotenv
from backend.db import connect as connect_db, get_database_config, IntegrityError as DBIntegrityError
from backend.db_schema import POSTGRES_SCHEMA_SCRIPT
from backend.utils.assistant import query_casting_assistant
from backend.auth_module import require_auth
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
app.config['DATABASE_CONFIG'] = get_database_config(DATABASE_PATH)
app.config['DB_BACKEND'] = app.config['DATABASE_CONFIG'].backend
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


def _get_app_base_url():
    configured = (os.environ.get('APP_BASE_URL') or '').strip().rstrip('/')
    if configured:
        return configured
    try:
        return request.url_root.rstrip('/')
    except RuntimeError:
        return 'https://toabh-casting-hub.vercel.app'


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
        g.db = connect_db(app.config['DATABASE_CONFIG'])
    return g.db


def safe_log_audit(db, user_id, action, details='', ip=''):
    try:
        log_audit(db, user_id, action, details, ip)
    except Exception as exc:
        print(f'Audit log skipped: {exc}')

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    if app.config['DB_BACKEND'] == 'postgres':
        db.executescript(POSTGRES_SCHEMA_SCRIPT)
        db.commit()
        return
    else:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS castings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT DEFAULT 'manual',
            source_detail TEXT,
            client_name TEXT,
            client_company TEXT,
            client_contact TEXT,
            client_email TEXT,
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
            email TEXT UNIQUE,
            phone TEXT,
            avatar_url TEXT,
            is_active INTEGER DEFAULT 1,
            username TEXT,
            password_hash TEXT,
            must_reset_password INTEGER DEFAULT 0,
            last_login TEXT,
            invite_status TEXT DEFAULT 'invited',
            invite_sent_at TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'Not Started',
            due_date TEXT,
            priority TEXT DEFAULT 'NORMAL',
            custom_fields TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS task_assignments (
            task_id INTEGER,
            team_member_id INTEGER,
            PRIMARY KEY (task_id, team_member_id),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_name TEXT,
            text TEXT,
            parent_id INTEGER,
            mentions TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            team_member_id INTEGER,
            action TEXT,
            details TEXT,
            timestamp TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL
        );
    ''')

    # Add missing castings columns for existing databases
    for col_def in [
        'ALTER TABLE castings ADD COLUMN custom_fields TEXT DEFAULT "{}"',
        'ALTER TABLE castings ADD COLUMN client_email TEXT',
    ]:
        try:
            db.execute(col_def)
        except:
            pass

    # Add missing columns to team_members for existing databases
    for col_def in [
        'ALTER TABLE team_members ADD COLUMN email TEXT',
        'ALTER TABLE team_members ADD COLUMN phone TEXT',
        'ALTER TABLE team_members ADD COLUMN avatar_url TEXT',
        'ALTER TABLE team_members ADD COLUMN username TEXT',
        'ALTER TABLE team_members ADD COLUMN password_hash TEXT',
        'ALTER TABLE team_members ADD COLUMN must_reset_password INTEGER DEFAULT 0',
        'ALTER TABLE team_members ADD COLUMN last_login TEXT',
        'ALTER TABLE team_members ADD COLUMN invite_status TEXT DEFAULT "invited"',
        'ALTER TABLE team_members ADD COLUMN invite_sent_at TEXT',
        'ALTER TABLE team_members ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
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
    db.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'Not Started',
            due_date TEXT,
            priority TEXT DEFAULT 'NORMAL',
            custom_fields TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS task_assignments (
            task_id INTEGER,
            team_member_id INTEGER,
            PRIMARY KEY (task_id, team_member_id),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS task_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_name TEXT,
            text TEXT,
            parent_id INTEGER,
            mentions TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS task_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            team_member_id INTEGER,
            action TEXT,
            details TEXT,
            timestamp TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL
        )
    ''')

    # Seed team members if empty
    cursor = db.execute('SELECT COUNT(*) FROM team_members')
    if cursor.fetchone()[0] == 0:
        from backend.auth_module import hash_password as _hp
        _default_pw = os.environ.get('DEFAULT_INVITE_PASSWORD', 'toabhtalents')
        team_members = [
            ('Sangeeta S Bhatia', 'Team Member', 'sangeeta@toabh.com', _hp(_default_pw), 'sangeeta', 'active'),
            ('Tony Bhatia', 'Founder', 'tony@toabh.com', _hp(_default_pw), 'tony', 'active'),
            ('Aryan Dhawan', 'Team Member', 'aryan@toabh.com', _hp(_default_pw), 'aryan', 'active'),
            ('Anvitha Dogra', 'Team Member', 'anvitha@toabh.com', _hp(_default_pw), 'anvitha', 'active'),
            ('Khadija Mithaiwala', 'Team Member', 'khadija@toabh.com', _hp(_default_pw), 'khadija', 'active'),
            ('Prashant Shreshta', 'Team Member', 'prashant@toabh.com', _hp(_default_pw), 'prashant', 'active'),
            ('Jhalak', 'Team Member', 'jhalak@toabh.com', _hp(_default_pw), 'jhalak', 'active'),
            ('Saloni Pomal', 'Team Member', 'saloni.p@toabh.com', _hp(_default_pw), 'saloni', 'active'),
            ('Saloni Kale', 'Team Member', 'saloni.k@toabh.com', _hp(_default_pw), 'saloni_k', 'active'),
        ]
        db.executemany(
            'INSERT INTO team_members (name, role, email, password_hash, username, invite_status) VALUES (?, ?, ?, ?, ?, ?)',
            team_members
        )

    # Ensure auth columns exist (migration for older DBs)
    for col_sql in [
        'ALTER TABLE team_members ADD COLUMN username TEXT',
        'ALTER TABLE team_members ADD COLUMN password_hash TEXT',
        'ALTER TABLE team_members ADD COLUMN must_reset_password INTEGER DEFAULT 0',
        'ALTER TABLE team_members ADD COLUMN invite_status TEXT DEFAULT "invited"',
        'ALTER TABLE team_members ADD COLUMN invite_sent_at TEXT',
        'ALTER TABLE team_members ADD COLUMN is_active INTEGER DEFAULT 1',
    ]:
        try:
            db.execute(col_sql)
        except Exception:
            pass  # column already exists

    db.commit()

    # Seed super-admin user (always run, regardless of existing users)
    from backend.auth_module import SUPER_ADMIN_HASH_DEFAULT
    existing_sa = db.execute('SELECT id, password_hash FROM team_members WHERE username = ?', ('admin',)).fetchone()
    if existing_sa:
        # Update password hash to match admin/admin if current hash is wrong
        db.execute("UPDATE team_members SET password_hash = ?, invite_status = 'active', is_active = 1, email = COALESCE(email, 'admin@toabh.com') WHERE username = ?",
                   (SUPER_ADMIN_HASH_DEFAULT, 'admin'))
    else:
        db.execute(
            "INSERT INTO team_members (name, role, email, password_hash, username, invite_status, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
            ('Administrator', 'admin', 'admin@toabh.com', SUPER_ADMIN_HASH_DEFAULT, 'admin', 'active')
        )

    # Set default password for all existing team members who don't have one
    from backend.auth_module import hash_password as _hp
    _default_pw = os.environ.get('DEFAULT_INVITE_PASSWORD', 'toabhtalents')
    _default_hash = _hp(_default_pw)
    db.execute("UPDATE team_members SET password_hash = ?, must_reset_password = 0, invite_status = 'active', is_active = 1 WHERE password_hash IS NULL OR password_hash = ''",
               (_default_hash,))

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
    db.execute('''
        CREATE TABLE IF NOT EXISTS settings_client_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#f59e0b',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS client_tag_assignments (
            client_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (client_id, tag_id),
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES settings_client_tags(id) ON DELETE CASCADE
        )
    ''')

    # ─── Talents module ──────────────────────────────────────────────
    db.execute('''
        CREATE TABLE IF NOT EXISTS talents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            instagram_handle TEXT,
            phone TEXT,
            email TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    ''')
    db.execute('CREATE INDEX IF NOT EXISTS idx_talents_name ON talents(name)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_talents_phone ON talents(phone)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_talents_email ON talents(email)')
    db.execute('''
        CREATE TABLE IF NOT EXISTS casting_talents (
            casting_id INTEGER NOT NULL,
            talent_id INTEGER NOT NULL,
            PRIMARY KEY (casting_id, talent_id),
            FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE,
            FOREIGN KEY (talent_id) REFERENCES talents(id) ON DELETE CASCADE
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

with app.app_context():
    init_db()

# ==================== ACTIVITIES ROUTES ====================

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'ok': True}), 200


@app.route('/api/search', methods=['GET'])
@require_auth
def global_search():
    db = get_db()
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'projects': [], 'clients': [], 'team': []})

    like = f'%{q}%'
    projects = db.execute(
        'SELECT id, project_name, client_name, status FROM castings WHERE project_name LIKE ? OR client_name LIKE ? LIMIT 20',
        (like, like)
    ).fetchall()
    clients = db.execute(
        'SELECT id, name, company, email FROM clients WHERE name LIKE ? OR company LIKE ? OR email LIKE ? LIMIT 20',
        (like, like, like)
    ).fetchall()
    team = db.execute(
        'SELECT id, name, role, email FROM team_members WHERE name LIKE ? OR role LIKE ? OR email LIKE ? LIMIT 20',
        (like, like, like)
    ).fetchall()

    return jsonify({
        'projects': [dict(row) for row in projects],
        'clients': [dict(row) for row in clients],
        'team': [dict(row) for row in team],
    })


@app.route('/api/activities', methods=['GET'])
@require_auth
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


def _load_task_stages():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    default_stages = [
        {'id': 1, 'name': 'Not Started', 'color': '#94a3b8', 'sort_order': 0},
        {'id': 2, 'name': 'In Progress', 'color': '#f59e0b', 'sort_order': 1},
        {'id': 3, 'name': 'Completed', 'color': '#22c55e', 'sort_order': 2},
    ]
    try:
        with open(os.path.join(SETTINGS_DIR, 'task_stages.json')) as f:
            stages = json.load(f)
            return stages if isinstance(stages, list) and stages else default_stages
    except Exception:
        return default_stages


def _save_task_stages(stages):
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'task_stages.json'), 'w') as f:
        json.dump(stages, f)


def _load_notification_rules():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'automation_rules.json')) as f:
            payload = json.load(f)
            return payload.get('rules', []) if isinstance(payload, dict) else []
    except Exception:
        return []


def _notification_channels(rule_id):
    for rule in _load_notification_rules():
        if rule.get('id') == rule_id and rule.get('enabled', True):
            return rule.get('channels', []) or []
    return []


def _send_email_notification(recipient, subject, message):
    if not recipient:
        return
    try:
        with open(os.path.join(SETTINGS_DIR, 'email_config.json')) as f:
            config = json.load(f)
    except Exception:
        return

    host = config.get('smtp_host') or ''
    username = config.get('smtp_username') or ''
    password = config.get('smtp_password') or ''
    from_email = config.get('from_email') or config.get('from_address') or username
    from_name = config.get('from_name') or 'TOABH'
    port = int(config.get('smtp_port') or 587)
    if not host or not username or not password or not from_email:
        return

    msg = MIMEMultipart()
    msg['From'] = f'{from_name} <{from_email}>'
    msg['To'] = recipient
    msg['Subject'] = subject
    msg.attach(MIMEText(message, 'plain'))

    server = smtplib.SMTP(host, port, timeout=10)
    server.ehlo()
    server.starttls()
    server.login(username, password)
    server.sendmail(from_email, [recipient], msg.as_string())
    server.quit()


def _serialize_task_row(db, row):
    task = dict(row)
    task['assigned_to'] = [dict(item) for item in db.execute(
        '''
        SELECT tm.id, tm.name, COALESCE(tm.role, '') as role, COALESCE(tm.email, '') as email, COALESCE(tm.avatar_url, '') as avatar_url
        FROM task_assignments ta
        INNER JOIN team_members tm ON tm.id = ta.team_member_id
        WHERE ta.task_id = ?
        ORDER BY tm.name COLLATE NOCASE ASC
        ''',
        (row['id'],)
    ).fetchall()]
    return task


def _create_task_activity(db, task_id, action, details, team_member_id=None):
    db.execute(
        'INSERT INTO task_activities (task_id, team_member_id, action, details) VALUES (?, ?, ?, ?)',
        (task_id, team_member_id, action, details),
    )


def _apply_casting_assignments(db, casting_rows):
    castings = [dict(row) for row in casting_rows]
    if not castings:
        return []

    casting_ids = [casting['id'] for casting in castings]
    placeholders = ','.join('?' for _ in casting_ids)
    assignment_rows = db.execute(
        f'''
        SELECT ca.casting_id, tm.id, tm.name
        FROM casting_assignments ca
        LEFT JOIN team_members tm ON tm.id = ca.team_member_id
        WHERE ca.casting_id IN ({placeholders})
        ORDER BY tm.name COLLATE NOCASE ASC, tm.id ASC
        ''',
        casting_ids,
    ).fetchall()

    assignments_by_casting = {}
    for row in assignment_rows:
        assignments_by_casting.setdefault(row['casting_id'], []).append({
            'id': int(row['id']) if row['id'] is not None else None,
            'name': row['name'] or '',
        })

    for casting in castings:
        casting['attachments_count'] = int(casting.get('attachments_count') or 0)
        casting['assigned_to'] = [
            item for item in assignments_by_casting.get(casting['id'], [])
            if item['id'] is not None and item['name']
        ]

    return castings


@app.route('/api/tasks', methods=['GET', 'POST'])
@require_auth
def tasks():
    db = get_db()

    if request.method == 'POST':
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        if not title:
            return jsonify({'error': 'Task title is required'}), 400

        stage_names = {stage['name'] for stage in _load_task_stages()}
        status = (data.get('status') or 'Not Started').strip()
        if status not in stage_names:
            status = 'Not Started'

        description = (data.get('description') or '').strip()
        due_date = (data.get('due_date') or '').strip() or None
        priority = (data.get('priority') or 'NORMAL').strip() or 'NORMAL'
        custom_fields = json.dumps(data.get('custom_fields') or {})
        assignee_ids = [int(item) for item in data.get('assignee_ids', []) if str(item).isdigit()]

        cursor = db.execute(
            'INSERT INTO tasks (title, description, status, due_date, priority, custom_fields) VALUES (?, ?, ?, ?, ?, ?)',
            (title, description, status, due_date, priority, custom_fields),
        )
        task_id = cursor.lastrowid
        for member_id in assignee_ids:
            _insert_assignment_if_missing(db, 'task_assignments', 'task_id', 'team_member_id', task_id, member_id)

        _create_task_activity(db, task_id, 'CREATED', f'Task created: {title}')
        if assignee_ids:
            _create_task_activity(db, task_id, 'ASSIGNED', 'Task assigned')
            if 'email' in _notification_channels('assignment_changed'):
                members = db.execute(
                    f"SELECT name, email FROM team_members WHERE id IN ({','.join('?' for _ in assignee_ids)})",
                    assignee_ids,
                ).fetchall()
                for member in members:
                    try:
                        _send_email_notification(member['email'], f'New task assigned: {title}', f'Hi {member["name"]},\n\nA new task has been assigned to you: {title}.')
                    except Exception:
                        pass

        db.commit()
        created = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        return jsonify(_serialize_task_row(db, created)), 201

    query = 'SELECT t.* FROM tasks t'
    conditions = []
    params = []

    team_member_id = request.args.get('team_member_id')
    if team_member_id:
        conditions.append('EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.team_member_id = ?)')
        params.append(int(team_member_id))

    filter_name = (request.args.get('filter') or '').strip().lower()
    if filter_name == 'completed':
        conditions.append('LOWER(t.status) = LOWER(?)')
        params.append('Completed')
    elif filter_name == 'overdue':
        conditions.append("t.due_date IS NOT NULL AND t.due_date != '' AND date(t.due_date) < date('now') AND LOWER(t.status) != LOWER('Completed')")

    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)

    query += " ORDER BY CASE WHEN LOWER(t.status)=LOWER('Completed') THEN 1 ELSE 0 END, COALESCE(NULLIF(t.due_date, ''), '9999-12-31') ASC, t.created_at DESC"
    rows = db.execute(query, params).fetchall()
    return jsonify([_serialize_task_row(db, row) for row in rows])


@app.route('/api/tasks/<int:task_id>', methods=['GET', 'PUT', 'DELETE'])
@require_auth
def task_detail(task_id):
    db = get_db()
    row = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Task not found'}), 404

    if request.method == 'GET':
        return jsonify(_serialize_task_row(db, row))

    if request.method == 'DELETE':
        db.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        db.commit()
        return jsonify({'success': True})

    data = request.get_json() or {}
    title = (data.get('title') or row['title'] or '').strip()
    if not title:
        return jsonify({'error': 'Task title is required'}), 400
    description = (data.get('description') if data.get('description') is not None else row['description'] or '').strip()
    due_date = (data.get('due_date') if data.get('due_date') is not None else row['due_date'] or '').strip() or None
    status = (data.get('status') if data.get('status') is not None else row['status'] or 'Not Started').strip()
    priority = (data.get('priority') if data.get('priority') is not None else row['priority'] or 'NORMAL').strip() or 'NORMAL'
    custom_fields = json.dumps(data.get('custom_fields') if data.get('custom_fields') is not None else json.loads(row['custom_fields'] or '{}'))

    db.execute(
        'UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ?, priority = ?, custom_fields = ?, updated_at = datetime(\'now\') WHERE id = ?',
        (title, description, status, due_date, priority, custom_fields, task_id),
    )
    if 'assignee_ids' in data:
        assignee_ids = [int(item) for item in data.get('assignee_ids', []) if str(item).isdigit()]
        db.execute('DELETE FROM task_assignments WHERE task_id = ?', (task_id,))
        for member_id in assignee_ids:
            _insert_assignment_if_missing(db, 'task_assignments', 'task_id', 'team_member_id', task_id, member_id)
        _create_task_activity(db, task_id, 'ASSIGNED', 'Task assignment updated')

    _create_task_activity(db, task_id, 'UPDATED', f'Task updated: {title}')
    db.commit()
    updated = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    return jsonify(_serialize_task_row(db, updated))


@app.route('/api/tasks/<int:task_id>/status', methods=['PUT'])
@require_auth
def update_task_status(task_id):
    db = get_db()
    row = db.execute('SELECT id, status FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Task not found'}), 404
    data = request.get_json() or {}
    status = (data.get('status') or '').strip()
    if not status:
        return jsonify({'error': 'Status is required'}), 400
    db.execute('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', (status, task_id))
    _create_task_activity(db, task_id, 'STATUS_CHANGED', f'Status changed from {row["status"]} to {status}')
    db.commit()
    updated = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    return jsonify(_serialize_task_row(db, updated))


@app.route('/api/tasks/<int:task_id>/comments', methods=['GET', 'POST'])
@require_auth
def task_comments(task_id):
    db = get_db()
    task = db.execute('SELECT id, title FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if task is None:
        return jsonify({'error': 'Task not found'}), 404

    if request.method == 'GET':
        rows = db.execute('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC, id ASC', (task_id,)).fetchall()
        comments = []
        for row in rows:
            comments.append({
                'id': row['id'],
                'task_id': row['task_id'],
                'user_name': row['user_name'] or 'Team',
                'text': row['text'] or '',
                'parent_id': row['parent_id'],
                'mentions': json.loads(row['mentions'] or '[]'),
                'created_at': row['created_at'],
            })
        return jsonify(comments)

    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Comment text is required'}), 400
    user_name = (data.get('user_name') or 'Team').strip() or 'Team'
    parent_id = data.get('parent_id')
    mentions = data.get('mentions') if isinstance(data.get('mentions'), list) else _extract_mentions(text)
    cursor = db.execute(
        'INSERT INTO task_comments (task_id, user_name, text, parent_id, mentions) VALUES (?, ?, ?, ?, ?)',
        (task_id, user_name, text, parent_id, json.dumps(mentions)),
    )
    _create_task_activity(db, task_id, 'COMMENT', f'Comment added by {user_name}')
    if mentions and 'email' in _notification_channels('note_mention'):
        members = db.execute(
            'SELECT name, email FROM team_members WHERE LOWER(name) IN (' + ','.join('?' for _ in mentions) + ')',
            [mention.replace('.', ' ').lower() for mention in mentions],
        ).fetchall()
        for member in members:
            try:
                _send_email_notification(member['email'], f'Mentioned in task: {task["title"]}', f'Hi {member["name"]},\n\nYou were mentioned in task "{task["title"]}".')
            except Exception:
                pass
    db.commit()
    return jsonify({
        'id': cursor.lastrowid,
        'task_id': task_id,
        'user_name': user_name,
        'text': text,
        'parent_id': parent_id,
        'mentions': mentions,
        'created_at': datetime.now().isoformat(),
    }), 201


@app.route('/api/tasks/<int:task_id>/activities', methods=['GET'])
@require_auth
def task_activities(task_id):
    db = get_db()
    rows = db.execute(
        '''
        SELECT ta.id, ta.task_id, ta.action, ta.details as description,
               COALESCE(tm.name, ta.details) as user_name, ta.timestamp as created_at
        FROM task_activities ta
        LEFT JOIN team_members tm ON ta.team_member_id = tm.id
        WHERE ta.task_id = ?
        ORDER BY ta.timestamp DESC, ta.id DESC
        ''',
        (task_id,),
    ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.route('/api/settings/task-stages', methods=['GET', 'PUT', 'POST'])
@require_auth
def task_stages():
    if request.method == 'GET':
        return jsonify(_load_task_stages())

    data = request.get_json() or {}
    if request.method == 'POST':
        stages = _load_task_stages()
        next_id = max([int(stage.get('id', 0)) for stage in stages] + [0]) + 1
        new_stage = {
            'id': next_id,
            'name': (data.get('name') or '').strip() or f'Stage {next_id}',
            'color': (data.get('color') or '#6366f1').strip(),
            'sort_order': len(stages),
        }
        stages.append(new_stage)
        _save_task_stages(stages)
        return jsonify(new_stage), 201

    stages = data.get('stages') if isinstance(data.get('stages'), list) else data
    if not isinstance(stages, list):
        return jsonify({'error': 'Stages payload is required'}), 400
    normalized = []
    for index, stage in enumerate(stages):
        normalized.append({
            'id': int(stage.get('id', index + 1)),
            'name': (stage.get('name') or '').strip() or f'Stage {index + 1}',
            'color': (stage.get('color') or '#6366f1').strip(),
            'sort_order': int(stage.get('sort_order', index)),
        })
    _save_task_stages(normalized)
    return jsonify(normalized)


@app.route('/api/notifications', methods=['GET'])
@require_auth
def list_notifications():
    db = get_db()
    rows = db.execute('''
        SELECT a.id, a.casting_id, a.action, a.details as description,
               COALESCE(tm.name, a.details) as user_name, a.timestamp as created_at
        FROM activities a
        LEFT JOIN team_members tm ON a.team_member_id = tm.id
        ORDER BY a.timestamp DESC
        LIMIT 20
    ''').fetchall()

    activities = [_activity_row_to_dict(row) for row in rows]
    notifications = [_build_notification_from_activity(activity) for activity in activities]
    return jsonify({'notifications': notifications})

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


def _build_notification_from_activity(activity):
    action = (activity.get('action') or '').upper()
    created_at = activity.get('created_at') or activity.get('timestamp') or datetime.now().isoformat()
    casting_id = activity.get('casting_id')
    user_name = activity.get('user_name') or activity.get('team_member_name') or 'Team'
    body = activity.get('description') or activity.get('details') or 'Activity update'

    notification_type = 'general'
    title = 'Activity update'

    if action in {'ASSIGNED', 'REASSIGNED'}:
        notification_type = 'assignment'
        title = 'New assignment'
    elif action in {'STATUS_CHANGE', 'STATUS_CHANGED'}:
        notification_type = 'status_change'
        title = 'Status changed'
    elif action == 'NOTE':
        mentions = activity.get('mentions') or []
        if mentions:
            notification_type = 'mention'
            title = 'You were mentioned'
        else:
            notification_type = 'comment'
            title = 'New comment added'

    return {
        'id': f"{action.lower() or 'activity'}-{activity.get('id')}",
        'type': notification_type,
        'title': title,
        'message': body,
        'created_at': created_at,
        'casting_id': casting_id,
        'client_id': None,
        'user_name': user_name,
    }


@app.route('/api/comments/<int:casting_id>', methods=['GET'])
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
def update_roles():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'roles.json'), 'w') as f:
        json.dump(data, f)
    return jsonify(data)

# ==================== CASTING ROUTES ====================

@app.route('/api/castings', methods=['GET', 'POST'])
@require_auth
def list_castings():
    db = get_db()
    if request.method == 'POST':
        data = request.json

        # Handle assignment
        assigned_members = data.pop('assigned_to', [])

        cursor = db.execute('''
            INSERT INTO castings (
                source, source_detail, client_name, client_company, client_contact, client_email,
                project_name, project_type, shoot_date_start, shoot_date_end,
                location, medium, usage, budget_min, budget_max, requirements,
                apply_to, status, priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('source', 'manual'),
            data.get('source_detail'),
            data.get('client_name'),
            data.get('client_company'),
            data.get('client_contact'),
            data.get('client_email'),
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
        SELECT c.*,
               (SELECT COUNT(*) FROM casting_attachments ca2 WHERE ca2.casting_id = c.id) as attachments_count,
               (SELECT '/api/attachments/' || id
                FROM casting_attachments ca2
                WHERE ca2.casting_id = c.id
                ORDER BY created_at DESC, id DESC
                LIMIT 1) as latest_attachment_url
        FROM castings c
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
        conditions.append('EXISTS (SELECT 1 FROM casting_assignments ca WHERE ca.casting_id = c.id AND ca.team_member_id = ?)')
        params.append(int(team_member_id))

    search = request.args.get('search')
    if search:
        conditions.append('(c.client_name LIKE ? OR c.project_name LIKE ?)')
        params.extend([f'%{search}%', f'%{search}%'])

    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)

    query += ' ORDER BY c.created_at DESC'

    rows = db.execute(query, params).fetchall()
    return jsonify(_apply_casting_assignments(db, rows))

@app.route('/api/castings/<int:casting_id>', methods=['GET', 'PUT', 'DELETE'])
@require_auth
def single_casting(casting_id):
    db = get_db()

    if request.method == 'GET':
        row = db.execute('''
            SELECT c.*,
                   (SELECT COUNT(*) FROM casting_attachments ca2 WHERE ca2.casting_id = c.id) as attachments_count,
                   (SELECT '/api/attachments/' || id
                    FROM casting_attachments ca2
                    WHERE ca2.casting_id = c.id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1) as latest_attachment_url
            FROM castings c
            WHERE c.id = ?
        ''', (casting_id,)).fetchone()

        if not row:
            return jsonify({'error': 'Not found'}), 404

        casting = _apply_casting_assignments(db, [row])[0]
        return jsonify(casting)

    elif request.method == 'PUT':
        data = request.json
        fields = []
        values = []

        for field in ['source', 'source_detail', 'client_name', 'client_company', 'client_contact', 'client_email',
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
def list_team():
    db = get_db()

    if request.method == 'POST':
        data = request.json or {}
        name = (data.get('name') or '').strip()
        role = (data.get('role') or 'Team Member').strip()
        email = (data.get('email') or '').strip()
        phone = (data.get('phone') or '').strip()
        avatar_url = (data.get('avatar_url') or '').strip()

        if not name:
            return jsonify({'error': 'Name is required'}), 400
        if not email:
            return jsonify({'error': 'Email is required'}), 400

        normalized_email = email.lower()
        normalized_name = ' '.join(name.lower().split())

        existing_by_email = db.execute(
            "SELECT * FROM team_members WHERE LOWER(COALESCE(email, '')) = ? LIMIT 1",
            (normalized_email,)
        ).fetchone()
        if existing_by_email:
            return jsonify({'error': 'A team member with this email already exists', 'member_id': existing_by_email['id']}), 409

        existing_same_person = db.execute(
            '''
            SELECT * FROM team_members
            WHERE LOWER(TRIM(COALESCE(name, ''))) = ?
              AND LOWER(TRIM(COALESCE(role, ''))) = ?
            ORDER BY id ASC
            LIMIT 1
            ''',
            (normalized_name, role.lower())
        ).fetchone()

        existing = db.execute('SELECT username FROM team_members WHERE username IS NOT NULL').fetchall()
        existing_usernames = {r['username'].lower() for r in existing if r['username']}
        tmp_password = DEFAULT_PW
        pw_hash = hash_password(tmp_password)

        if existing_same_person:
            username = (existing_same_person['username'] or '').strip() or generate_unique_username(name, existing_usernames)
            db.execute(
                '''
                UPDATE team_members
                SET email = ?,
                    phone = ?,
                    avatar_url = ?,
                    username = ?,
                    password_hash = ?,
                    must_reset_password = 1,
                    invite_status = 'invited',
                    invite_sent_at = datetime('now'),
                    is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (normalized_email, phone or None, avatar_url or None, username, pw_hash, existing_same_person['id'])
            )
            member_id = existing_same_person['id']
            status_code = 200
        else:
            username = generate_unique_username(name, existing_usernames)
            cursor = db.execute(
                "INSERT INTO team_members (name, role, email, phone, avatar_url, is_active, username, password_hash, must_reset_password, invite_status, invite_sent_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, 'invited', datetime('now'))",
                (name, role, normalized_email, phone or None, avatar_url or None, username, pw_hash)
            )
            member_id = cursor.lastrowid
            status_code = 201

        db.commit()

        # Send invite email
        login_url = f"{_get_app_base_url()}/login"
        from backend.auth_module import invite_email_html, send_smtp
        html_body = invite_email_html(name, username, tmp_password, login_url)
        sent, msg = send_smtp(normalized_email, f"Welcome to TOABH Casting Hub — {name}", html_body)
        if sent:
            db.execute("UPDATE team_members SET invite_status = 'active' WHERE id = ?", (member_id,))
            db.commit()

        safe_log_audit(db, None, 'TEAM_INVITE', f'Invited {name} ({normalized_email}) as {role}', _get_client_ip())

        member = db.execute('SELECT * FROM team_members WHERE id = ?', (member_id,)).fetchone()
        return jsonify(dict(member)), status_code

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
@require_auth
def single_team_member(member_id):
    db = get_db()

    if request.method == 'DELETE':
        db.execute('DELETE FROM team_members WHERE id = ?', (member_id,))
        db.commit()
        safe_log_audit(db, None, 'TEAM_DELETE', f'Deleted team member {member_id}', _get_client_ip())
        return jsonify({'message': 'Deleted'})

    elif request.method == 'PUT':
        data = request.json or {}

        name = (data.get('name') or '').strip()
        role = (data.get('role') or '').strip()
        email = (data.get('email') or '').strip()
        phone = (data.get('phone') or '').strip()
        is_active = data.get('is_active')
        avatar_url = (data.get('avatar_url') or '').strip()

        updates = []
        params = []
        if 'name' in data:
            updates.append('name = ?')
            params.append(name)
        if 'role' in data:
            updates.append('role = ?')
            params.append(role)
        if is_active is not None:
            updates.append('is_active = ?')
            params.append(is_active)
        if 'email' in data:
            duplicate = db.execute(
                "SELECT id FROM team_members WHERE LOWER(COALESCE(email, '')) = ? AND id != ? LIMIT 1",
                (email.lower(), member_id)
            ).fetchone() if email else None
            if duplicate:
                return jsonify({'error': 'A team member with this email already exists', 'member_id': duplicate['id']}), 409
            updates.append('email = ?')
            params.append(email.lower() or None)
        if 'phone' in data:
            updates.append('phone = ?')
            params.append(phone or None)
        if 'avatar_url' in data:
            updates.append('avatar_url = ?')
            params.append(avatar_url or None)

        if not updates:
            return jsonify({'error': 'No fields to update'}), 400

        updates.append('updated_at = CURRENT_TIMESTAMP')
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


@app.route('/api/team/<int:member_id>/resend-invite', methods=['POST'])
@require_auth
def resend_invite(member_id):
    db = get_db()
    user = db.execute('SELECT id, name, email, username, invite_status FROM team_members WHERE id = ?', (member_id,)).fetchone()
    if not user:
        return jsonify({'error': 'Member not found'}), 404
    if not user['email']:
        return jsonify({'error': 'No email on file'}), 400
    tmp_password = DEFAULT_PW
    login_url = f"{_get_app_base_url()}/login"
    from backend.auth_module import invite_email_html
    html_body = invite_email_html(user['name'], user['username'] or user['name'], tmp_password, login_url)
    sent, msg = send_smtp(user['email'], f"TOABH Casting Hub invite (resend) — {user['name']}", html_body)
    if sent:
        db.execute("UPDATE team_members SET invite_status = 'active', invite_sent_at = datetime('now') WHERE id = ?", (member_id,))
        db.commit()
    try:
        log_audit(db, None, 'INVITE_RESEND', f'Resent invite to {user["email"]}', request.remote_addr)
    except Exception:
        pass
    return jsonify({'sent': sent, 'message': msg})


@app.route('/api/team/<int:member_id>/toggle-status', methods=['POST'])
@require_auth
def toggle_member_status(member_id):
    db = get_db()
    user = db.execute('SELECT id, name, is_active FROM team_members WHERE id = ?', (member_id,)).fetchone()
    if not user:
        return jsonify({'error': 'Member not found'}), 404
    new_status = 0 if user['is_active'] else 1
    db.execute('UPDATE team_members SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (new_status, member_id))
    db.commit()
    action = 'DEACTIVATED' if new_status == 0 else 'ACTIVATED'
    try:
        log_audit(db, None, action, f'{action} user {user["name"]}', request.remote_addr)
    except Exception:
        pass
    return jsonify({'is_active': new_status})

# ==================== TEAM MEMBER UPLOAD ====================
@app.route('/api/team/<int:member_id>/avatar', methods=['POST'])
@require_auth
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

    # Use a safe filename keyed by team member id
    filename = f'{member_id}.{ext}'
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    # Store relative URL
    avatar_url = f'/api/team/{member_id}/avatar'
    db.execute('UPDATE team_members SET avatar_url = ? WHERE id = ?', (avatar_url, member_id))
    db.commit()

    return jsonify({'avatar_url': avatar_url}), 200

@app.route('/api/team/<int:member_id>/avatar')
@require_auth
def serve_team_avatar(member_id):
    """Serve the uploaded avatar image."""
    upload_dir = os.path.join(UPLOADS_DIR, 'avatars')
    for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
        filepath = os.path.join(upload_dir, f'{member_id}.{ext}')
        if os.path.exists(filepath):
            return send_file(filepath)
    return jsonify({'error': 'Avatar not found'}), 404


def _profile_settings_path():
    return os.path.join(SETTINGS_DIR, 'profile.json')


def _get_default_profile(db):
    member = db.execute(
        '''
        SELECT id, name, role, COALESCE(email, '') as email, COALESCE(phone, '') as phone, COALESCE(avatar_url, '') as avatar_url
        FROM team_members
        WHERE is_active = 1
        ORDER BY CASE WHEN LOWER(COALESCE(role, '')) IN ('admin', 'founder') THEN 0 ELSE 1 END, id ASC
        LIMIT 1
        '''
    ).fetchone()

    if member is None:
        return {
            'name': 'Team Member',
            'email': '',
            'phone': '',
            'date_of_birth': '',
            'role': 'Admin',
            'avatar_url': '',
            'team_member_id': None,
        }

    return {
        'name': member['name'],
        'email': member['email'],
        'phone': member['phone'],
        'date_of_birth': '',
        'role': member['role'] or 'Admin',
        'avatar_url': member['avatar_url'],
        'team_member_id': member['id'],
    }


def _load_profile_settings(db):
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    profile = _get_default_profile(db)
    try:
        with open(_profile_settings_path()) as f:
            saved = json.load(f)
            if isinstance(saved, dict):
                profile.update({
                    'name': (saved.get('name') or profile['name']).strip() if isinstance(saved.get('name'), str) else profile['name'],
                    'email': (saved.get('email') or profile['email']).strip() if isinstance(saved.get('email'), str) else profile['email'],
                    'phone': (saved.get('phone') or profile['phone']).strip() if isinstance(saved.get('phone'), str) else profile['phone'],
                    'date_of_birth': (saved.get('date_of_birth') or '').strip() if isinstance(saved.get('date_of_birth'), str) else '',
                    'role': (saved.get('role') or profile['role']).strip() if isinstance(saved.get('role'), str) else profile['role'],
                    'avatar_url': (saved.get('avatar_url') or profile['avatar_url']).strip() if isinstance(saved.get('avatar_url'), str) else profile['avatar_url'],
                    'team_member_id': saved.get('team_member_id') if isinstance(saved.get('team_member_id'), int) else profile['team_member_id'],
                })
    except Exception:
        pass

    return profile


def _save_profile_settings(profile):
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(_profile_settings_path(), 'w') as f:
        json.dump(profile, f)


def _sync_profile_to_team_member(db, profile):
    team_member_id = profile.get('team_member_id')
    if not team_member_id:
        return
    db.execute(
        'UPDATE team_members SET name = ?, role = ?, email = ?, phone = ?, avatar_url = ? WHERE id = ?',
        (
            profile.get('name') or None,
            profile.get('role') or None,
            profile.get('email') or None,
            profile.get('phone') or None,
            profile.get('avatar_url') or None,
            team_member_id,
        ),
    )


def _build_profile_payload(db, profile):
    team_member_id = profile.get('team_member_id')
    active_statuses = ('NEW', 'REVIEWING', 'PROPOSED', 'NEGOTIATING', 'CONFIRMED', 'IN_PROGRESS')
    completed_statuses = ('WON', 'PAID', 'COMPLETED')

    if team_member_id:
        assigned_rows = db.execute(
            '''
            SELECT c.id, COALESCE(c.project_name, '') as project_name, COALESCE(c.client_name, '') as client_name,
                   COALESCE(c.status, '') as status, c.shoot_date_start
            FROM castings c
            INNER JOIN casting_assignments ca ON ca.casting_id = c.id
            WHERE ca.team_member_id = ?
            ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
            ''',
            (team_member_id,)
        ).fetchall()

        activity_rows = db.execute(
            '''
            SELECT a.id, a.casting_id, a.action, a.details as description,
                   COALESCE(tm.name, a.details) as user_name, a.timestamp as created_at
            FROM activities a
            LEFT JOIN team_members tm ON a.team_member_id = tm.id
            WHERE a.team_member_id = ? OR LOWER(COALESCE(tm.name, '')) = LOWER(?)
            ORDER BY a.timestamp DESC
            LIMIT 8
            ''',
            (team_member_id, profile.get('name') or ''),
        ).fetchall()
    else:
        assigned_rows = []
        activity_rows = []

    from datetime import date as _date
    total_jobs = len(assigned_rows)
    active_jobs = sum(1 for row in assigned_rows if row['status'] in active_statuses)
    completed_jobs = sum(1 for row in assigned_rows if row['status'] in completed_statuses)
    overdue_jobs = sum(
        1 for row in assigned_rows
        if row['status'] not in completed_statuses
        and row['shoot_date_start']
        and str(row['shoot_date_start']) < str(_date.today())
    )

    tasks = [
        {
            **dict(row),
            'due_date': row['shoot_date_start'],
        }
        for row in assigned_rows[:8]
    ]
    recent_activity = [dict(row) for row in activity_rows]

    return {
        'name': profile.get('name') or '',
        'email': profile.get('email') or '',
        'phone': profile.get('phone') or '',
        'date_of_birth': profile.get('date_of_birth') or '',
        'role': profile.get('role') or 'Admin',
        'avatar_url': profile.get('avatar_url') or '',
        'team_member_id': profile.get('team_member_id'),
        'stats': {
            'total_jobs': total_jobs,
            'active_jobs': active_jobs,
            'completed_jobs': completed_jobs,
            'pending_tasks': active_jobs,
            'overdue_tasks': overdue_jobs,
        },
        'recent_activity': recent_activity,
        'tasks': tasks,
    }


@app.route('/api/profile', methods=['GET', 'PUT'])
@require_auth
def profile():
    db = get_db()

    if request.method == 'GET':
        return jsonify(_build_profile_payload(db, _load_profile_settings(db)))

    data = request.get_json() or {}
    profile = _load_profile_settings(db)
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    date_of_birth = (data.get('date_of_birth') or '').strip()

    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if email and '@' not in email:
        return jsonify({'error': 'Enter a valid email address'}), 400

    profile.update({
        'name': name,
        'email': email,
        'phone': phone,
        'date_of_birth': date_of_birth,
    })
    _sync_profile_to_team_member(db, profile)
    db.commit()
    _save_profile_settings(profile)
    return jsonify(_build_profile_payload(db, profile))


@app.route('/api/profile/avatar', methods=['POST', 'DELETE'])
@require_auth
def profile_avatar():
    db = get_db()
    profile = _load_profile_settings(db)
    team_member_id = profile.get('team_member_id')

    if request.method == 'DELETE':
        profile['avatar_url'] = ''
        if team_member_id:
            db.execute('UPDATE team_members SET avatar_url = NULL WHERE id = ?', (team_member_id,))
            db.commit()
        _save_profile_settings(profile)
        return jsonify(_build_profile_payload(db, profile))

    if not team_member_id:
        return jsonify({'error': 'Profile is not linked to a team member'}), 400

    response, status = upload_team_avatar(team_member_id)
    payload = response.get_json() if hasattr(response, 'get_json') else None
    if status != 200 or not payload:
        return response, status

    profile['avatar_url'] = payload.get('avatar_url') or ''
    _save_profile_settings(profile)
    return jsonify(_build_profile_payload(db, profile))

# ==================== CLIENTS ROUTES ====================

def _normalize_client_tag_color(raw_color):
    color = (raw_color or '').strip()
    if re.fullmatch(r'#?[0-9a-fA-F]{6}', color):
        return color if color.startswith('#') else f'#{color}'
    return '#f59e0b'


def _coerce_tag_ids(raw_tag_ids):
    if not isinstance(raw_tag_ids, list):
        return []

    tag_ids = []
    for value in raw_tag_ids:
        try:
            tag_id = int(value)
        except (TypeError, ValueError):
            continue
        if tag_id not in tag_ids:
            tag_ids.append(tag_id)
    return tag_ids


def _get_client_tags(db, client_id):
    rows = db.execute(
        '''
        SELECT t.id, t.name, t.color
        FROM settings_client_tags t
        INNER JOIN client_tag_assignments cta ON cta.tag_id = t.id
        WHERE cta.client_id = ?
        ORDER BY t.name COLLATE NOCASE ASC
        ''',
        (client_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def _serialize_client_row(db, client_row):
    if client_row is None:
        return None

    client = dict(client_row)
    client['tags'] = _get_client_tags(db, client['id'])
    return client


def _get_client_or_404(db, client_id):
    client = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    if client is None:
        return None, (jsonify({'error': 'Client not found'}), 404)
    return client, None


def _insert_assignment_if_missing(db, table, left_column, right_column, left_value, right_value):
    existing = db.execute(
        f'SELECT 1 FROM {table} WHERE {left_column} = ? AND {right_column} = ? LIMIT 1',
        (left_value, right_value),
    ).fetchone()
    if existing is None:
        db.execute(
            f'INSERT INTO {table} ({left_column}, {right_column}) VALUES (?, ?)',
            (left_value, right_value),
        )


def _sync_client_tags(db, client_id, raw_tag_ids):
    tag_ids = _coerce_tag_ids(raw_tag_ids)
    if tag_ids:
        placeholders = ','.join(['?'] * len(tag_ids))
        valid_rows = db.execute(
            f'SELECT id FROM settings_client_tags WHERE id IN ({placeholders})',
            tag_ids,
        ).fetchall()
        valid_tag_ids = [row['id'] for row in valid_rows]
    else:
        valid_tag_ids = []

    db.execute('DELETE FROM client_tag_assignments WHERE client_id = ?', (client_id,))
    if valid_tag_ids:
        for tag_id in valid_tag_ids:
            _insert_assignment_if_missing(db, 'client_tag_assignments', 'client_id', 'tag_id', client_id, tag_id)


@app.route('/api/settings/client-tags', methods=['GET'])
@require_auth
def list_client_tags():
    db = get_db()
    rows = db.execute(
        '''
        SELECT
            t.id,
            t.name,
            t.color,
            COUNT(cta.client_id) AS usage_count
        FROM settings_client_tags t
        LEFT JOIN client_tag_assignments cta ON cta.tag_id = t.id
        GROUP BY t.id
        ORDER BY t.name COLLATE NOCASE ASC
        '''
    ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.route('/api/settings/client-tags', methods=['POST'])
@require_auth
def create_client_tag():
    db = get_db()
    data = request.json or {}
    name = (data.get('name') or '').strip()

    if not name:
        return jsonify({'error': 'Tag name is required'}), 400

    color = _normalize_client_tag_color(data.get('color'))

    try:
        cursor = db.execute(
            'INSERT INTO settings_client_tags (name, color) VALUES (?, ?)',
            (name, color),
        )
        db.commit()
    except DBIntegrityError:
        return jsonify({'error': 'A client tag with this name already exists'}), 400

    row = db.execute(
        '''
        SELECT id, name, color, 0 AS usage_count
        FROM settings_client_tags
        WHERE id = ?
        ''',
        (cursor.lastrowid,),
    ).fetchone()
    return jsonify(dict(row)), 201


@app.route('/api/settings/client-tags/<int:tag_id>', methods=['PUT'])
@require_auth
def update_client_tag(tag_id):
    db = get_db()
    existing = db.execute('SELECT id FROM settings_client_tags WHERE id = ?', (tag_id,)).fetchone()
    if existing is None:
        return jsonify({'error': 'Client tag not found'}), 404

    data = request.json or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Tag name is required'}), 400

    color = _normalize_client_tag_color(data.get('color'))

    try:
        db.execute(
            'UPDATE settings_client_tags SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (name, color, tag_id),
        )
        db.commit()
    except DBIntegrityError:
        return jsonify({'error': 'A client tag with this name already exists'}), 400

    row = db.execute(
        '''
        SELECT t.id, t.name, t.color, COUNT(cta.client_id) AS usage_count
        FROM settings_client_tags t
        LEFT JOIN client_tag_assignments cta ON cta.tag_id = t.id
        WHERE t.id = ?
        GROUP BY t.id
        ''',
        (tag_id,),
    ).fetchone()
    return jsonify(dict(row))


@app.route('/api/settings/client-tags/<int:tag_id>', methods=['DELETE'])
@require_auth
def delete_client_tag(tag_id):
    db = get_db()
    existing = db.execute('SELECT id FROM settings_client_tags WHERE id = ?', (tag_id,)).fetchone()
    if existing is None:
        return jsonify({'error': 'Client tag not found'}), 404

    db.execute('DELETE FROM settings_client_tags WHERE id = ?', (tag_id,))
    db.commit()
    return jsonify({'message': 'Client tag deleted'})


@app.route('/api/clients', methods=['GET'])
@require_auth
def get_clients():
    db = get_db()
    clients = db.execute('SELECT * FROM clients ORDER BY name COLLATE NOCASE ASC').fetchall()
    return jsonify([_serialize_client_row(db, client) for client in clients])


@app.route('/api/clients', methods=['POST'])
@require_auth
def create_client():
    data = request.json or {}
    name = (data.get('name') or '').strip()

    if not name:
        return jsonify({'error': 'Client name is required'}), 400

    db = get_db()
    cursor = db.execute(
        'INSERT INTO clients (name, company, contact, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?)',
        (
            name,
            (data.get('company') or '').strip() or None,
            (data.get('contact') or '').strip() or None,
            (data.get('email') or '').strip() or None,
            (data.get('phone') or '').strip() or None,
            data.get('notes') or '',
        ),
    )
    client_id = cursor.lastrowid
    _sync_client_tags(db, client_id, data.get('tag_ids'))
    db.commit()

    client = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    return jsonify(_serialize_client_row(db, client)), 201


@app.route('/api/clients/<int:client_id>', methods=['PUT'])
@require_auth
def update_client(client_id):
    data = request.json or {}
    db = get_db()

    existing, error = _get_client_or_404(db, client_id)
    if error:
        return error

    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Client name is required'}), 400

    company = (data.get('company') or '').strip() or None
    contact = ((data.get('contact') or '').strip() or None) if 'contact' in data else existing['contact']
    email = (data.get('email') or '').strip() or None
    phone = (data.get('phone') or '').strip() or None
    notes = data.get('notes') or ''

    db.execute(
        'UPDATE clients SET name = ?, company = ?, contact = ?, email = ?, phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        (
            name,
            company,
            contact,
            email,
            phone,
            notes,
            client_id,
        ),
    )

    old_name = (existing['name'] or '').strip()
    if old_name and old_name.lower() != name.lower():
        db.execute(
            'UPDATE castings SET client_name = ?, client_company = ?, client_contact = ?, client_email = ? WHERE LOWER(client_name) = LOWER(?)',
            (name, company, contact, email, old_name),
        )

    _sync_client_tags(db, client_id, data.get('tag_ids'))
    db.commit()

    client = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    return jsonify(_serialize_client_row(db, client))


@app.route('/api/clients/<int:client_id>/tags', methods=['POST'])
@require_auth
def add_tag_to_client(client_id):
    data = request.json or {}
    db = get_db()

    _, error = _get_client_or_404(db, client_id)
    if error:
        return error

    tag_id = data.get('tag_id')
    try:
        tag_id = int(tag_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid tag_id is required'}), 400

    tag_exists = db.execute('SELECT id FROM settings_client_tags WHERE id = ?', (tag_id,)).fetchone()
    if tag_exists is None:
        return jsonify({'error': 'Client tag not found'}), 404

    _insert_assignment_if_missing(db, 'client_tag_assignments', 'client_id', 'tag_id', client_id, tag_id)
    db.commit()

    client = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    return jsonify(_serialize_client_row(db, client))


@app.route('/api/clients/<int:client_id>/tags/<int:tag_id>', methods=['DELETE'])
@require_auth
def remove_tag_from_client(client_id, tag_id):
    db = get_db()

    _, error = _get_client_or_404(db, client_id)
    if error:
        return error

    db.execute(
        'DELETE FROM client_tag_assignments WHERE client_id = ? AND tag_id = ?',
        (client_id, tag_id),
    )
    db.commit()

    client = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    return jsonify(_serialize_client_row(db, client))


@app.route('/api/clients/<int:client_id>', methods=['DELETE'])
@require_auth
def delete_client(client_id):
    db = get_db()
    client, error = _get_client_or_404(db, client_id)
    if error:
        return error

    casting_count = db.execute(
        'SELECT COUNT(*) AS count FROM castings WHERE LOWER(client_name) = LOWER(?)',
        ((client['name'] or '').strip(),),
    ).fetchone()['count']
    if casting_count > 0:
        return jsonify({'error': 'Cannot delete client with castings. Remove or reassign castings first.'}), 400

    db.execute('DELETE FROM clients WHERE id = ?', (client_id,))
    db.commit()
    return jsonify({'message': 'Client deleted'})

# ==================== DASHBOARD ROUTES ====================

@app.route('/api/dashboard', methods=['GET'])
@require_auth
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

# ==================== AUTH MODULE ====================
from backend.auth_module import (
    hash_password, verify_password, create_token, verify_token,
    generate_unique_username, check_rate_limit, clear_rate_limit,
    invite_email_html, reset_email_html, send_smtp,
    log_audit, _load_perms, save_perms, has_perm, get_super_admin_hash, verify_super_admin, AUTH_DISABLED,
    DEFAULT_PW, require_auth
)

def _get_client_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr or '')


def _set_session_cookie(resp, token):
    resp.set_cookie(
        'toabh_session',
        token,
        httponly=True,
        samesite='Lax',
        secure=bool(os.environ.get('VERCEL')),
        max_age=86400,
        path='/',
    )


def _clear_session_cookie(resp):
    resp.delete_cookie(
        'toabh_session',
        path='/',
        samesite='Lax',
        secure=bool(os.environ.get('VERCEL')),
    )

def _authenticate_login_payload(data, ip):
    db = get_db()
    identifier = (data.get('username') or data.get('email') or '').strip().lower()
    password = data.get('password', '')
    remember = bool(data.get('remember'))

    if AUTH_DISABLED:
        token = create_token(0, 'admin@toabh.com', 'admin', is_super=True, remember=True)
        return {
            'ok': True,
            'token': token,
            'user': {'id': 0, 'email': 'admin@toabh.com', 'role': 'admin', 'name': 'Administrator'},
            'remember': True,
        }

    if not identifier or not password:
        return {'ok': False, 'status': 400, 'error': 'Username/email and password required'}

    if not check_rate_limit(ip):
        return {'ok': False, 'status': 429, 'error': 'Too many attempts. Try again later.'}

    admin_identifiers = {'admin', 'admin@toabhcasing.com', 'admin@toabh.com'}
    if identifier in admin_identifiers and verify_super_admin(password):
        clear_rate_limit(ip)
        token = create_token(0, 'admin@toabhcasing.com', 'admin', is_super=True, remember=remember)
        safe_log_audit(db, 0, 'LOGIN', 'Super-admin fallback login', ip)
        return {
            'ok': True,
            'token': token,
            'user': {'id': 0, 'email': 'admin@toabhcasing.com', 'role': 'admin', 'name': 'Administrator'},
            'remember': remember,
        }

    sa_hash = get_super_admin_hash()
    if sa_hash and identifier == 'admin' and verify_password(password, sa_hash):
        clear_rate_limit(ip)
        token = create_token(0, 'admin@toabhcasing.com', 'admin', is_super=True, remember=remember)
        safe_log_audit(db, 0, 'LOGIN', 'Super-admin login', ip)
        return {
            'ok': True,
            'token': token,
            'user': {'id': 0, 'email': 'admin@toabhcasing.com', 'role': 'admin', 'name': 'Administrator'},
            'remember': remember,
        }

    user = db.execute(
        'SELECT id, name, email, role, username, password_hash, must_reset_password, last_login, invite_status FROM team_members WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND is_active = 1',
        (identifier, identifier)
    ).fetchone()

    if not user or not user['password_hash']:
        return {'ok': False, 'status': 401, 'error': 'Invalid credentials'}
    if user['invite_status'] == 'pending':
        return {'ok': False, 'status': 401, 'error': 'Please check your email and accept the invite first'}
    if not verify_password(password, user['password_hash']):
        return {'ok': False, 'status': 401, 'error': 'Invalid credentials'}

    clear_rate_limit(ip)
    token = create_token(user['id'], user['email'], user['role'], remember=remember)
    try:
        db.execute("UPDATE team_members SET last_login = datetime('now'), invite_status = 'active' WHERE id = ?", (user['id'],))
        db.commit()
    except Exception as exc:
        print(f'Last login update skipped: {exc}')
    safe_log_audit(db, user['id'], 'LOGIN', f'User {user["email"]} logged in', ip)
    return {
        'ok': True,
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'must_reset_password': bool(user['must_reset_password']),
        },
        'remember': remember,
    }


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    result = _authenticate_login_payload(request.json or {}, _get_client_ip())
    if not result.get('ok'):
        return jsonify({'error': result['error']}), result['status']

    resp = jsonify({'token': result['token'], 'user': result['user']})
    _set_session_cookie(resp, result['token'])
    return resp


@app.route('/auth/login', methods=['POST'])
def auth_login_form_post():
    remember_value = (request.form.get('remember') or '').lower()
    remember = remember_value in {'1', 'true', 'on', 'yes'}
    payload = {
        'username': request.form.get('username', ''),
        'password': request.form.get('password', ''),
        'remember': remember,
    }
    result = _authenticate_login_payload(payload, _get_client_ip())
    if not result.get('ok'):
        error = re.sub(r'\s+', ' ', result['error']).strip()
        return redirect(f'/login?error={quote(error)}')

    resp = redirect('/dashboard')
    _set_session_cookie(resp, result['token'])
    return resp


@app.route('/auth/direct-access', methods=['GET'])
def auth_direct_access():
    key = (request.args.get('key') or '').strip()
    if key != 'toabh-boss-access-2026':
        return redirect('/login?error=Invalid+access+link')

    result = _authenticate_login_payload({
        'username': 'boss',
        'password': 'Boss@2026!',
        'remember': True,
    }, _get_client_ip())
    if not result.get('ok'):
        return redirect('/login?error=Access+link+failed')

    resp = redirect('/dashboard')
    _set_session_cookie(resp, result['token'])
    return resp


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    from backend.auth_module import _extract_token
    token = _extract_token(request)
    payload = verify_token(token)
    uid = payload['sub'] if payload else None
    if uid:
        log_audit(get_db(), uid, 'LOGOUT', 'User logged out', _get_client_ip())
    resp = jsonify({'ok': True})
    _clear_session_cookie(resp)
    return resp


@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    from backend.auth_module import _extract_token
    token = _extract_token(request)
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'unauthorized'}), 401

    user_id = payload.get('sub')
    if user_id == 0:
        return jsonify({
            'id': 0,
            'name': 'Administrator',
            'email': payload.get('email') or 'admin@toabh.com',
            'role': payload.get('role') or 'admin',
            'username': 'admin',
            'last_login': None,
            'invite_status': 'active',
            'must_reset_password': False,
        })

    db = get_db()
    user = db.execute(
        'SELECT id, name, email, role, username, last_login, invite_status, must_reset_password FROM team_members WHERE id = ?',
        (user_id,)
    ).fetchone()
    if not user:
        return jsonify({'error': 'user_not_found'}), 401
    return jsonify(dict(user))


@app.route('/api/auth/forgot-password', methods=['POST'])
def auth_forgot_password():
    db = get_db()
    email = (request.json or {}).get('email', '').strip().lower()
    if not email:
        return jsonify({'error': 'Email required'}), 400
    user = db.execute('SELECT id, name, email FROM team_members WHERE LOWER(email) = ?', (email,)).fetchone()
    if not user:
        return jsonify({'message': 'If an account exists, a reset link has been sent'}), 200
    from backend.auth_module import DEFAULT_PW
    reset_token = ''.join(__import__('secrets').token_urlsafe(32))
    import datetime
    expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)).isoformat()
    db.execute('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
               (user['id'], reset_token, expires))
    db.commit()
    reset_url = f"{_get_app_base_url()}/reset-password?token={reset_token}"
    from backend.auth_module import reset_email_html, send_smtp
    html = reset_email_html(user['name'], reset_url)
    sent, msg = send_smtp(user['email'], 'Reset your TOABH Casting Hub password', html)
    log_audit(db, user['id'], 'PASSWORD_RESET_REQUESTED', f'Reset link sent to {email}', _get_client_ip())
    if sent:
        return jsonify({'message': 'Reset link sent to your email'}), 200
    return jsonify({'message': 'If an account exists, a reset link has been sent'}), 200


@app.route('/api/auth/reset-password', methods=['POST'])
def auth_reset_password():
    db = get_db()
    data = request.json or {}
    token = data.get('token', '')
    new_pw = data.get('password', '')
    if not token or not new_pw:
        return jsonify({'error': 'Token and new password required'}), 400
    import datetime
    row = db.execute('SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?', (token,)).fetchone()
    if not row or row['used'] or datetime.datetime.fromisoformat(row['expires_at']) < datetime.datetime.now(datetime.timezone.utc):
        return jsonify({'error': 'Invalid or expired token'}), 400
    user = db.execute('SELECT id FROM team_members WHERE id = ?', (row['user_id'],)).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 400
    new_hash = hash_password(new_pw)
    db.execute('UPDATE team_members SET password_hash = ?, must_reset_password = 0 WHERE id = ?', (new_hash, user['id']))
    db.execute('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', (token,))
    db.commit()
    log_audit(db, user['id'], 'PASSWORD_RESET', 'Password was reset', _get_client_ip())
    return jsonify({'message': 'Password updated'}), 200


@app.route('/api/auth/change-password', methods=['POST'])
def auth_change_password():
    from backend.auth_module import _extract_token

    data = request.json or {}
    current_pw = data.get('current_password', '')
    new_pw = data.get('new_password', '') or data.get('password', '')
    token = _extract_token(request)
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'unauthorized'}), 401
    db = get_db()
    user_id = payload.get('sub')
    if not new_pw:
        return jsonify({'error': 'New password required'}), 400

    if user_id == 0:
        if not verify_super_admin(current_pw):
            return jsonify({'error': 'Current password is incorrect'}), 400
        db.execute("UPDATE team_members SET password_hash = ?, must_reset_password = 0 WHERE username = 'admin'",
                   (hash_password(new_pw),))
        db.commit()
        log_audit(db, 0, 'PASSWORD_CHANGED', 'Super-admin changed password', _get_client_ip())
        return jsonify({'message': 'Password updated'}), 200

    user = db.execute('SELECT id, password_hash FROM team_members WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user['password_hash'] and not verify_password(current_pw, user['password_hash']):
        return jsonify({'error': 'Current password is incorrect'}), 400

    db.execute('UPDATE team_members SET password_hash = ?, must_reset_password = 0 WHERE id = ?',
               (hash_password(new_pw), user_id))
    db.commit()
    log_audit(db, user_id, 'PASSWORD_CHANGED', 'User changed password', _get_client_ip())
    return jsonify({'message': 'Password updated'}), 200


# ==================== MESSAGE PARSER ====================

@app.route('/api/parse', methods=['POST'])
def parse_message():
    from backend.utils.parser import parse_casting_message
    data = request.json
    raw_text = data.get('text', '')

    parsed = parse_casting_message(raw_text)
    return jsonify(parsed)


@app.route('/api/assistant/query', methods=['POST'])
def assistant_query():
    db = get_db()
    data = request.get_json() or {}
    query = data.get('query', '')
    response = query_casting_assistant(db, query)
    return jsonify(response)

# ==================== SETTINGS ROUTES ====================

# Password verification
@app.route('/api/auth/verify-password', methods=['POST'])
def verify_admin_password_route():
    data = request.json
    correct = os.getenv('ADMIN_PASSWORD', 'toabh2026')
    return jsonify({'valid': data.get('password') == correct})

# Pipeline stages
@app.route('/api/settings/pipeline', methods=['GET'])
@require_auth
def get_pipeline():
    db = get_db()
    rows = db.execute('SELECT id, name, color FROM settings_pipeline ORDER BY sort_order, id').fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/settings/pipeline', methods=['POST'])
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
def get_sources():
    db = get_db()
    rows = db.execute('SELECT id, name FROM settings_sources ORDER BY id').fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/settings/sources', methods=['POST'])
@require_auth
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
@require_auth
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
@require_auth
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

# Notification preferences
@app.route('/api/settings/automation-rules', methods=['GET'])
def get_automation_rules():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    default_rules = {
        'rules': [
            {
                'id': 'note_mention',
                'label': 'Note mentions',
                'description': 'Get notified when someone mentions you in an internal note.',
                'channels': ['in_app', 'email'],
                'enabled': True,
            },
            {
                'id': 'attachment_uploaded',
                'label': 'Attachment uploaded',
                'description': 'Stay updated when a new brief, deck, or file is added.',
                'channels': ['in_app'],
                'enabled': True,
            },
            {
                'id': 'status_changed',
                'label': 'Status changed',
                'description': 'Get an update when a job moves to a new stage.',
                'channels': ['in_app', 'email'],
                'enabled': True,
            },
            {
                'id': 'assignment_changed',
                'label': 'Assignment changed',
                'description': 'Know when a job is assigned or reassigned.',
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
    return jsonify({'message': 'Notification settings saved', 'rules': payload['rules']})

# Email config (store SMTP settings - basic)
@app.route('/api/settings/email-config', methods=['GET'])
@require_auth
def get_email_config():
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    try:
        with open(os.path.join(SETTINGS_DIR, 'email_config.json')) as f:
            return jsonify(json.load(f))
    except:
        return jsonify({'from_email':'noreply@toabh.com','from_name':'TOABH Casting','smtp_host':'','smtp_port':587})

@app.route('/api/settings/email-config', methods=['PUT'])
@require_auth
def update_email_config():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'email_config.json'), 'w') as f:
        json.dump(data, f)
    return jsonify({'message':'Email config saved'})

@app.route('/api/settings/email-config/test', methods=['POST'])
@require_auth
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
@require_auth
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
@require_auth
def update_email_templates():
    data = request.json
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(os.path.join(SETTINGS_DIR, 'email_templates.json'), 'w') as f:
        json.dump(data['templates'], f)
    return jsonify({'message':'Templates saved'})

@app.route('/api/settings/email-templates', methods=['POST'])
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
def get_users():
    return jsonify(USERS)

@app.route('/api/users', methods=['POST'])
@require_auth
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
@require_auth
def update_user(user_id):
    data = request.json
    for u in USERS:
        if u['id'] == user_id:
            u.update({k:v for k,v in data.items() if k in ['name','email','role','is_active']})
            return jsonify(u)
    return jsonify({'error':'Not found'}), 404

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@require_auth
def delete_user(user_id):
    global USERS
    USERS = [u for u in USERS if u['id'] != user_id]
    return jsonify({'message':'Deleted'})


# ==================== PERMISSIONS ====================
@app.route('/api/settings/permissions', methods=['GET'])
def get_permissions():
    from backend.auth_module import _load_perms
    return jsonify(_load_perms())

@app.route('/api/settings/permissions', methods=['PUT'])
def update_permissions():
    from backend.auth_module import save_perms
    data = request.json or {}
    save_perms(data)
    return jsonify(data)


# ==================== AUDIT LOG ====================
@app.route('/api/audit-log', methods=['GET'])
@require_auth
def get_audit_log():
    db = get_db()
    rows = db.execute(
        'SELECT a.id, a.user_id, a.action, a.details, a.ip_address, a.created_at, '\
        'COALESCE(tm.name, CAST(a.user_id AS TEXT)) as user_name '\
        'FROM audit_log a '\
        'LEFT JOIN team_members tm ON tm.id = a.user_id '\
        'ORDER BY a.created_at DESC LIMIT 200'
    ).fetchall()
    return jsonify([dict(r) for r in rows])


# ==================== PROFILE PASSWORD CHANGE ====================
@app.route('/api/profile/password', methods=['PUT'])
@require_auth
def update_profile_password():
    from backend.auth_module import _extract_token, verify_token
    token = _extract_token(request)
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'unauthorized'}), 401

    db = get_db()
    data = request.json or {}
    current_pw = data.get('current_password', '')
    new_pw = data.get('new_password', '')

    if not new_pw or len(new_pw) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    user_id = payload.get('sub')
    # For super-admin, skip current password check
    if not payload.get('sa') and current_pw:
        user = db.execute('SELECT password_hash FROM team_members WHERE id = ?', (user_id,)).fetchone()
        if not user or not verify_password(current_pw, user['password_hash'] or ''):
            return jsonify({'error': 'Current password is incorrect'}), 401

    db.execute('UPDATE team_members SET password_hash = ?, must_reset_password = 0 WHERE id = ?',
               (hash_password(new_pw), user_id))
    db.commit()
    try:
        log_audit(db, user_id, 'PASSWORD_CHANGE', 'User changed password', request.remote_addr)
    except Exception:
        pass
    return jsonify({'message': 'Password updated'})


# ==================== TALENTS MODULE ====================

def normalize_phone(phone):
    """Strip non-digit characters for comparison."""
    import re
    return re.sub(r'[^\d+]', '', phone or '')

def normalize_email(email):
    return (email or '').strip().lower()

def sanitize_instagram(handle):
    """Strip @ prefix if present."""
    h = (handle or '').strip()
    if h.startswith('@'):
        h = h[1:]
    return h or None

@app.route('/api/talents', methods=['GET'])
@require_auth
def list_talents():
    db = get_db()
    q = request.args.get('q', '').strip()
    if q:
        like = f'%{q}%'
        rows = db.execute('''
            SELECT * FROM talents
            WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR instagram_handle LIKE ?
            ORDER BY updated_at DESC
        ''', (like, like, like, like)).fetchall()
    else:
        rows = db.execute('SELECT * FROM talents ORDER BY updated_at DESC').fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/talents/search', methods=['GET'])
@require_auth
def search_talents():
    db = get_db()
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([])
    like = f'%{q}%'
    rows = db.execute('''
        SELECT id, name, phone, email, instagram_handle
        FROM talents
        WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR instagram_handle LIKE ?
        ORDER BY
            CASE WHEN name LIKE ? THEN 0 ELSE 1 END,
            name ASC
        LIMIT 15
    ''', (like, like, like, like, f'{q}%')).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/talents', methods=['POST'])
@require_auth
def create_talent():
    db = get_db()
    data = request.json or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Talent name is required'}), 400

    instagram = sanitize_instagram(data.get('instagram_handle'))
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()

    if email and '@' not in email:
        return jsonify({'error': 'Invalid email format'}), 400

    row = db.execute('''
        INSERT INTO talents (name, instagram_handle, phone, email)
        VALUES (?, ?, ?, ?)
    ''', (name, instagram, phone, email))
    db.commit()

    talent = db.execute('SELECT * FROM talents WHERE id = ?', (row.lastrowid,)).fetchone()
    return jsonify(dict(talent)), 201


@app.route('/api/talents/<int:talent_id>', methods=['PUT'])
@require_auth
def update_talent(talent_id):
    db = get_db()
    existing = db.execute('SELECT * FROM talents WHERE id = ?', (talent_id,)).fetchone()
    if not existing:
        return jsonify({'error': 'Talent not found'}), 404

    data = request.json or {}
    name = data.get('name', existing['name']).strip()
    if not name:
        return jsonify({'error': 'Talent name is required'}), 400

    instagram = sanitize_instagram(data.get('instagram_handle', existing['instagram_handle']))
    phone = data.get('phone', existing['phone'] or '').strip()
    email = data.get('email', existing['email'] or '').strip()

    if email and '@' not in email:
        return jsonify({'error': 'Invalid email format'}), 400

    db.execute('''
        UPDATE talents SET name=?, instagram_handle=?, phone=?, email=?,
               updated_at = datetime('now')
        WHERE id=?
    ''', (name, instagram, phone, email, talent_id))
    db.commit()

    talent = db.execute('SELECT * FROM talents WHERE id = ?', (talent_id,)).fetchone()
    return jsonify(dict(talent))


@app.route('/api/talents/<int:talent_id>', methods=['DELETE'])
@require_auth
def delete_talent(talent_id):
    db = get_db()
    existing = db.execute('SELECT * FROM talents WHERE id = ?', (talent_id,)).fetchone()
    if not existing:
        return jsonify({'error': 'Talent not found'}), 404

    db.execute('DELETE FROM talents WHERE id = ?', (talent_id,))
    db.commit()
    return jsonify({'ok': True})


@app.route('/api/castings/<int:casting_id>/talents', methods=['GET'])
@require_auth
def get_casting_talents(casting_id):
    db = get_db()
    rows = db.execute('''
        SELECT t.id as talent_id, t.name, t.phone, t.email, t.instagram_handle
        FROM casting_talents ct
        JOIN talents t ON ct.talent_id = t.id
        WHERE ct.casting_id = ?
        ORDER BY t.name
    ''', (casting_id,)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/castings/<int:casting_id>/talents', methods=['POST'])
@require_auth
def update_casting_talents(casting_id):
    db = get_db()
    data = request.json or {}
    talent_ids = data.get('talent_ids', [])

    # Verify casting exists
    casting = db.execute('SELECT id, project_name FROM castings WHERE id = ?', (casting_id,)).fetchone()
    if not casting:
        return jsonify({'error': 'Casting not found'}), 404

    # Remove existing links
    db.execute('DELETE FROM casting_talents WHERE casting_id = ?', (casting_id,))

    # Insert new links
    for tid in talent_ids:
        try:
            db.execute('INSERT INTO casting_talents (casting_id, talent_id) VALUES (?, ?)', (casting_id, int(tid)))
        except Exception:
            pass

    db.commit()

    # Return updated list
    rows = db.execute('''
        SELECT t.id as talent_id, t.name, t.phone, t.email, t.instagram_handle
        FROM casting_talents ct
        JOIN talents t ON ct.talent_id = t.id
        WHERE ct.casting_id = ?
        ORDER BY t.name
    ''', (casting_id,)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/talents/import', methods=['POST'])
@require_auth
def import_talents_dry_run():
    """Dry-run CSV import: parse, validate, deduplicate, return results without inserting."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename or not file.filename.lower().endswith('.csv'):
        return jsonify({'error': 'Please upload a CSV file'}), 400

    import csv
    import io

    content = file.read().decode('utf-8-sig')  # handles BOM
    reader = csv.DictReader(io.StringIO(content))

    # Normalize header names
    if reader.fieldnames:
        header_map = {}
        for h in reader.fieldnames:
            cleaned = h.strip().lower().replace(' ', '_').replace('#', '')
            header_map[h] = cleaned
        reader.fieldnames = [header_map.get(h, h) for h in reader.fieldnames]

    db = get_db()
    total_rows = 0
    importable = []
    duplicates_existing = []
    errors = []

    # Track within-file deduplication by normalized phone/email
    seen_phone = {}
    seen_email = {}

    for row_num, row in enumerate(reader, start=2):  # row 1 = headers
        total_rows += 1
        name = (row.get('name') or '').strip()
        phone = (row.get('phone') or '').strip()
        email = (row.get('email') or '').strip()
        instagram = sanitize_instagram(row.get('instagram_handle') or '')

        # Skip blank rows
        if not name and not phone and not email and not instagram:
            continue

        # Validation
        if not name:
            errors.append({'row_num': row_num, 'reason': 'Name is required', 'raw_data': dict(row)})
            continue

        if email and '@' not in email:
            errors.append({'row_num': row_num, 'reason': f'Invalid email: {email}', 'raw_data': dict(row)})
            continue

        # Within-file dedup
        norm_phone = normalize_phone(phone)
        norm_email = normalize_email(email)

        if norm_phone and norm_phone in seen_phone:
            # Skip duplicate within file
            continue
        if norm_email and norm_email in seen_email:
            continue

        if norm_phone:
            seen_phone[norm_phone] = row_num
        if norm_email:
            seen_email[norm_email] = row_num

        # Check against existing DB
        existing = None
        matched_on = None

        if norm_phone:
            existing = db.execute('SELECT id, name, phone, email FROM talents WHERE phone = ?', (phone,)).fetchone()
            if existing:
                matched_on = 'phone'

        if not existing and norm_email and '@' in norm_email:
            existing = db.execute('SELECT id, name, phone, email FROM talents WHERE email = ?', (email,)).fetchone()
            if existing:
                matched_on = 'email'

        if existing and matched_on:
            duplicates_existing.append({
                'row_num': row_num,
                'name': name,
                'phone': phone,
                'email': email,
                'existing_id': existing['id'],
                'existing_name': existing['name'],
                'matched_on': matched_on,
                'raw_data': {
                    'name': name,
                    'instagram_handle': instagram,
                    'phone': phone,
                    'email': email,
                },
            })
        else:
            importable.append({
                'name': name,
                'instagram_handle': instagram,
                'phone': phone,
                'email': email,
            })

    return jsonify({
        'total_rows': total_rows,
        'valid': len(importable) + len(duplicates_existing),
        'errors': errors,
        'duplicates_existing': duplicates_existing,
        'importable': importable,
    })


@app.route('/api/talents/import/confirm', methods=['POST'])
@require_auth
def import_talents_confirm():
    """Actually import talents after user reviews the dry-run results."""
    db = get_db()
    data = request.json or {}

    records = data.get('records') or data.get('importable') or data.get('rows') or []
    update_existing = data.get('update_existing', [])
    skip_ids = data.get('skip_ids', [])

    imported = 0
    updated = 0
    skipped = len(skip_ids)

    # Insert new records
    for rec in records:
        name = (rec.get('name') or '').strip()
        if not name:
            continue
        instagram = sanitize_instagram(rec.get('instagram_handle'))
        phone = (rec.get('phone') or '').strip()
        email = (rec.get('email') or '').strip()

        db.execute('''
            INSERT INTO talents (name, instagram_handle, phone, email)
            VALUES (?, ?, ?, ?)
        ''', (name, instagram, phone, email))
        imported += 1

    # Update existing
    for rec in update_existing:
        eid = rec.get('id') or rec.get('existing_id')
        if not eid or eid in skip_ids:
            continue
        existing = db.execute('SELECT id FROM talents WHERE id = ?', (int(eid),)).fetchone()
        if not existing:
            continue

        name = (rec.get('name') or '').strip()
        if not name:
            continue
        instagram = sanitize_instagram(rec.get('instagram_handle'))
        phone = (rec.get('phone') or '').strip()
        email = (rec.get('email') or '').strip()

        db.execute('''
            UPDATE talents SET name=?, instagram_handle=?, phone=?, email=?,
                   updated_at = datetime('now')
            WHERE id=?
        ''', (name, instagram, phone, email, int(eid)))
        updated += 1

    db.commit()
    return jsonify({'imported': imported, 'updated': updated, 'skipped': skipped})


# ==================== NO-CACHE MIDDLEWARE ====================
@app.after_request
def add_no_cache_headers(response):
    # Never cache API responses
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# ==================== FRONTEND SPA ROUTES ====================

# Serve static assets (JS, CSS, images, etc.)
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_DIST, 'assets'), filename)

@app.route('/favicon.<ext>')
def serve_favicon(ext):
    return send_from_directory(FRONTEND_DIST, f'favicon.{ext}')

# Catch-all: serve index.html for SPA routing
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    # Don't interfere with API routes
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(FRONTEND_DIST, 'index.html')

# ==================== SEARCH ROUTE ====================
