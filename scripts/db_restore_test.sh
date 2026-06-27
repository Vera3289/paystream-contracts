#!/usr/bin/env bash
set -euo pipefail

# Simple restore test: download latest backup (from BACKUP_DIR or S3) and attempt to restore into a temporary Postgres container.

BACKUP_DIR=${BACKUP_DIR:-/var/backups/paystream}
BACKUP_S3_BUCKET=${BACKUP_S3_BUCKET:-}
TMP_DB_NAME=${TMP_DB_NAME:-paystream_restore_test}

if [ -n "$BACKUP_S3_BUCKET" ]; then
  echo "Fetching latest backup from S3"
  LATEST=$(aws s3 ls s3://$BACKUP_S3_BUCKET/ | sort | tail -n1 | awk '{print $4}')
  aws s3 cp "s3://$BACKUP_S3_BUCKET/$LATEST" ./latest.dump
  BACKUP_FILE=./latest.dump
else
  BACKUP_FILE=$(ls -1t "$BACKUP_DIR"/* | head -n1)
fi

echo "Using backup $BACKUP_FILE"

docker run --rm --name pg-restore-test -e POSTGRES_PASSWORD=pass -d -p 5433:5432 postgres:15
sleep 5

PGPASSWORD=pass pg_restore -h 127.0.0.1 -p 5433 -U postgres -d postgres "$BACKUP_FILE"

echo "Restore test completed — data restored to local temporary Postgres on port 5433"
