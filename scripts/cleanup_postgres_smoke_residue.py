#!/usr/bin/env python3
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
load_dotenv(ROOT / '.env.staging.local')

DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()

if not DATABASE_URL:
    raise SystemExit('DATABASE_URL is required')

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM team_members WHERE username = 'resend' AND email LIKE 'resend%@example.com'")
        print(cur.rowcount)
    conn.commit()
