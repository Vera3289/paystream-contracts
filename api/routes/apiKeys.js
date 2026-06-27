// SPDX-License-Identifier: Apache-2.0
/**
 * API Key management routes (#594)
 *
 * POST   /api-keys           — generate a new key
 * GET    /api-keys           — list keys for authenticated user
 * POST   /api-keys/:id/rotate — rotate (revoke + re-issue)
 * DELETE /api-keys/:id       — revoke
 * GET    /api-keys/:id/usage — usage stats
 * GET    /admin/api-keys     — list all keys (admin)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const apiKeyService = require('../services/apiKeyService');
const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

/**
 * @swagger
 * /api-keys:
 *   post:
 *     summary: Generate a new API key
 *     tags: [API Keys]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               rateLimit:
 *                 type: object
 *                 properties:
 *                   windowMs: { type: integer }
 *                   max: { type: integer }
 *     responses:
 *       201:
 *         description: Key created — raw value shown once
 */
router.post('/', [
  body('name').isString().notEmpty().trim(),
  body('rateLimit.windowMs').optional().isInt({ min: 1000 }),
  body('rateLimit.max').optional().isInt({ min: 1 }),
], (req, res) => {
  if (!validate(req, res)) return;
  const ownerId = req.stellarAddress || req.apiKey || 'unknown';
  const { name, rateLimit } = req.body;
  const result = apiKeyService.createKey({ name, ownerId, rateLimit });
  res.status(201).json({ success: true, ...result, warning: 'Store this key securely — it will not be shown again.' });
});

/**
 * @swagger
 * /api-keys:
 *   get:
 *     summary: List API keys for authenticated user
 *     tags: [API Keys]
 *     responses:
 *       200:
 *         description: List of key metadata (no raw keys)
 */
router.get('/', (req, res) => {
  const ownerId = req.stellarAddress || req.apiKey || 'unknown';
  res.json({ success: true, keys: apiKeyService.listKeys(ownerId) });
});

/**
 * @swagger
 * /api-keys/{id}/rotate:
 *   post:
 *     summary: Rotate an API key (revoke old, issue new)
 *     tags: [API Keys]
 */
router.post('/:id/rotate', [
  param('id').isUUID(),
  body('currentKey').isString().notEmpty(),
], (req, res) => {
  if (!validate(req, res)) return;
  try {
    const result = apiKeyService.rotateKey(req.body.currentKey);
    res.json({ success: true, ...result, warning: 'Store this key securely — it will not be shown again.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api-keys/{id}:
 *   delete:
 *     summary: Revoke an API key
 *     tags: [API Keys]
 */
router.delete('/:id', [
  param('id').isUUID(),
], (req, res) => {
  if (!validate(req, res)) return;
  const revoked = apiKeyService.revokeById(req.params.id);
  if (!revoked) return res.status(404).json({ error: 'Key not found' });
  res.json({ success: true, message: 'Key revoked' });
});

/**
 * @swagger
 * /api-keys/{id}/usage:
 *   get:
 *     summary: Get usage stats for a key
 *     tags: [API Keys]
 */
router.get('/:id/usage', [
  param('id').isUUID(),
], (req, res) => {
  if (!validate(req, res)) return;
  const stats = apiKeyService.getUsage(req.params.id);
  if (!stats) return res.status(404).json({ error: 'Key not found' });
  res.json({ success: true, usage: stats });
});

module.exports = router;
