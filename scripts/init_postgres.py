#!/usr/bin/env python3
import os
from pathlib import Path

from dotenv import load_dotenv

from backend.db import connect, get_database_config
from backend.db_schema import POSTGRES_SCHEMA_SCRIPT

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
load_dotenv(ROOT / '.env.staging.local')

SQLITE_DB = ROOT / 'backend' / 'castings.db'


def main():
    config = get_database_config(str(SQLITE_DB))
    if not config.is_postgres:
        raise SystemExit('DATABASE_URL is required')

    conn = connect(config)
    try:
        conn.executescript(POSTGRES_SCHEMA_SCRIPT)
        conn.commit()
    finally:
        conn.close()

    print('Postgres schema initialized successfully.')


if __name__ == '__main__':
    main()
