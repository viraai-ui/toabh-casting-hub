# TOABH Casting Hub, safe Postgres migration plan

## Goal
Move the app from ephemeral SQLite-on-Vercel to persistent Postgres with staging first, zero direct production overwrite, and rollback ready.

## Cheapest recommended option
- Neon Postgres, free tier
- Reason: $0 to start, proper persistent Postgres, easy connection string, suitable for this app size

## Safety rules
1. Never modify production first
2. Take verified backups before schema/data migration
3. Migrate into staging DB first
4. Compare row counts before any cutover
5. Verify key user flows in staging
6. Cut over only after approval
7. Keep old production deploy + SQLite backup for rollback

## Backups already prepared
- `migration_backups/castings-YYYYMMDD-HHMMSS.db`
- `migration_backups/castings-YYYYMMDD-HHMMSS.sql`
- `migration_backups/pre_migration_row_counts.json`

## Current SQLite row counts snapshot
- activities: 26
- audit_log: 9
- casting_assignments: 8
- casting_attachments: 0
- casting_talents: 1
- castings: 6
- client_tag_assignments: 5
- clients: 4
- password_reset_tokens: 0
- settings_client_tags: 4
- settings_pipeline: 6
- settings_sources: 8
- talents: 1
- task_activities: 5
- task_assignments: 1
- task_comments: 0
- tasks: 1
- team_members: 13

## Staging migration sequence
1. Create free Neon project and database
2. Add Postgres support in backend without removing SQLite fallback yet
3. Create staging environment variables only
4. Create Postgres schema in staging DB
5. Import SQLite data into staging DB
6. Compare row counts table-by-table
7. Verify staging app flows:
   - login/logout
   - dashboard loads
   - castings list and detail
   - clients
   - team
   - tasks
   - reports/settings basics
8. Only after approval, switch production env to Postgres
9. Re-verify on production
10. Keep rollback path to previous deployment + SQLite backup

## Rollback plan
If anything looks wrong after cutover:
1. revert deployment/env to previous SQLite-backed version immediately
2. keep Neon data untouched for inspection
3. restore from SQLite backup if needed
4. only retry after mismatch is explained

## What I need from Neon later
- one Postgres connection string for staging
- later, one Postgres connection string for production (can be same project, separate branches/dbs if desired)

## Next implementation tasks
- inspect backend DB access layer and abstract SQLite-specific SQL where needed
- add Postgres driver/config
- create migration/import script from SQLite to Postgres
- create verification script for row-count and spot checks
