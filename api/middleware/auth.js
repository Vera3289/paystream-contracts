// SPDX-License-Identifier: Apache-2.0
/**
 * Authentication Middleware
 *
 * 1. Bearer JWT (issued by POST /auth/verify)
 * 2. X-API-Key — validated via apiKeyService (#594) with per-key rate limiting
 */

const jwt = require('jsonwebtoken');
const apiKeyService = require('../services/apiKeyService');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-set-JWT_SECRET-in-env';

const authMiddleware = (req, res, next) => {
  // 1. Bearer JWT
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.stellarAddress = payload.sub;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired JWT', code: 'INVALID_JWT' });
    }
  }

  // 2. X-API-Key — validated + per-key rate limit
  const rawKey = req.header('X-API-Key');
  if (rawKey) {
    const meta = apiKeyService.validateKey(rawKey);
    if (!meta) {
      return res.status(401).json({ error: 'Invalid or revoked API key', code: 'INVALID_API_KEY' });
    }
    const hash = apiKeyService.hashKey(rawKey);
    if (!apiKeyService.checkRateLimit(hash)) {
      return res.status(429).json({ error: 'API key rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' });
    }
    req.apiKey = rawKey;
    req.apiKeyMeta = meta;
    return next();
  }

  return res.status(401).json({
    error: 'Authentication required. Use Bearer <jwt> or X-API-Key header.',
    code: 'MISSING_AUTH',
  });
};

module.exports = authMiddleware;
module.exports.JWT_SECRET = JWT_SECRET;
