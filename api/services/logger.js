// SPDX-License-Identifier: Apache-2.0
/**
 * Structured logging service (#560)
 *
 * Winston-based logger with:
 * - JSON format (structured)
 * - Multiple log levels (debug, info, warn, error)
 * - Daily file rotation with compression
 * - Console transport for dev
 * - Request ID (correlationId) propagation
 * - Performance metrics logging
 * - Full error stack traces
 */

const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Custom format: merge requestId/correlationId into every log entry
const addRequestId = winston.format((info) => {
  // requestId may be attached via child logger or passed directly
  return info;
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  addRequestId(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const rid = requestId ? ` [${requestId}]` : '';
    const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp}${rid} ${level}: ${message}${extra}`;
  })
);

const transports = [];

// Console transport (always on in non-test)
if (process.env.NODE_ENV !== 'test') {
  transports.push(new winston.transports.Console({
    level: LOG_LEVEL,
    format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
  }));
}

// Rotating file transport — all levels
transports.push(new winston.transports.DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'paystream-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: LOG_LEVEL,
  format: jsonFormat,
}));

// Separate error-only rotating file
transports.push(new winston.transports.DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'paystream-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: jsonFormat,
}));

const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  // Don't exit on uncaught exceptions — let graceful shutdown handle it
  exitOnError: false,
});

/**
 * Returns a child logger with requestId bound to every log entry.
 * Usage: const log = logger.child({ requestId: req.correlationId });
 */
logger.forRequest = (req) => logger.child({ requestId: req.correlationId || req.headers?.['x-correlation-id'] });

/**
 * Log performance metric: duration in ms for a named operation.
 */
logger.perf = (operation, durationMs, meta = {}) => {
  logger.info('perf', { operation, durationMs, ...meta });
};

module.exports = logger;
