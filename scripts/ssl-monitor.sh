#!/bin/bash
# Monitor certificate expiry. Exits 1 if cert expires within WARN_DAYS.
# Usage: ./scripts/ssl-monitor.sh <domain>
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"
WARN_DAYS="${WARN_DAYS:-14}"

EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

[ -z "$EXPIRY" ] && echo "ERROR: could not retrieve certificate for $DOMAIN" && exit 2

EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null \
  || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - $(date +%s)) / 86400 ))

echo "Certificate for $DOMAIN expires in $DAYS_LEFT days ($EXPIRY)"

if [ "$DAYS_LEFT" -le "$WARN_DAYS" ]; then
  echo "WARNING: certificate expires in $DAYS_LEFT days — run ssl-renew.sh"
  exit 1
fi
