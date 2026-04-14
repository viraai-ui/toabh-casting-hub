#!/usr/bin/env python3
"""Compatibility wrapper for the canonical full Postgres smoke suite."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    target = ROOT / 'scripts' / 'smoke_postgres_full.py'
    print('run_postgres_checks.py is now a wrapper for scripts/smoke_postgres_full.py')
    subprocess.run([sys.executable, str(target)], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
