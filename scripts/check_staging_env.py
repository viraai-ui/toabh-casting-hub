#!/usr/bin/env python3
import json
import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

ROOT = Path(__file__).resolve().parent.parent
ENV_FILES = [ROOT / '.env', ROOT / '.env.staging.local']

for env_file in ENV_FILES:
    load_dotenv(env_file, override=False)

merged = {}
for env_file in ENV_FILES:
    merged.update({k: v for k, v in dotenv_values(env_file).items() if v is not None})

runtime = {k: os.environ.get(k, '') for k in [
    'DATABASE_URL',
    'APP_BASE_URL',
    'VITE_API_URL',
    'TOABH_BASE_URL',
    'VERCEL_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
]}

warnings = []
notes = []

if not runtime['DATABASE_URL']:
    warnings.append('DATABASE_URL is not set, staging will not use Postgres/Neon.')

if not runtime['APP_BASE_URL']:
    notes.append('APP_BASE_URL is not set. Normal web-request invite/reset flows can now fall back to the current request origin, but setting APP_BASE_URL is still recommended for explicit and stable link generation.')

if runtime['VITE_API_URL']:
    notes.append('VITE_API_URL is set explicitly, frontend will call that backend origin.')
else:
    notes.append('VITE_API_URL is blank, frontend expects same-origin /api routing.')

if runtime['TOABH_BASE_URL']:
    notes.append('TOABH_BASE_URL is set for live smoke scripts.')

result = {
    'env_files_checked': [str(p.name) for p in ENV_FILES],
    'values_present': {k: bool(v) for k, v in runtime.items()},
    'warnings': warnings,
    'notes': notes,
    'raw_hint': {
        'APP_BASE_URL': runtime['APP_BASE_URL'] or '',
        'VITE_API_URL': runtime['VITE_API_URL'] or '',
        'TOABH_BASE_URL': runtime['TOABH_BASE_URL'] or '',
    },
}

print(json.dumps(result, indent=2))

if warnings:
    raise SystemExit(1)
