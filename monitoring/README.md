# PayStream Monitoring

Prometheus + Grafana stack for off-chain PayStream infrastructure.

## Components

| Component | Port | Purpose |
|---|---|---|
| Prometheus | 9090 | Metrics collection and alerting |
| Grafana | 3001 | Dashboards |
| Alertmanager | 9093 | Alert routing (Slack / PagerDuty) |

## Quick Start

```bash
cd monitoring

# Required for production — change defaults
export GRAFANA_PASSWORD=your-secure-password
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
export PAGERDUTY_INTEGRATION_KEY=your-key

docker compose -f docker-compose.monitoring.yml up -d
```

Grafana is available at http://localhost:3001 (default login: `admin` / value of `GRAFANA_PASSWORD`).

## Scrape Targets

Configured in `prometheus.yml`:

- `stellar-node:11626` — Stellar node metrics
- `contract-indexer:8080` — PayStream contract indexer
- `paystream-api:3000` — PayStream API

Update hostnames to match your environment before deploying.

## Alerts

Defined in `alerts/paystream.rules.yml`:

| Alert | Condition | Severity |
|---|---|---|
| HighErrorRate | API 5xx > 5% over 5 min | critical |
| HighAPILatency | p95 latency > 2s over 5 min | warning |
| StreamCreationAnomaly | Rate deviates >3σ from 1h baseline | warning |
| LowContractBalance | Contract XLM balance < 10 | critical |
| IndexerDown | Indexer unreachable > 2 min | critical |

## Notification Channels

Set environment variables before starting the stack:

| Variable | Used by | Description |
|---|---|---|
| `SLACK_WEBHOOK_URL` | Alertmanager + Grafana | Incoming webhook URL |
| `PAGERDUTY_INTEGRATION_KEY` | Alertmanager | Events API v2 integration key |

## Validate Config (CI)

The `.github/workflows/monitoring-config-validate.yml` workflow checks both `prometheus.yml` and `alerts/paystream.rules.yml` on every PR that touches `monitoring/`.
