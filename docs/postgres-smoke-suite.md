# Postgres Smoke Suite

Canonical entrypoint:
- `python3 scripts/smoke_postgres_full.py`
- after validation, this runner now restores Postgres back to the canonical SQLite-imported baseline automatically

Compatibility alias:
- `python3 scripts/run_postgres_checks.py`

## Coverage

1. `scripts/smoke_local_postgres.py`
   - admin login
   - dashboard/castings/team/tasks reads
   - core client, task, casting create/update flows
   - casting assignment and task comment/status flows

2. `scripts/smoke_postgres_extended.py`
   - settings client tags
   - sources
   - pipeline create/update/reorder
   - talents create/update
   - team toggle/resend invite

3. `scripts/smoke_postgres_cleanup.py`
   - delete and detach flows
   - client-tag attach/detach
   - casting/talent/client/tag cleanup

4. `scripts/smoke_postgres_settings_files.py`
   - profile update
   - custom fields
   - dashboard modules
   - automation rules
   - email config/templates
   - permissions, roles, task stages

5. `scripts/smoke_postgres_auth_assistant.py`
   - assistant query
   - parse route
   - verify password
   - forgot password
   - change password

6. `scripts/smoke_postgres_uploads_reset.py`
   - avatar upload/serve
   - casting attachment upload/list/serve
   - reset-password completion

## Safety notes

- Each smoke script now uses its own temporary `APP_RUNTIME_ROOT`.
- That keeps checked-in `backend/settings` and `backend/uploads` clean during validation.
- The suite validates app behavior against Postgres/Neon, not just row-count parity.
- The top-level full runner now restores Postgres with `scripts/init_postgres.py` + `scripts/sqlite_to_postgres.py` after the suite, so parity checks stay clean afterward.
- Do not run the live smoke scripts against shared production/staging casually, they create temporary records and can leave user-visible residue unless explicitly cleaned.
