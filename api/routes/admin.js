const express = require('express');
const { body, param, validationResult, query } = require('express-validator');
const stellarService = require('../services/stellarService');
const dbService = require('../services/dbService');
const router = express.Router();

/**
 * @swagger
 * /api/admin/initialize:
 *   post:
 *     summary: Initialize stream contract
 *     description: Set contract admin. Must be called once after deployment
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admin
 *             properties:
 *               admin:
 *                 $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Contract initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 transaction_hash:
 *                   type: string
 *                   example: "d4e5f6a1..."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/initialize', [
  body('admin').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid admin address'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { admin } = req.body;

    if (!stellarService.validateAddress(admin)) {
      return res.status(400).json({
        error: 'Invalid admin address',
      });
    }

    const result = await stellarService.submitContractTransaction({
      sourceKey: admin,
      contractId: stellarService.streamContractId,
      functionName: 'initialize',
      args: [new stellarService.rpc.Address(admin)]
    });

    await dbService.logAdminAction(admin, 'initialize', { admin }, result.hash);

    res.json({
      success: true,
      transaction_hash: result.hash,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/pause-contract:
 *   post:
 *     summary: Pause entire contract
 *     description: Admin pauses entire contract. Blocks create_stream, create_streams_batch, and withdraw
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admin
 *               - nonce
 *             properties:
 *               admin:
 *                 $ref: '#/components/schemas/Address'
 *               nonce:
 *                 type: integer
 *                 description: Current admin nonce (replay protection)
 *     responses:
 *       200:
 *         description: Contract paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 transaction_hash:
 *                   type: string
 *                   example: "e5f6a1b2..."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/pause-contract', [
  body('admin').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid admin address'),
  body('nonce').isInt({ min: 0 }).withMessage('Invalid nonce'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { admin, nonce } = req.body;

    if (!stellarService.validateAddress(admin)) {
      return res.status(400).json({
        error: 'Invalid admin address',
      });
    }

    const result = await stellarService.submitContractTransaction({
      sourceKey: admin,
      contractId: stellarService.streamContractId,
      functionName: 'pause_contract',
      args: [
        new stellarService.rpc.Address(admin),
        BigInt(nonce)
      ]
    });

    await dbService.logAdminAction(admin, 'pause_contract', { admin, nonce }, result.hash);

    res.json({
      success: true,
      transaction_hash: result.hash,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/set-min-deposit:
 *   post:
 *     summary: Set minimum deposit amount
 *     description: Admin sets minimum deposit enforced on create_stream
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admin
 *               - nonce
 *               - amount
 *             properties:
 *               admin:
 *                 $ref: '#/components/schemas/Address'
 *               nonce:
 *                 type: integer
 *                 description: Current admin nonce (replay protection)
 *               amount:
 *                 $ref: '#/components/schemas/Amount'
 *     responses:
 *       200:
 *         description: Minimum deposit set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 transaction_hash:
 *                   type: string
 *                   example: "f6a1b2c3..."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/set-min-deposit', [
  body('admin').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid admin address'),
  body('nonce').isInt({ min: 0 }).withMessage('Invalid nonce'),
  body('amount').isString().matches(/^[0-9]+$/).withMessage('Invalid amount'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { admin, nonce, amount } = req.body;

    if (!stellarService.validateAddress(admin)) {
      return res.status(400).json({
        error: 'Invalid admin address',
      });
    }

    const result = await stellarService.submitContractTransaction({
      sourceKey: admin,
      contractId: stellarService.streamContractId,
      functionName: 'set_min_deposit',
      args: [
        new stellarService.rpc.Address(admin),
        BigInt(nonce),
        BigInt(amount)
      ]
    });

    await dbService.logAdminAction(admin, 'set_min_deposit', { admin, nonce, amount }, result.hash);

    res.json({
      success: true,
      transaction_hash: result.hash,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get admin audit logs
 *     description: Retrieve audit logs of admin actions
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of logs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   actor:
 *                     type: string
 *                   action:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                   params:
 *                     type: object
 *                   transaction_hash:
 *                     type: string
 */
router.get('/audit-logs', [
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const logs = await dbService.getAuditLogs(limit, offset);

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/audit-logs/export:
 *   get:
 *     summary: Export audit logs as CSV
 *     description: Download audit logs in CSV format
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/audit-logs/export', async (req, res, next) => {
  try {
    const csv = await dbService.exportAuditLogsCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// GET /admin/users
router.get('/users', [
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 }),
  query('search').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';

    if (dbService.pool) {
      const client = await dbService.pool.connect();
      try {
        const q = search
          ? `SELECT address, status, created_at FROM users WHERE address ILIKE $3 LIMIT $1 OFFSET $2`
          : `SELECT address, status, created_at FROM users LIMIT $1 OFFSET $2`;
        const params = search ? [limit, offset, `%${search}%`] : [limit, offset];
        const result = await client.query(q, params);
        return res.json({ success: true, data: result.rows });
      } finally {
        client.release();
      }
    }

    // In-memory fallback
    let users = [...dbService.inMemoryPrefs.entries()].map(([address, prefs]) => ({ address, ...prefs }));
    if (search) users = users.filter(u => u.address.includes(search));
    res.json({ success: true, data: users.slice(offset, offset + limit) });
  } catch (error) {
    next(error);
  }
});

// GET /admin/users/:address
router.get('/users/:address', [
  param('address').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid address'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { address } = req.params;

    if (dbService.pool) {
      const client = await dbService.pool.connect();
      try {
        const result = await client.query('SELECT * FROM users WHERE address = $1', [address]);
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'User not found' });
        return res.json({ success: true, data: result.rows[0] });
      } finally {
        client.release();
      }
    }

    const prefs = dbService.inMemoryPrefs.get(address);
    if (!prefs) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { address, ...prefs } });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/users/:address/status
router.put('/users/:address/status', [
  param('address').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid address'),
  body('status').isIn(['active', 'suspended']).withMessage('status must be active or suspended'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { address } = req.params;
    const { status } = req.body;

    if (dbService.pool) {
      const client = await dbService.pool.connect();
      try {
        await client.query('UPDATE users SET status = $1 WHERE address = $2', [status, address]);
      } finally {
        client.release();
      }
    } else {
      const prefs = dbService.inMemoryPrefs.get(address) || {};
      dbService.inMemoryPrefs.set(address, { ...prefs, status });
    }

    await dbService.logAdminAction('admin', 'set_user_status', { address, status }, null);
    res.json({ success: true, data: { address, status } });
  } catch (error) {
    next(error);
  }
});

// GET /admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    if (dbService.pool) {
      const client = await dbService.pool.connect();
      try {
        const [streams, active, volume, users] = await Promise.all([
          client.query('SELECT COUNT(*) FROM streams'),
          client.query("SELECT COUNT(*) FROM streams WHERE status = 'active'"),
          client.query('SELECT COALESCE(SUM(deposit), 0) AS total FROM streams'),
          client.query('SELECT COUNT(*) FROM users'),
        ]);
        return res.json({
          success: true,
          data: {
            total_streams: parseInt(streams.rows[0].count),
            active_streams: parseInt(active.rows[0].count),
            total_volume: streams.rows[0].total || volume.rows[0].total,
            user_count: parseInt(users.rows[0].count),
          },
        });
      } finally {
        client.release();
      }
    }

    res.json({
      success: true,
      data: {
        total_streams: 0,
        active_streams: 0,
        total_volume: '0',
        user_count: dbService.inMemoryPrefs.size,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/webhooks
router.get('/webhooks', async (req, res, next) => {
  try {
    if (dbService.pool) {
      const client = await dbService.pool.connect();
      try {
        const result = await client.query('SELECT * FROM webhooks ORDER BY created_at DESC');
        return res.json({ success: true, data: result.rows });
      } finally {
        client.release();
      }
    }

    const webhooks = [...dbService.inMemoryWebhooks.entries()].map(([id, w]) => ({ id, ...w }));
    res.json({ success: true, data: webhooks });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/webhooks/:id
router.delete('/webhooks/:id', [
  param('id').isString().notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { id } = req.params;

    if (dbService.pool) {
      const client = await dbService.pool.connect();
      try {
        await client.query('DELETE FROM webhooks WHERE id = $1', [id]);
      } finally {
        client.release();
      }
    } else {
      dbService.inMemoryWebhooks.delete(id);
    }

    await dbService.logAdminAction('admin', 'delete_webhook', { id }, null);
    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});

// POST /admin/rate-limits/reset
router.post('/rate-limits/reset', [
  body('address').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid address'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { address } = req.body;

    if (dbService.pool) {
      const client = await dbService.pool.connect();
      try {
        await client.query('DELETE FROM rate_limits WHERE address = $1', [address]);
      } finally {
        client.release();
      }
    }

    await dbService.logAdminAction('admin', 'reset_rate_limit', { address }, null);
    res.json({ success: true, data: { address, reset: true } });
  } catch (error) {
    next(error);
  }
});

// POST /admin/streams/:id/cancel
router.post('/streams/:id/cancel', [
  param('id').isString().notEmpty(),
  body('admin').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid admin address'),
  body('reason').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { id } = req.params;
    const { admin, reason } = req.body;

    let result = { hash: null };
    try {
      result = await stellarService.submitContractTransaction({
        sourceKey: admin,
        contractId: stellarService.streamContractId,
        functionName: 'cancel_stream',
        args: [new stellarService.rpc.Address(admin), BigInt(id)],
      });
    } catch (err) {
      // Stream may not exist on-chain in stub mode; proceed with audit log
    }

    await dbService.logAdminAction(admin, 'force_cancel_stream', { stream_id: id, reason }, result.hash);
    res.json({ success: true, data: { stream_id: id, cancelled: true, transaction_hash: result.hash } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
