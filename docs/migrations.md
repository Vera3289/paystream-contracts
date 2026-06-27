# Database Migrations

PayStream uses plain SQL migration files tracked in version control under `migrations/`.

## File Naming

```
<version>_<name>.sql       # forward migration
<version>_<name>.down.sql  # rollback migration
```

Example: `001_initial_schema.sql` / `001_initial_schema.down.sql`

Versions are zero-padded numbers (`001`, `002`, …). Applied migrations are recorded in the `migration_history` table so each version runs exactly once.

## Running Migrations

Set `DATABASE_URL` to your PostgreSQL connection string, then:

```bash
# Apply all pending migrations
DATABASE_URL=postgres://user:pass@host/db ./scripts/db/migrate.sh up

# Roll back all applied migrations (reverse order)
DATABASE_URL=postgres://user:pass@host/db ./scripts/db/migrate.sh down

# Preview pending migrations without applying them
DATABASE_URL=postgres://user:pass@host/db ./scripts/db/migrate.sh dry-run
```

## Creating a New Migration

1. Add `migrations/<next_version>_<name>.sql` with your DDL wrapped in `BEGIN; … COMMIT;`.
2. Add the matching `migrations/<next_version>_<name>.down.sql` to undo it.
3. Run `dry-run` to confirm it shows as pending, then `up` to apply.

## CI Integration

Add the following step after your service is healthy in CI:

```yaml
- name: Run migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: ./scripts/db/migrate.sh up
```

The runner is idempotent — re-running `up` on an already-migrated database is safe.
