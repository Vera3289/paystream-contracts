const { Pool } = require('pg');

const poolSize = parseInt(process.env.DB_POOL_MAX || '10', 10);
const idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolSize,
  idleTimeoutMillis,
});

// Graceful acquisition helper: returns client or null on exhaustion
async function acquireClient() {
  try {
    const client = await pool.connect();
    return client;
  } catch (err) {
    // Pool exhausted or connectivity error
    return null;
  }
}

module.exports = { pool, acquireClient };
