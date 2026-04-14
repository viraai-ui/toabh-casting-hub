#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = [
    'scripts/check_cutover_readiness.py',
    'scripts/smoke_postgres_full.py',
    'scripts/check_cutover_readiness.py',
]

env = dict(__import__('os').environ)
env['PYTHONPATH'] = str(ROOT)

for script in SCRIPTS:
    print(f'=== Running {script} ===', flush=True)
    subprocess.run([sys.executable, '-u', script], cwd=ROOT, env=env, check=True)

print('Final migration check passed.', flush=True)
