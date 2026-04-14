#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHECKS = [
    ('staging_env', 'scripts/check_staging_env.py'),
    ('postgres_parity', 'scripts/verify_postgres_counts.py'),
]


def run_check(name: str, script: str):
    proc = subprocess.run(
        [sys.executable, '-u', script],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    output = (proc.stdout or proc.stderr).strip()
    parsed = None
    try:
        parsed = json.loads(output) if output else None
    except Exception:
        parsed = None
    return {
        'name': name,
        'script': script,
        'ok': proc.returncode == 0,
        'code': proc.returncode,
        'output': parsed if parsed is not None else output,
    }


def main():
    results = [run_check(name, script) for name, script in CHECKS]
    ok = all(item['ok'] for item in results)
    payload = {
        'ready': ok,
        'checks': results,
    }
    print(json.dumps(payload, indent=2))
    if not ok:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
