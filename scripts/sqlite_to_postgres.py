#!/usr/bin/env python3
import json
import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
load_dotenv(ROOT / '.env.staging.local')

SQLITE_DB = ROOT / 'backend' / 'castings.db'
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()

TABLES = [
    'team_members',
    'castings',
    'casting_assignments',
    'activities',
    'clients',
    'settings_client_tags',
    'client_tag_assignments',
    'settings_pipeline',
    'settings_sources',
    'tasks',
    'task_assignments',
    'task_activities',
    'task_comments',
    'talents',
    'casting_talents',
    'casting_attachments',
    'password_reset_tokens',
    'audit_log',
]

CREATE_SQL = {
    'team_members': '''
        CREATE TABLE IF NOT EXISTS team_members (
            id BIGINT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT,
            is_active INTEGER DEFAULT 1,
            email TEXT UNIQUE,
            phone TEXT,
            avatar_url TEXT,
            username TEXT,
            password_hash TEXT,
            must_reset_password INTEGER DEFAULT 0,
            invite_status TEXT DEFAULT 'invited',
            invite_sent_at TEXT,
            last_login TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''',
    'castings': '''
        CREATE TABLE IF NOT EXISTS castings (
            id BIGINT PRIMARY KEY,
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
            created_at TEXT,
            updated_at TEXT,
            custom_fields TEXT DEFAULT '{}'
        )
    ''',
    'casting_assignments': '''
        CREATE TABLE IF NOT EXISTS casting_assignments (
            casting_id BIGINT NOT NULL,
            team_member_id BIGINT NOT NULL,
            PRIMARY KEY (casting_id, team_member_id)
        )
    ''',
    'activities': '''
        CREATE TABLE IF NOT EXISTS activities (
            id BIGINT PRIMARY KEY,
            casting_id BIGINT,
            team_member_id BIGINT,
            action TEXT,
            details TEXT,
            timestamp TEXT
        )
    ''',
    'clients': '''
        CREATE TABLE IF NOT EXISTS clients (
            id BIGINT PRIMARY KEY,
            name TEXT NOT NULL,
            company TEXT,
            contact TEXT,
            email TEXT,
            phone TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    ''',
    'settings_client_tags': '''
        CREATE TABLE IF NOT EXISTS settings_client_tags (
            id BIGINT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    ''',
    'client_tag_assignments': '''
        CREATE TABLE IF NOT EXISTS client_tag_assignments (
            client_id BIGINT NOT NULL,
            tag_id BIGINT NOT NULL,
            PRIMARY KEY (client_id, tag_id)
        )
    ''',
    'settings_pipeline': '''
        CREATE TABLE IF NOT EXISTS settings_pipeline (
            id BIGINT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            sort_order INTEGER DEFAULT 0
        )
    ''',
    'settings_sources': '''
        CREATE TABLE IF NOT EXISTS settings_sources (
            id BIGINT PRIMARY KEY,
            name TEXT NOT NULL
        )
    ''',
    'tasks': '''
        CREATE TABLE IF NOT EXISTS tasks (
            id BIGINT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'Todo',
            due_date TEXT,
            priority TEXT DEFAULT 'Medium',
            custom_fields TEXT DEFAULT '{}',
            created_at TEXT,
            updated_at TEXT
        )
    ''',
    'task_assignments': '''
        CREATE TABLE IF NOT EXISTS task_assignments (
            task_id BIGINT NOT NULL,
            team_member_id BIGINT NOT NULL,
            PRIMARY KEY (task_id, team_member_id)
        )
    ''',
    'task_activities': '''
        CREATE TABLE IF NOT EXISTS task_activities (
            id BIGINT PRIMARY KEY,
            task_id BIGINT,
            team_member_id BIGINT,
            action TEXT,
            details TEXT,
            timestamp TEXT
        )
    ''',
    'task_comments': '''
        CREATE TABLE IF NOT EXISTS task_comments (
            id BIGINT PRIMARY KEY,
            task_id BIGINT,
            user_name TEXT,
            text TEXT,
            parent_id BIGINT,
            mentions TEXT,
            created_at TEXT
        )
    ''',
    'talents': '''
        CREATE TABLE IF NOT EXISTS talents (
            id BIGINT PRIMARY KEY,
            name TEXT NOT NULL,
            instagram_handle TEXT,
            phone TEXT,
            email TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    ''',
    'casting_talents': '''
        CREATE TABLE IF NOT EXISTS casting_talents (
            casting_id BIGINT NOT NULL,
            talent_id BIGINT NOT NULL,
            PRIMARY KEY (casting_id, talent_id)
        )
    ''',
    'casting_attachments': '''
        CREATE TABLE IF NOT EXISTS casting_attachments (
            id BIGINT PRIMARY KEY,
            casting_id BIGINT,
            original_filename TEXT,
            stored_filename TEXT,
            mime_type TEXT,
            file_size BIGINT,
            file_ext TEXT,
            created_at TEXT
        )
    ''',
    'password_reset_tokens': '''
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id BIGINT PRIMARY KEY,
            user_id BIGINT NOT NULL,
            token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT
        )
    ''',
    'audit_log': '''
        CREATE TABLE IF NOT EXISTS audit_log (
            id BIGINT PRIMARY KEY,
            user_id BIGINT,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at TEXT
        )
    ''',
}


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def main():
    if not DATABASE_URL:
        raise SystemExit('DATABASE_URL is required')
    if not SQLITE_DB.exists():
        raise SystemExit(f'SQLite DB not found: {SQLITE_DB}')

    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row

    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as pg_conn:
        with pg_conn.cursor() as cur:
            for table in TABLES:
                cur.execute(CREATE_SQL[table])
            pg_conn.commit()

            counts = {}
            for table in TABLES:
                rows = sqlite_conn.execute(f'SELECT * FROM {table}').fetchall()
                counts[table] = len(rows)
                if rows:
                    cur.execute(f'TRUNCATE TABLE {qident(table)} RESTART IDENTITY CASCADE')
                    cols = rows[0].keys()
                    placeholders = ', '.join(['%s'] * len(cols))
                    columns_sql = ', '.join(qident(c) for c in cols)
                    insert_sql = f'INSERT INTO {qident(table)} ({columns_sql}) VALUES ({placeholders})'
                    values = [[row[c] for c in cols] for row in rows]
                    cur.executemany(insert_sql, values)
                else:
                    cur.execute(f'TRUNCATE TABLE {qident(table)} RESTART IDENTITY CASCADE')
            pg_conn.commit()

            seq_tables = [
                'team_members','castings','activities','clients','settings_client_tags','settings_pipeline','settings_sources',
                'tasks','task_activities','task_comments','talents','casting_attachments','password_reset_tokens','audit_log'
            ]
            for table in seq_tables:
                cur.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 1), true)"
                )
            pg_conn.commit()

    print(json.dumps({'imported': counts}, indent=2))


if __name__ == '__main__':
    main()
