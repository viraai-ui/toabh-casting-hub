# Postgres Staging Cutover Checklist

## Required staging env

- `DATABASE_URL=<Neon Postgres URL>`
- `APP_BASE_URL=<staging app URL>` (still recommended, but backend invite/reset links now fall back to the current request origin if this is missing)
- frontend/API routing:
  - keep `VITE_API_URL` empty if staging frontend and API share the same Vercel project/origin
  - otherwise set `VITE_API_URL` to the real staging backend origin

Quick preflight:
- start from `.env.staging.example`
- `python3 scripts/check_staging_env.py`
- `python3 scripts/check_cutover_readiness.py`
- if parity has drifted, restore with `python3 scripts/restore_postgres_baseline.py`
- final all-in-one validation before cutover: `python3 scripts/final_migration_check.py`

## Cutover sequence

1. Initialize schema
   - `python3 scripts/init_postgres.py`
2. Import SQLite data into Postgres
   - `python3 scripts/sqlite_to_postgres.py`
3. Verify row-count parity
   - `python3 scripts/verify_postgres_counts.py`
4. Run full behavior validation
   - `python3 scripts/smoke_postgres_full.py`
   - alias: `python3 scripts/run_postgres_checks.py`
   - this now restores Postgres back to the SQLite-import baseline automatically after the suite
5. Deploy/start staging with `DATABASE_URL` enabled
6. Perform a quick live staging check for login, dashboard, castings, tasks, clients, settings

## Main remaining rollout risk

- runtime configuration at staging, not raw Postgres compatibility in the tested routes
- especially whether `VITE_API_URL` should stay blank for same-origin `/api` or be set explicitly
- `APP_BASE_URL` is still recommended so link generation is explicit and stable across proxies/background jobs, even though request-origin fallback now covers the common web request path
- avoid running mutation-style live smoke on a shared live environment until cleanup ownership is explicit, because those scripts create user-visible test rows
