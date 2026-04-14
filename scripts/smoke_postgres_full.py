#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = [
    'scripts/smoke_local_postgres.py',
    'scripts/smoke_postgres_extended.py',
    'scripts/smoke_postgres_cleanup.py',
    'scripts/smoke_postgres_settings_files.py',
    'scripts/smoke_postgres_auth_assistant.py',
    'scripts/smoke_postgres_uploads_reset.py',
]
RESET_SCRIPTS = [
    'scripts/init_postgres.py',
    'scripts/sqlite_to_postgres.py',
]


def run_script(script: str, env: dict[str, str], label: Optional[str] = None):
    started = time.time()
    title = label or script
    print(f'\n=== Running {title} ===', flush=True)
    subprocess.run([sys.executable, '-u', script], cwd=ROOT, env=env, check=True)
    elapsed = time.time() - started
    print(f'=== Passed {title} in {elapsed:.1f}s ===', flush=True)


def main():
    runtime_root = Path(tempfile.mkdtemp(prefix='toabh-pg-smoke-'))
    env = os.environ.copy()
    env['PYTHONPATH'] = str(ROOT)
    env['APP_RUNTIME_ROOT'] = str(runtime_root)

    try:
        for script in SCRIPTS:
            run_script(script, env)
        print('\nFull Postgres smoke passed.', flush=True)
    finally:
        for script in RESET_SCRIPTS:
            try:
                run_script(script, env, label=f'restore {script}')
            except Exception as exc:
                print(f'!!! Failed restore step {script}: {exc}', flush=True)
        shutil.rmtree(runtime_root, ignore_errors=True)


if __name__ == '__main__':
    main()
