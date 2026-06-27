const rateLimit = require('express-rate-limit');

const handler = (req, res) => {
  const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000) - Math.ceil(Date.now() / 1000);
  res.status(429).json({ error: 'Rate limit exceeded', retryAfter: retryAfter > 0 ? retryAfter : 60 });
};

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

const perUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.stellarAddress || req.ip,
  skip: (req) => req.isAdmin === true,
  handler,
});

module.exports = { globalLimiter, perUserLimiter };
