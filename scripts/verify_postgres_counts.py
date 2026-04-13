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
    'activities','audit_log','casting_assignments','casting_attachments','casting_talents','castings',
    'client_tag_assignments','clients','password_reset_tokens','settings_client_tags','settings_pipeline',
    'settings_sources','talents','task_activities','task_assignments','task_comments','tasks','team_members'
]


def main():
    if not DATABASE_URL:
        raise SystemExit('DATABASE_URL is required')
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    pg_counts = {}
    sqlite_counts = {}
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as pg_conn:
        with pg_conn.cursor() as cur:
            for table in TABLES:
                sqlite_counts[table] = sqlite_conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                cur.execute(f'SELECT COUNT(*) AS count FROM "{table}"')
                pg_counts[table] = cur.fetchone()['count']
    result = {
        'sqlite': sqlite_counts,
        'postgres': pg_counts,
        'match': sqlite_counts == pg_counts,
    }
    print(json.dumps(result, indent=2))
    if not result['match']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
