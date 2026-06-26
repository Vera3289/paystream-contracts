// SPDX-License-Identifier: Apache-2.0
/**
 * Request logging middleware (#560)
 *
 * Logs every incoming request and outgoing response in structured JSON.
 * Attaches a per-request child logger to req.log for use in route handlers.
 */

const logger = require('../services/logger');
const { performance } = require('perf_hooks');

function requestLogger(req, res, next) {
  const start = performance.now();
  const log = logger.forRequest(req);
  req.log = log;

  log.info('request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.on('finish', () => {
    const durationMs = (performance.now() - start).toFixed(2);
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log[level]('response', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: parseFloat(durationMs),
    });
    logger.perf('http_request', parseFloat(durationMs), {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });

  next();
}

module.exports = requestLogger;
