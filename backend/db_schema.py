POSTGRES_SCHEMA_SCRIPT = '''
CREATE TABLE IF NOT EXISTS castings (
    id BIGSERIAL PRIMARY KEY,
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
    budget_min DOUBLE PRECISION,
    budget_max DOUBLE PRECISION,
    requirements TEXT,
    apply_to TEXT,
    status TEXT DEFAULT 'NEW',
    priority TEXT DEFAULT 'NORMAL',
    custom_fields TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    id BIGSERIAL PRIMARY KEY,
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
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS casting_assignments (
    casting_id BIGINT,
    team_member_id BIGINT,
    PRIMARY KEY (casting_id, team_member_id),
    FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE,
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
    id BIGSERIAL PRIMARY KEY,
    casting_id BIGINT,
    team_member_id BIGINT,
    action TEXT,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE,
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
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
    id BIGSERIAL PRIMARY KEY,
    casting_id BIGINT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT DEFAULT 0,
    file_ext TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'Not Started',
    due_date TEXT,
    priority TEXT DEFAULT 'NORMAL',
    custom_fields TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_assignments (
    task_id BIGINT,
    team_member_id BIGINT,
    PRIMARY KEY (task_id, team_member_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_comments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    user_name TEXT,
    text TEXT,
    parent_id BIGINT,
    mentions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_activities (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    team_member_id BIGINT,
    action TEXT,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings_pipeline (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings_sources (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_client_tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#f59e0b',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_tag_assignments (
    client_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (client_id, tag_id),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES settings_client_tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS talents (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    instagram_handle TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS casting_talents (
    casting_id BIGINT NOT NULL,
    talent_id BIGINT NOT NULL,
    PRIMARY KEY (casting_id, talent_id),
    FOREIGN KEY (casting_id) REFERENCES castings(id) ON DELETE CASCADE,
    FOREIGN KEY (talent_id) REFERENCES talents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_talents_name ON talents(name);
CREATE INDEX IF NOT EXISTS idx_talents_phone ON talents(phone);
CREATE INDEX IF NOT EXISTS idx_talents_email ON talents(email);

CREATE SEQUENCE IF NOT EXISTS audit_log_id_seq;
ALTER TABLE audit_log ALTER COLUMN id SET DEFAULT nextval('audit_log_id_seq');
ALTER SEQUENCE audit_log_id_seq OWNED BY audit_log.id;
ALTER TABLE audit_log ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
SELECT setval('audit_log_id_seq', COALESCE((SELECT MAX(id) FROM audit_log), 1), true);

CREATE SEQUENCE IF NOT EXISTS password_reset_tokens_id_seq;
ALTER TABLE password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('password_reset_tokens_id_seq');
ALTER SEQUENCE password_reset_tokens_id_seq OWNED BY password_reset_tokens.id;
ALTER TABLE password_reset_tokens ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
SELECT setval('password_reset_tokens_id_seq', COALESCE((SELECT MAX(id) FROM password_reset_tokens), 1), true);

CREATE SEQUENCE IF NOT EXISTS casting_attachments_id_seq;
ALTER TABLE casting_attachments ALTER COLUMN id SET DEFAULT nextval('casting_attachments_id_seq');
ALTER SEQUENCE casting_attachments_id_seq OWNED BY casting_attachments.id;
ALTER TABLE casting_attachments ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
SELECT setval('casting_attachments_id_seq', COALESCE((SELECT MAX(id) FROM casting_attachments), 1), true);
'''
