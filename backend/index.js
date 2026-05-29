const http = require('http');
const express = require('express');
const { createIpRateLimiter, createWalletRateLimiter, closeRedis } = require('./middleware/rateLimiter');
const { pool } = require('./db/pool');

const app = express();
app.use(express.json());

const ipLimiter = createIpRateLimiter();
const walletLimiter = createWalletRateLimiter();

// Public endpoint with per-IP limit
app.get('/public', ipLimiter.middleware, (req, res) => {
  res.json({ ok: true, from: 'public' });
});

// Write endpoint with per-wallet limit (requires X-Wallet-Address header)
app.post('/write', ipLimiter.middleware, walletLimiter.middleware, (req, res) => {
  res.json({ ok: true, wrote: true });
});

const port = process.env.PORT || 3000;
let server;
let isShuttingDown = false;

function stopServer() {
  return new Promise((resolve, reject) => {
    if (!server) {
      return resolve();
    }
    server.close((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`[Backend Shutdown] ${signal} received, draining connections`);

  const forceExit = setTimeout(() => {
    console.error('[Backend Shutdown] Force exiting after 30 seconds');
    process.exit(1);
  }, 30000);

  try {
    await stopServer();
    await pool.end();
    await closeRedis();
    console.log('[Backend Shutdown] DB and Redis connections closed');
  } catch (error) {
    console.error('[Backend Shutdown] Error during shutdown', error);
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server = http.createServer(app);
server.listen(port, () => console.log(`API listening on ${port}`));

module.exports = app;
