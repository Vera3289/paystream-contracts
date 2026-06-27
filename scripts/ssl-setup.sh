#!/bin/bash
# Initial Let's Encrypt certificate generation.
# Usage: ./scripts/ssl-setup.sh <domain> <email> [extra-domains...]
# Set STAGING=1 to use Let's Encrypt staging environment.
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <email> [extra-domains...]}"
EMAIL="${2:?Usage: $0 <domain> <email> [extra-domains...]}"
shift 2
STAGING="${STAGING:-0}"

DOMAIN_FLAGS="-d $DOMAIN"
for extra in "$@"; do
  DOMAIN_FLAGS="$DOMAIN_FLAGS -d $extra"
done

STAGING_FLAG=""
[ "$STAGING" = "1" ] && STAGING_FLAG="--staging" && echo "[INFO] Using Let's Encrypt staging"

echo "[INFO] Requesting certificate for $DOMAIN"
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    $STAGING_FLAG \
    $DOMAIN_FLAGS

echo "[INFO] Certificate issued. Reload nginx:"
echo "       docker compose exec nginx nginx -s reload"
