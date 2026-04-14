#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = [
    'scripts/init_postgres.py',
    'scripts/sqlite_to_postgres.py',
    'scripts/verify_postgres_counts.py',
]

env = dict(__import__('os').environ)
env['PYTHONPATH'] = str(ROOT)

for script in SCRIPTS:
    print(f'=== Running {script} ===', flush=True)
    subprocess.run([sys.executable, '-u', script], cwd=ROOT, env=env, check=True)

print('Postgres baseline restored and verified.', flush=True)
