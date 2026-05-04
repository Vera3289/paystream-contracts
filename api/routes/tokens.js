const express = require('express');
const { body, param, validationResult } = require('express-validator');
const stellarService = require('../services/stellarService');
const router = express.Router();

/**
 * @swagger
 * /api/tokens/total-supply:
 *   get:
 *     summary: Get total token supply
 *     description: Return the total token supply
 *     tags: [Tokens]
 *     responses:
 *       200:
 *         description: Total supply retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total_supply:
 *                   $ref: '#/components/schemas/Amount'
 */
router.get('/total-supply', async (req, res, next) => {
  try {
    const result = await stellarService.callContractMethod({
      contractId: stellarService.tokenContractId,
      functionName: 'total_supply',
      args: []
    });

    res.json({
      success: true,
      total_supply: result.toString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tokens/balance/{address}:
 *   get:
 *     summary: Get token balance of an address
 *     description: Return the token balance of an address
 *     tags: [Tokens]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 balance:
 *                   $ref: '#/components/schemas/Amount'
 */
router.get('/balance/:address', [
  param('address').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid address'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { address } = req.params;

    if (!stellarService.validateAddress(address)) {
      return res.status(400).json({
        error: 'Invalid address',
      });
    }

    const result = await stellarService.callContractMethod({
      contractId: stellarService.tokenContractId,
      functionName: 'balance',
      args: [new stellarService.rpc.Address(address)]
    });

    res.json({
      success: true,
      balance: result.toString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tokens/transfer:
 *   post:
 *     summary: Transfer tokens between addresses
 *     description: Transfer tokens from one address to another
 *     tags: [Tokens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from
 *               - to
 *               - amount
 *             properties:
 *               from:
 *                 $ref: '#/components/schemas/Address'
 *               to:
 *                 $ref: '#/components/schemas/Address'
 *               amount:
 *                 $ref: '#/components/schemas/Amount'
 *     responses:
 *       200:
 *         description: Transfer successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction_hash:
 *                   type: string
 */
router.post('/transfer', [
  body('from').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid from address'),
  body('to').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid to address'),
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

    const { from, to, amount } = req.body;

    if (!stellarService.validateAddress(from) || !stellarService.validateAddress(to)) {
      return res.status(400).json({
        error: 'Invalid addresses',
      });
    }

    const result = await stellarService.submitContractTransaction({
      sourceKey: from,
      contractId: stellarService.tokenContractId,
      functionName: 'transfer',
      args: [
        new stellarService.rpc.Address(from),
        new stellarService.rpc.Address(to),
        BigInt(amount)
      ]
    });

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
 * /api/tokens/mint:
 *   post:
 *     summary: Mint new tokens to an address
 *     description: Admin mints new tokens to an address, increasing total supply
 *     tags: [Tokens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admin
 *               - to
 *               - amount
 *             properties:
 *               admin:
 *                 $ref: '#/components/schemas/Address'
 *               to:
 *                 $ref: '#/components/schemas/Address'
 *               amount:
 *                 $ref: '#/components/schemas/Amount'
 *     responses:
 *       200:
 *         description: Mint successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction_hash:
 *                   type: string
 */
router.post('/mint', [
  body('admin').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid admin address'),
  body('to').isString().matches(/^G[A-Z0-9]{55}$/).withMessage('Invalid recipient address'),
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

    const { admin, to, amount } = req.body;

    if (!stellarService.validateAddress(admin) || !stellarService.validateAddress(to)) {
      return res.status(400).json({
        error: 'Invalid addresses',
      });
    }

    const result = await stellarService.submitContractTransaction({
      sourceKey: admin,
      contractId: stellarService.tokenContractId,
      functionName: 'mint',
      args: [
        new stellarService.rpc.Address(admin),
        new stellarService.rpc.Address(to),
        BigInt(amount)
      ]
    });

    res.json({
      success: true,
      transaction_hash: result.hash,
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
