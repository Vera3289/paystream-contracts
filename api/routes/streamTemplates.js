// SPDX-License-Identifier: Apache-2.0
/**
 * Stream Template routes (#596)
 *
 * POST   /stream-templates              — create template
 * POST   /stream-templates/from-stream  — save existing stream params as template
 * GET    /stream-templates              — list (own + shared + defaults)
 * GET    /stream-templates/:id          — get single template
 * PATCH  /stream-templates/:id          — update template
 * DELETE /stream-templates/:id          — delete template
 * POST   /stream-templates/:id/share    — toggle sharing
 * POST   /stream-templates/:id/create-stream — create stream from template
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const templateService = require('../services/templateService');
const stellarService = require('../services/stellarService');
const router = express.Router();

const STREAM_PARAMS = [
  body('params.token_address').isString().matches(/^[A-Z0-9]{56}$/).withMessage('Invalid token address'),
  body('params.deposit').isString().matches(/^[0-9]+$/).withMessage('Invalid deposit'),
  body('params.rate_per_second').isString().matches(/^[0-9]+$/).withMessage('Invalid rate_per_second'),
  body('params.stop_time').isInt({ min: 0 }),
  body('params.cooldown_period').isInt({ min: 0 }),
  body('params.cliff_time').isInt({ min: 0 }),
];

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

function ownerId(req) {
  return req.stellarAddress || req.apiKey || 'unknown';
}

/**
 * @swagger
 * /stream-templates:
 *   post:
 *     summary: Create a stream template
 *     tags: [Stream Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, params]
 *             properties:
 *               name: { type: string }
 *               shared: { type: boolean, default: false }
 *               params:
 *                 type: object
 *                 required: [token_address, deposit, rate_per_second, stop_time, cooldown_period, cliff_time]
 *     responses:
 *       201:
 *         description: Template created
 */
router.post('/', [
  body('name').isString().notEmpty().trim(),
  body('shared').optional().isBoolean(),
  ...STREAM_PARAMS,
], (req, res) => {
  if (!validate(req, res)) return;
  const tmpl = templateService.create({ ownerId: ownerId(req), name: req.body.name, params: req.body.params, shared: req.body.shared });
  res.status(201).json({ success: true, template: tmpl });
});

/**
 * @swagger
 * /stream-templates/from-stream:
 *   post:
 *     summary: Save stream parameters as a template
 *     tags: [Stream Templates]
 */
router.post('/from-stream', [
  body('name').isString().notEmpty().trim(),
  body('streamParams').isObject(),
  body('streamParams.token_address').isString(),
  body('streamParams.deposit').isString().matches(/^[0-9]+$/),
  body('streamParams.rate_per_second').isString().matches(/^[0-9]+$/),
], (req, res) => {
  if (!validate(req, res)) return;
  const tmpl = templateService.createFromStream(ownerId(req), req.body.name, req.body.streamParams);
  res.status(201).json({ success: true, template: tmpl });
});

/**
 * @swagger
 * /stream-templates:
 *   get:
 *     summary: List templates (own + shared + defaults)
 *     tags: [Stream Templates]
 *     responses:
 *       200:
 *         description: Array of templates
 */
router.get('/', (req, res) => {
  res.json({ success: true, templates: templateService.list(ownerId(req)) });
});

/**
 * @swagger
 * /stream-templates/{id}:
 *   get:
 *     summary: Get a single template
 *     tags: [Stream Templates]
 */
router.get('/:id', [param('id').isUUID()], (req, res) => {
  if (!validate(req, res)) return;
  const tmpl = templateService.get(req.params.id, ownerId(req));
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true, template: tmpl });
});

/**
 * @swagger
 * /stream-templates/{id}:
 *   patch:
 *     summary: Update a template
 *     tags: [Stream Templates]
 */
router.patch('/:id', [
  param('id').isUUID(),
  body('name').optional().isString().notEmpty().trim(),
  body('shared').optional().isBoolean(),
], (req, res) => {
  if (!validate(req, res)) return;
  const tmpl = templateService.update(req.params.id, ownerId(req), req.body);
  if (!tmpl) return res.status(404).json({ error: 'Template not found or not editable' });
  res.json({ success: true, template: tmpl });
});

/**
 * @swagger
 * /stream-templates/{id}:
 *   delete:
 *     summary: Delete a template
 *     tags: [Stream Templates]
 */
router.delete('/:id', [param('id').isUUID()], (req, res) => {
  if (!validate(req, res)) return;
  const deleted = templateService.remove(req.params.id, ownerId(req));
  if (!deleted) return res.status(404).json({ error: 'Template not found or not deletable' });
  res.json({ success: true, message: 'Template deleted' });
});

/**
 * @swagger
 * /stream-templates/{id}/share:
 *   post:
 *     summary: Toggle sharing of a template
 *     tags: [Stream Templates]
 */
router.post('/:id/share', [
  param('id').isUUID(),
  body('shared').isBoolean(),
], (req, res) => {
  if (!validate(req, res)) return;
  const tmpl = templateService.share(req.params.id, ownerId(req), req.body.shared);
  if (!tmpl) return res.status(404).json({ error: 'Template not found or not shareable' });
  res.json({ success: true, template: tmpl });
});

/**
 * @swagger
 * /stream-templates/{id}/create-stream:
 *   post:
 *     summary: Create a stream from a template
 *     tags: [Stream Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [employer, employee]
 *             properties:
 *               employer: { $ref: '#/components/schemas/Address' }
 *               employee: { $ref: '#/components/schemas/Address' }
 *               overrides:
 *                 type: object
 *                 description: Optional param overrides (e.g. deposit, rate_per_second)
 */
router.post('/:id/create-stream', [
  param('id').isUUID(),
  body('employer').isString().matches(/^G[A-Z0-9]{55}$/),
  body('employee').isString().matches(/^G[A-Z0-9]{55}$/),
  body('overrides').optional().isObject(),
], async (req, res, next) => {
  if (!validate(req, res)) return;
  try {
    const tmpl = templateService.get(req.params.id, ownerId(req));
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });

    const { employer, employee, overrides = {} } = req.body;
    const params = { ...tmpl.params, ...overrides };

    const result = await stellarService.submitContractTransaction({
      sourceKey: employer,
      contractId: stellarService.streamContractId,
      functionName: 'create_stream',
      args: [
        new stellarService.rpc.Address(employer),
        new stellarService.rpc.Address(employee),
        new stellarService.rpc.Address(params.token_address),
        BigInt(params.deposit),
        BigInt(params.rate_per_second),
        params.stop_time,
        params.cooldown_period,
        params.cliff_time,
      ],
    });

    res.status(201).json({ success: true, stream_id: result.result, transaction_hash: result.hash });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
