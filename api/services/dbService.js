const { Pool } = require('pg');

let pool = null;
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  const poolSize = parseInt(process.env.DB_POOL_MAX || '10', 10);
  const idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10);
  pool = new Pool({
    connectionString: databaseUrl,
    max: poolSize,
    idleTimeoutMillis,
  });
}

// In-memory fallback stores
const inMemoryPrefs = new Map();
const inMemoryNotifications = new Map();
const inMemoryWebhooks = new Map();
const inMemoryAuditLogs = [];
let auditLogIdCounter = 1;

async function initializeAuditLogTable() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          actor VARCHAR(56) NOT NULL,
          action VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          params JSONB,
          transaction_hash VARCHAR(100)
        )
      `);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn(`[DbService] Failed to initialize audit_logs table: ${err.message}`);
  }
}

initializeAuditLogTable();

async function logAdminAction(actor, action, params, transactionHash) {
  const timestamp = new Date();
  
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query(
          'INSERT INTO audit_logs (actor, action, timestamp, params, transaction_hash) VALUES ($1, $2, $3, $4, $5)',
          [actor, action, timestamp, params, transactionHash]
        );
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn(`[DbService] Failed to write audit log to database: ${err.message}`);
      // Fallback to in-memory
      inMemoryAuditLogs.push({
        id: auditLogIdCounter++,
        actor,
        action,
        timestamp,
        params,
        transaction_hash: transactionHash
      });
    }
  } else {
    inMemoryAuditLogs.push({
      id: auditLogIdCounter++,
      actor,
      action,
      timestamp,
      params,
      transaction_hash: transactionHash
    });
  }
}

async function createAuditLog({ actor, action, entity_type, entity_id, before_state, after_state, metadata }) {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query(
          'INSERT INTO audit_logs (actor, action, entity_type, entity_id, before_state, after_state, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [actor, action, entity_type || null, entity_id || null,
           before_state ? JSON.stringify(before_state) : null,
           after_state ? JSON.stringify(after_state) : null,
           metadata ? JSON.stringify(metadata) : null]
        );
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn(`[DbService] Failed to write audit log: ${err.message}`);
    }
  }
  inMemoryAuditLogs.push({
    id: auditLogIdCounter++,
    actor, action, entity_type, entity_id, before_state, after_state, metadata,
    created_at: new Date(),
  });
}

async function getAuditLogs(limit = 100, offset = 0) {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        );
        return result.rows;
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn(`[DbService] Failed to read audit logs from database: ${err.message}`);
      return [...inMemoryAuditLogs].reverse().slice(offset, offset + limit);
    }
  } else {
    return [...inMemoryAuditLogs].reverse().slice(offset, offset + limit);
  }
}

async function exportAuditLogsCSV() {
  const logs = await getAuditLogs(100000, 0);
  const headers = ['id', 'actor', 'action', 'entity_type', 'entity_id', 'before_state', 'after_state', 'metadata', 'created_at'];
  const csvLines = [headers.join(',')];

  logs.forEach(log => {
    const values = [
      log.id,
      log.actor,
      log.action,
      log.entity_type || '',
      log.entity_id || '',
      log.before_state ? JSON.stringify(log.before_state).replace(/"/g, '""') : '',
      log.after_state ? JSON.stringify(log.after_state).replace(/"/g, '""') : '',
      log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '',
      (log.created_at || log.timestamp || new Date()).toISOString(),
    ];
    csvLines.push(values.map(v => `"${v}"`).join(','));
  });

  return csvLines.join('\n');
}

async function closePool() {
  if (pool) {
    await pool.end();
  }
}

/**
 * Delete all off-chain user data for a given Stellar address.
 */
async function deleteOffChainUserData(address) {
  const deletedPrefs = inMemoryPrefs.delete(address);
  const deletedNotifs = inMemoryNotifications.delete(address);
  const deletedWebhooks = inMemoryWebhooks.delete(address);
  
  let dbDeleted = false;

  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM user_preferences WHERE address = $1', [address]);
        await client.query('DELETE FROM user_notifications WHERE address = $1', [address]);
        await client.query('DELETE FROM notifications WHERE user_address = $1', [address]);
        await client.query('COMMIT');
        dbDeleted = true;
      } catch (err) {
        await client.query('ROLLBACK');
        console.warn(`[DbService] SQL deletion failed (tables might not exist): ${err.message}`);
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn(`[DbService] Database connection failed for deletion: ${err.message}`);
    }
  }

  return {
    success: true,
    deletedFromMemory: deletedPrefs || deletedNotifs || deletedWebhooks,
    deletedFromDb: dbDeleted,
  };
}

module.exports = {
  pool,
  closePool,
  inMemoryPrefs,
  inMemoryNotifications,
  inMemoryWebhooks,
  deleteOffChainUserData,
  logAdminAction,
  createAuditLog,
  getAuditLogs,
  exportAuditLogsCSV,
};
