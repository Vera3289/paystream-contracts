// SPDX-License-Identifier: Apache-2.0
/**
 * Stream Template Service (#596)
 *
 * In-memory store (replace with DB-backed store in production).
 * Supports: create, list, get, update, delete, share with team, default templates.
 */

const crypto = require('crypto');

// template: { id, ownerId, name, params, shared, isDefault, createdAt, updatedAt }
const templates = new Map();

// Built-in default templates seeded at module load
const DEFAULTS = [
  {
    name: 'Monthly Salary (USDC)',
    params: {
      token_address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      deposit: '2592000000000',          // 30 days × 86400s × 1 USDC/s in stroops
      rate_per_second: '1000000',        // 1 USDC/s (7 decimals)
      stop_time: 0,
      cooldown_period: 0,
      cliff_time: 0,
    },
  },
  {
    name: 'Weekly Contractor (USDC)',
    params: {
      token_address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      deposit: '604800000000',           // 7 days × 86400s × 1 USDC/s
      rate_per_second: '1000000',
      stop_time: 0,
      cooldown_period: 86400,            // 1-day cooldown
      cliff_time: 0,
    },
  },
];

for (const d of DEFAULTS) {
  const id = crypto.randomUUID();
  templates.set(id, {
    id,
    ownerId: 'system',
    name: d.name,
    params: d.params,
    shared: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function create({ ownerId, name, params, shared = false }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tmpl = { id, ownerId, name, params, shared, isDefault: false, createdAt: now, updatedAt: now };
  templates.set(id, tmpl);
  return tmpl;
}

function createFromStream(ownerId, name, streamParams) {
  // Strips runtime-only fields (employer/employee) — store only the reusable config
  const { employer: _e, employee: _emp, ...params } = streamParams;
  return create({ ownerId, name, params });
}

function list(ownerId) {
  const result = [];
  for (const [, t] of templates) {
    if (t.ownerId === ownerId || t.shared) result.push(t);
  }
  return result;
}

function get(id, ownerId) {
  const t = templates.get(id);
  if (!t) return null;
  if (t.ownerId !== ownerId && !t.shared) return null;
  return t;
}

function update(id, ownerId, patch) {
  const t = templates.get(id);
  if (!t) return null;
  if (t.ownerId !== ownerId || t.isDefault) return null;
  const allowed = ['name', 'params', 'shared'];
  for (const k of allowed) {
    if (patch[k] !== undefined) t[k] = patch[k];
  }
  t.updatedAt = new Date().toISOString();
  return t;
}

function remove(id, ownerId) {
  const t = templates.get(id);
  if (!t || t.ownerId !== ownerId || t.isDefault) return false;
  templates.delete(id);
  return true;
}

function share(id, ownerId, shared) {
  const t = templates.get(id);
  if (!t || t.ownerId !== ownerId || t.isDefault) return null;
  t.shared = shared;
  t.updatedAt = new Date().toISOString();
  return t;
}

module.exports = { create, createFromStream, list, get, update, remove, share };
