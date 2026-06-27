const crypto = require('crypto');

const DEFAULTS = {
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
  baseDelayMs: 500,
  cooldownMultiplier: 2,
};

const state = {
  failures: new Map(),
  lockouts: new Map(),
};

function getIdentifier(req) {
  const address = req.body && req.body.address ? String(req.body.address) : '';
  return `${req.ip || 'unknown'}:${address}`;
}

function getFailureEntry(identifier) {
  return state.failures.get(identifier) || { count: 0, lastFailureAt: 0 };
}

function resetAuthRateLimitState() {
  state.failures.clear();
  state.lockouts.clear();
}

function recordFailure(identifier) {
  const entry = getFailureEntry(identifier);
  entry.count += 1;
  entry.lastFailureAt = Date.now();
  state.failures.set(identifier, entry);
  console.warn(`[auth-rate-limit] failure recorded for ${identifier} (attempt ${entry.count})`);
  return entry;
}

function createAuthRateLimiter(options = {}) {
  const config = { ...DEFAULTS, ...options };

  return function authRateLimiter(req, res, next) {
    const identifier = getIdentifier(req);
    const now = Date.now();
    const lockout = state.lockouts.get(identifier);

    if (lockout && lockout.expiresAt > now) {
      return res.status(429).json({
        error: 'Too many failed authentication attempts. Please try again later.',
        code: 'AUTH_RATE_LIMITED',
        retryAfterSeconds: Math.ceil((lockout.expiresAt - now) / 1000),
      });
    }

    if (lockout && lockout.expiresAt <= now) {
      state.lockouts.delete(identifier);
    }

    const failureEntry = getFailureEntry(identifier);
    if (failureEntry.count >= config.maxAttempts) {
      const lockoutUntil = now + config.lockoutMs;
      state.lockouts.set(identifier, { expiresAt: lockoutUntil });
      return res.status(429).json({
        error: 'Too many failed authentication attempts. Please try again later.',
        code: 'AUTH_RATE_LIMITED',
        retryAfterSeconds: Math.ceil(config.lockoutMs / 1000),
      });
    }

    const delayMs = config.baseDelayMs * Math.pow(config.cooldownMultiplier, failureEntry.count);
    if (delayMs > 0) {
      const start = Date.now();
      while (Date.now() - start < delayMs) {}
    }

    req.authRateLimit = { identifier, failureEntry };
    return next();
  };
}

function applyAuthFailure(req) {
  const identifier = req.authRateLimit && req.authRateLimit.identifier ? req.authRateLimit.identifier : getIdentifier(req);
  const entry = recordFailure(identifier);
  const lockoutMs = DEFAULTS.lockoutMs;
  if (entry.count >= DEFAULTS.maxAttempts) {
    state.lockouts.set(identifier, { expiresAt: Date.now() + lockoutMs });
    console.warn(`[auth-rate-limit] account locked for ${identifier}`);
  }
}

function resetAuthFailure(req) {
  const identifier = req.authRateLimit && req.authRateLimit.identifier ? req.authRateLimit.identifier : getIdentifier(req);
  resetAuthRateLimit(identifier);
}

function resetAuthRateLimit(identifier) {
  if (identifier) {
    state.failures.delete(identifier);
    state.lockouts.delete(identifier);
    console.info(`[auth-rate-limit] cleared state for ${identifier}`);
    return;
  }

  state.failures.clear();
  state.lockouts.clear();
  console.info('[auth-rate-limit] cleared all state');
}

module.exports = {
  createAuthRateLimiter,
  applyAuthFailure,
  resetAuthFailure,
  resetAuthRateLimitState,
  resetAuthRateLimit,
};
