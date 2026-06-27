#!/usr/bin/env bash
set -euo pipefail

# Simple Postgres backup script.
# Requires: PGPASSWORD or .pgpass, and either AWS CLI configured or local storage.

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-paystream}
DB_USER=${DB_USER:-postgres}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/paystream}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Starting backup to $BACKUP_FILE"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -b -v -f "$BACKUP_FILE" "$DB_NAME"

# Optional encryption with GPG (if BACKUP_GPG_RECIPIENT is set)
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "Encrypting backup for $BACKUP_GPG_RECIPIENT"
  gpg --yes --output "${BACKUP_FILE}.gpg" --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$BACKUP_FILE"
  rm -f "$BACKUP_FILE"
  BACKUP_FILE="${BACKUP_FILE}.gpg"
fi

echo "Backup completed: $BACKUP_FILE"

# Optional upload to S3 (requires AWS env vars and bucket)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "Uploading to s3://$BACKUP_S3_BUCKET/"
  aws s3 cp "$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/" --acl private
fi

# Cleanup old backups
if [ -n "${BACKUP_RETENTION_DAYS:-}" ]; then
  echo "Removing backups older than $BACKUP_RETENTION_DAYS days"
  find "$BACKUP_DIR" -type f -mtime +$BACKUP_RETENTION_DAYS -delete || true
fi
