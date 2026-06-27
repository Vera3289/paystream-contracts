#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
MIGRATIONS_DIR="$(dirname "$0")/../../migrations"
COMMAND="${1:-up}"

[[ -z "$DATABASE_URL" ]] && { echo "DATABASE_URL is required"; exit 1; }

psql() { command psql "$DATABASE_URL" "$@"; }

ensure_history_table() {
  psql -c "CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    version VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );"
}

get_applied() {
  psql -t -c "SELECT version FROM migration_history ORDER BY version;" | tr -d ' '
}

apply_migration() {
  local file="$1" version="$2" name="$3"
  echo "Applying migration $version: $name"
  psql -f "$file"
  psql -c "INSERT INTO migration_history (version, name) VALUES ('$version', '$name') ON CONFLICT DO NOTHING;"
}

rollback_migration() {
  local file="$1" version="$2" name="$3"
  echo "Rolling back migration $version: $name"
  psql -f "$file"
  psql -c "DELETE FROM migration_history WHERE version='$version';"
}

case "$COMMAND" in
  up)
    ensure_history_table
    applied=$(get_applied)
    for f in "$MIGRATIONS_DIR"/*.sql; do
      [[ "$f" == *.down.sql ]] && continue
      version=$(basename "$f" | cut -d_ -f1)
      name=$(basename "$f" .sql)
      echo "$applied" | grep -qx "$version" || apply_migration "$f" "$version" "$name"
    done
    echo "Migrations complete."
    ;;
  down)
    ensure_history_table
    applied=$(get_applied)
    for f in $(ls "$MIGRATIONS_DIR"/*.down.sql | sort -r); do
      version=$(basename "$f" | cut -d_ -f1)
      name=$(basename "$f" .down.sql)
      echo "$applied" | grep -qx "$version" && rollback_migration "$f" "$version" "$name" || true
    done
    echo "Rollback complete."
    ;;
  dry-run)
    ensure_history_table
    applied=$(get_applied)
    echo "Pending migrations:"
    for f in "$MIGRATIONS_DIR"/*.sql; do
      [[ "$f" == *.down.sql ]] && continue
      version=$(basename "$f" | cut -d_ -f1)
      name=$(basename "$f" .sql)
      echo "$applied" | grep -qx "$version" || echo "  PENDING: $name"
    done
    ;;
  *)
    echo "Usage: $0 [up|down|dry-run]"
    exit 1
    ;;
esac
