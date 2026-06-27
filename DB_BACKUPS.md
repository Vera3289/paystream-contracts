Database Backup and Restore

This documents the automated backup approach and scripts.

Overview
- Daily incremental backups: implemented as daily `pg_dump` custom-format dumps saved to `BACKUP_DIR` or uploaded to S3.
- Weekly full backups: rotate with retention policy (configure `BACKUP_RETENTION_DAYS`).
- 30-day retention: set `BACKUP_RETENTION_DAYS=30`.
- Backup verification: `scripts/db_restore_test.sh` restores the latest backup into a temporary Postgres container.
- Off-site storage: upload to S3 via `BACKUP_S3_BUCKET` and AWS credentials.
- Backup encryption: optional GPG recipient via `BACKUP_GPG_RECIPIENT`.

Required env vars/secrets for CI or production:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `PGPASSWORD` (or .pgpass)
- `BACKUP_S3_BUCKET` (if using S3)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (if using S3)
- `BACKUP_GPG_RECIPIENT` (optional)

How to run

```bash
scripts/db_backup.sh
scripts/db_restore_test.sh
```
