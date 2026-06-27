#!/bin/bash
# Certificate renewal — run via cron, e.g.:
#   0 3 * * * /path/to/scripts/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1
set -euo pipefail

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Checking certificate renewal..."

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot renew \
    --webroot \
    --webroot-path=/var/www/certbot \
    --quiet \
    --deploy-hook "docker compose exec nginx nginx -s reload"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Renewal check complete."
