# SSL/TLS Certificate Management

Automatic certificate generation and renewal via [Let's Encrypt](https://letsencrypt.org/) and `certbot`.

## Quick Start

```bash
# 1. Start the full stack with SSL
cp .env.dev.example .env
# Set DOMAIN and CERT_EMAIL in .env

docker compose -f docker-compose.dev.yml -f infra/ssl/docker-compose.ssl.yml up -d

# 2. Issue the initial certificate
STAGING=1 ./scripts/ssl-setup.sh api.paystream.example admin@paystream.example

# 3. Once staging cert works, issue production cert
./scripts/ssl-setup.sh api.paystream.example admin@paystream.example
```

## Multiple Domains (SAN)

Pass extra domains as additional arguments:

```bash
./scripts/ssl-setup.sh paystream.example admin@paystream.example \
  www.paystream.example \
  api.paystream.example
```

## Auto-Renewal

The `certbot` service in `docker-compose.ssl.yml` checks for renewal every 12 hours.
Let's Encrypt renews certificates with < 30 days remaining, so there is no downtime.

For host-level cron renewal instead:

```cron
0 3 * * * /path/to/scripts/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1
```

## Certificate Expiry Monitoring

```bash
# Exits 0 if > 14 days remain, exits 1 and prints warning otherwise
./scripts/ssl-monitor.sh api.paystream.example

# Custom threshold
WARN_DAYS=30 ./scripts/ssl-monitor.sh api.paystream.example
```

Integrate into your alerting pipeline (PagerDuty, Slack webhook, etc.) by checking the exit code.

## Security Headers

`infra/ssl/nginx.conf` sets the following headers on all HTTPS responses:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; ...` |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DOMAIN` | Primary domain for the certificate | — |
| `CERT_EMAIL` | Contact email for Let's Encrypt | — |
| `STAGING` | Set to `1` to use LE staging CA | `0` |
| `WARN_DAYS` | Days-before-expiry threshold for monitoring | `14` |

## Zero-Downtime Renewal

Renewal uses the **webroot** challenge — certbot writes a token to `/var/www/certbot`
which nginx serves over HTTP. nginx is never stopped; after renewal certbot triggers
`nginx -s reload` which reloads TLS certificates with zero dropped connections.
