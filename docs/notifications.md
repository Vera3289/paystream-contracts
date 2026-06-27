# PayStream Notification Service

A lightweight Node.js service that watches Horizon for PayStream contract events and delivers webhook and/or email notifications to employers and employees.

## Features

- Polls Horizon for `created`, `withdraw`, `status`, `topup`, `paused`, and `resumed` events
- Sends a configurable HTTP webhook POST on each matching event
- Optionally sends email via SMTP
- Configurable event filter — watch only the events you care about
- Deployable as a standalone Node.js process or container

## Quick Start

```bash
cd services/notification
cp .env.example .env
# edit .env — set CONTRACT_ID and WEBHOOK_URL at minimum
npm install
npm start
```

## Configuration

All configuration is via environment variables (`.env` file supported).

| Variable          | Required | Default                                  | Description                                              |
|-------------------|----------|------------------------------------------|----------------------------------------------------------|
| `CONTRACT_ID`     | ✅        | —                                        | PayStream stream contract ID to watch                    |
| `HORIZON_URL`     |          | `https://horizon-testnet.stellar.org`    | Horizon server URL                                       |
| `WEBHOOK_URL`     |          | —                                        | HTTP endpoint to POST event payloads to                  |
| `SMTP_HOST`       |          | —                                        | SMTP server hostname (enables email if set)              |
| `SMTP_PORT`       |          | `587`                                    | SMTP port                                                |
| `SMTP_USER`       |          | —                                        | SMTP username                                            |
| `SMTP_PASS`       |          | —                                        | SMTP password                                            |
| `EMAIL_FROM`      |          | `notifications@paystream.example`        | Sender address for email notifications                   |
| `POLL_INTERVAL_MS`|          | `5000`                                   | Horizon polling interval in milliseconds                 |
| `WATCH_EVENTS`    |          | `created,withdraw,status`                | Comma-separated list of event types to watch             |

## Webhook Payload

Each event delivers a JSON POST body:

```json
{
  "type": "created",
  "streamId": "1",
  "employer": "G...EMPLOYER...",
  "employee": "G...EMPLOYEE...",
  "subject": "PayStream: New stream #1 created",
  "text": "Stream #1 created.\nEmployer: G...\nEmployee: G...\nRate: 10 tokens/s",
  "notifyAddresses": ["G...EMPLOYER...", "G...EMPLOYEE..."],
  "timestamp": "2026-04-29T09:00:00.000Z"
}
```

## Watched Events

| Event      | Triggered by              | Notifies              |
|------------|---------------------------|-----------------------|
| `created`  | `create_stream`           | employer + employee   |
| `withdraw` | `withdraw`                | employee              |
| `status`   | `cancel_stream`           | (webhook only)        |
| `topup`    | `top_up`                  | (webhook only)        |
| `paused`   | `pause_stream`            | (webhook only)        |
| `resumed`  | `resume_stream`           | (webhook only)        |

## Deployment

### As a process

```bash
npm start
```

### With Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY src ./src
CMD ["node", "src/index.js"]
```

```bash
docker build -t paystream-notifications .
docker run --env-file .env paystream-notifications
```

### With systemd

```ini
[Unit]
Description=PayStream Notification Service

[Service]
WorkingDirectory=/opt/paystream-notifications
ExecStart=/usr/bin/node src/index.js
EnvironmentFile=/opt/paystream-notifications/.env
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
