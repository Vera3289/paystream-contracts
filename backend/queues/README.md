Background jobs using BullMQ

Environment:
- `REDIS_URL` - Redis connection string (default: redis://127.0.0.1:6379)
- `BULL_DASHBOARD_PORT` - Port for the admin dashboard (default: 7357)

Scripts:
- `npm run queue:start` - starts the queue worker
- `npm run queue:dashboard` - starts the Bull Board dashboard

Usage:
- Add jobs by requiring `backend/queues/queue.js` and calling `addStreamJob(name, data, opts)`
