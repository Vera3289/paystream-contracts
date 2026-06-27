// SPDX-License-Identifier: Apache-2.0
/**
 * API Key Service (#594)
 *
 * In-memory store (replace backing with DB in production via dbService).
 * Provides: generation, validation, rate limiting per key, rotation, revocation, usage tracking.
 */

const crypto = require('crypto');

const KEY_PREFIX = 'psk_';
const DEFAULT_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 1000 }; // 1000 req / 15 min

// In-memory store — swap for DB-backed store in production
const keys = new Map();   // keyHash -> metadata
const usage = new Map();  // keyHash -> { count, windowStart }

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey() {
  return KEY_PREFIX + crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new API key.
 * @param {object} opts - { name, ownerId, rateLimit? }
 * @returns {{ key: string, id: string, createdAt: string }} — key is shown ONCE
 */
function createKey({ name, ownerId, rateLimit = DEFAULT_RATE_LIMIT }) {
  const raw = generateRawKey();
  const id = crypto.randomUUID();
  const hash = hashKey(raw);

  keys.set(hash, {
    id,
    name,
    ownerId,
    hash,
    rateLimit,
    revoked: false,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    rotatedFrom: null,
  });

  return { key: raw, id, createdAt: keys.get(hash).createdAt };
}

/**
 * Validate a raw API key. Returns metadata or null if invalid/revoked.
 */
function validateKey(raw) {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;
  const hash = hashKey(raw);
  const meta = keys.get(hash);
  if (!meta || meta.revoked) return null;
  // Update last used
  meta.lastUsedAt = new Date().toISOString();
  return meta;
}

/**
 * Check rate limit for a key hash. Returns true if allowed, false if exceeded.
 */
function checkRateLimit(hash) {
  const meta = keys.get(hash);
  if (!meta) return false;
  const { windowMs, max } = meta.rateLimit;
  const now = Date.now();
  let u = usage.get(hash);
  if (!u || now - u.windowStart > windowMs) {
    u = { count: 0, windowStart: now };
  }
  u.count += 1;
  usage.set(hash, u);
  return u.count <= max;
}

/**
 * Rotate a key: revoke old, create new with same metadata.
 * @param {string} rawOldKey
 * @returns {{ key: string, id: string }} new key (shown ONCE)
 */
function rotateKey(rawOldKey) {
  const hash = hashKey(rawOldKey);
  const meta = keys.get(hash);
  if (!meta || meta.revoked) throw new Error('Key not found or already revoked');

  // Revoke old
  meta.revoked = true;
  meta.revokedAt = new Date().toISOString();

  // Create replacement
  const raw = generateRawKey();
  const newHash = hashKey(raw);
  const id = crypto.randomUUID();
  keys.set(newHash, {
    id,
    name: meta.name,
    ownerId: meta.ownerId,
    hash: newHash,
    rateLimit: meta.rateLimit,
    revoked: false,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    rotatedFrom: meta.id,
  });

  return { key: raw, id };
}

/**
 * Revoke a key by its id (admin use).
 */
function revokeById(id) {
  for (const [, meta] of keys) {
    if (meta.id === id) {
      meta.revoked = true;
      meta.revokedAt = new Date().toISOString();
      return true;
    }
  }
  return false;
}

/**
 * List all keys for an owner (hashes + metadata, never raw key).
 */
function listKeys(ownerId) {
  const result = [];
  for (const [, meta] of keys) {
    if (meta.ownerId === ownerId) {
      const { hash: _h, ...safe } = meta; // strip hash from output
      result.push(safe);
    }
  }
  return result;
}

/**
 * Get usage stats for a key id.
 */
function getUsage(id) {
  for (const [hash, meta] of keys) {
    if (meta.id === id) {
      const u = usage.get(hash) || { count: 0, windowStart: null };
      return { id, count: u.count, windowStart: u.windowStart, lastUsedAt: meta.lastUsedAt };
    }
  }
  return null;
}

module.exports = { createKey, validateKey, checkRateLimit, rotateKey, revokeById, listKeys, getUsage, hashKey };
