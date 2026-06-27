const dbService = require('../services/dbService');

/**
 * Express middleware factory for audit logging.
 * Captures actor from req.stellarAddress, before/after state from res.locals.
 */
function auditLog(action, entityType) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const actor = req.stellarAddress || req.body?.employer || req.body?.employee || 'unknown';
      const entityId = req.params?.stream_id ? String(req.params.stream_id) : undefined;
      dbService.createAuditLog({
        actor,
        action,
        entity_type: entityType,
        entity_id: entityId,
        before_state: res.locals.beforeState || null,
        after_state: body || null,
        metadata: { method: req.method, path: req.path },
      }).catch((err) => console.warn('[auditLog] failed:', err.message));
      return originalJson(body);
    };
    next();
  };
}

module.exports = { auditLog };
