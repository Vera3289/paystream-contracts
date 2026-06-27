# PayStream Backend (rate limiting example)

This small Express app demonstrates Redis-backed rate limiting per-IP (public endpoints) and per-wallet (write endpoints).

Environment

- `REDIS_URL` - Redis connection string (default: `redis://127.0.0.1:6379`)

Rules implemented

- Public endpoints: 100 req/min per IP
- Write endpoints: 30 req/min per wallet (header `X-Wallet-Address`)
- Responses on rate limit: `429` with `Retry-After` header (seconds)

Start

```bash
cd backend
npm install
npm start
```

Notes

- Uses `rate-limiter-flexible` with Redis to support multi-instance deployments.
- Adjust limits/durations in `middleware/rateLimiter.js`.
