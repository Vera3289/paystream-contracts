const express = require('express');
const { resetAuthRateLimit } = require('../middleware/authRateLimiter');

const router = express.Router();

router.post('/unlock', (req, res) => {
  const identifier = req.body && req.body.identifier ? String(req.body.identifier) : '';
  if (!identifier) {
    return res.status(400).json({ error: 'identifier is required', code: 'IDENTIFIER_REQUIRED' });
  }

  resetAuthRateLimit(identifier);
  return res.json({ success: true, message: `Unlocked ${identifier}` });
});

module.exports = router;
