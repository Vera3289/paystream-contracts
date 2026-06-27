#!/usr/bin/env bash
# scripts/deploy-rollback.sh — Automated rollback for PayStream blue-green deployments (#513)
#
# Usage:
#   ./scripts/deploy-rollback.sh [--dry-run]
#
# Required environment variables:
#   ACTIVE_SLOT       — current live slot: 'blue' or 'green'
#   PREV_IMAGE_TAG    — image tag to roll back to
#   HEALTH_URL        — health endpoint of the standby slot, e.g. http://blue.internal:3000
#
# Optional:
#   HEALTH_RETRIES    — number of health-check attempts (default: 10)
#   HEALTH_INTERVAL   — seconds between retries (default: 5)
#   DEPLOY_HISTORY    — path to deployment history file (default: deployment-history.json)
#   NOTIFICATION_URL  — webhook URL for Slack/Teams rollback alert (optional)
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] No changes will be applied."
fi

ACTIVE_SLOT="${ACTIVE_SLOT:?ACTIVE_SLOT must be set (blue or green)}"
PREV_IMAGE_TAG="${PREV_IMAGE_TAG:?PREV_IMAGE_TAG must be set}"
HEALTH_URL="${HEALTH_URL:?HEALTH_URL must be set}"
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
DEPLOY_HISTORY="${DEPLOY_HISTORY:-deployment-history.json}"

ROLLBACK_SLOT="$( [[ "$ACTIVE_SLOT" == "blue" ]] && echo "green" || echo "blue" )"

echo "==> Rollback: active slot='${ACTIVE_SLOT}', rolling back to slot='${ROLLBACK_SLOT}', image='${PREV_IMAGE_TAG}'"

# ---------------------------------------------------------------------------
# Step 1: Deploy previous image to the standby slot
# ---------------------------------------------------------------------------
echo "==> Step 1: Deploy '${PREV_IMAGE_TAG}' to standby slot '${ROLLBACK_SLOT}'"
if [[ "$DRY_RUN" == "false" ]]; then
  # Replace with your actual deploy command:
  # docker service update --image "paystream-api:${PREV_IMAGE_TAG}" "paystream-${ROLLBACK_SLOT}"
  # kubectl set image deployment/paystream-${ROLLBACK_SLOT} api=paystream-api:${PREV_IMAGE_TAG}
  echo "    [deploy] paystream-api:${PREV_IMAGE_TAG} → slot ${ROLLBACK_SLOT}"
fi

# ---------------------------------------------------------------------------
# Step 2: Health check on standby slot before switching traffic
# ---------------------------------------------------------------------------
echo "==> Step 2: Health check on ${HEALTH_URL}/health"
PASSED=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "    [dry-run] Skipping health check"
    PASSED=true
    break
  fi
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${HEALTH_URL}/health" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    echo "    Health check passed (attempt ${i})"
    PASSED=true
    break
  fi
  echo "    Attempt ${i}/${HEALTH_RETRIES}: HTTP ${STATUS} — retrying in ${HEALTH_INTERVAL}s..."
  sleep "$HEALTH_INTERVAL"
done

if [[ "$PASSED" == "false" ]]; then
  echo "ERROR: health check failed after ${HEALTH_RETRIES} attempts. Rollback aborted." >&2
  _notify "rollback_health_check_failed" "{\"slot\":\"${ROLLBACK_SLOT}\",\"image\":\"${PREV_IMAGE_TAG}\"}"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 3: Switch load-balancer traffic to standby slot
# ---------------------------------------------------------------------------
echo "==> Step 3: Switching traffic to slot '${ROLLBACK_SLOT}'"
if [[ "$DRY_RUN" == "false" ]]; then
  # Replace with your actual LB switch command:
  # aws elbv2 modify-listener --listener-arn "$LB_LISTENER_ARN" \
  #   --default-actions Type=forward,TargetGroupArn="$ROLLBACK_TARGET_GROUP_ARN"
  echo "    [lb-switch] → ${ROLLBACK_SLOT}"
fi

# ---------------------------------------------------------------------------
# Step 4: Record rollback in deployment history
# ---------------------------------------------------------------------------
echo "==> Step 4: Recording rollback in ${DEPLOY_HISTORY}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ENTRY="{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"rollback\",\"from_slot\":\"${ACTIVE_SLOT}\",\"to_slot\":\"${ROLLBACK_SLOT}\",\"image\":\"${PREV_IMAGE_TAG}\"}"
if [[ "$DRY_RUN" == "false" ]]; then
  if [[ -f "$DEPLOY_HISTORY" ]]; then
    # Append to array in existing JSON file
    python3 -c "
import json, sys
with open('${DEPLOY_HISTORY}') as f:
    history = json.load(f)
history.append(json.loads('${ENTRY}'))
with open('${DEPLOY_HISTORY}', 'w') as f:
    json.dump(history, f, indent=2)
" 2>/dev/null || echo "$ENTRY" >> "${DEPLOY_HISTORY}.log"
  else
    echo "[${ENTRY}]" > "$DEPLOY_HISTORY"
  fi
fi

# ---------------------------------------------------------------------------
# Step 5: Communicate rollback
# ---------------------------------------------------------------------------
_notify() {
  local event="$1"
  local payload="$2"
  if [[ -n "${NOTIFICATION_URL:-}" ]] && [[ "$DRY_RUN" == "false" ]]; then
    curl -sf -X POST -H 'Content-Type: application/json' \
      -d "{\"event\":\"${event}\",\"data\":${payload}}" \
      "$NOTIFICATION_URL" || true
  fi
}

_notify "rollback_complete" "{\"from_slot\":\"${ACTIVE_SLOT}\",\"to_slot\":\"${ROLLBACK_SLOT}\",\"image\":\"${PREV_IMAGE_TAG}\",\"timestamp\":\"${TIMESTAMP}\"}"
echo "==> Rollback complete. Active slot is now '${ROLLBACK_SLOT}' running '${PREV_IMAGE_TAG}'."
