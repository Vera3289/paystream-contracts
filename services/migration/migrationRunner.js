// SPDX-License-Identifier: Apache-2.0
// Data Migration Framework for PayStream (#505)
// Supports versioned contract-to-contract stream data migration with
// validation, rollback, audit trail, user notifications, and zero-downtime.

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * MigrationRunner executes versioned migrations with before/after validation,
 * rollback capability, and an append-only audit log.
 */
class MigrationRunner {
  /**
   * @param {object} opts
   * @param {object} opts.db         - DB client with query(sql, params) → { rows }
   * @param {object} [opts.notifier] - optional notifier with notify(event, data)
   * @param {string} [opts.auditLog] - path for file-based audit log (fallback when no DB)
   */
  constructor({ db, notifier, auditLog } = {}) {
    this.db = db;
    this.notifier = notifier;
    this.auditLogPath = auditLog || path.join(process.cwd(), 'migration-audit.log');
    this._migrations = new Map(); // version → { up, down, validate }
  }

  /** Register a migration step. */
  register({ version, description, up, down, validate }) {
    if (this._migrations.has(version)) {
      throw new Error(`Migration version ${version} already registered`);
    }
    this._migrations.set(version, { version, description, up, down, validate });
  }

  /** Return sorted registered versions. */
  _sortedVersions() {
    return Array.from(this._migrations.keys()).sort();
  }

  /** Ensure the audit/state table exists. */
  async _ensureTable() {
    if (!this.db) return;
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id          BIGSERIAL PRIMARY KEY,
        version     TEXT        NOT NULL,
        description TEXT,
        direction   TEXT        NOT NULL CHECK (direction IN ('up','down')),
        status      TEXT        NOT NULL CHECK (status IN ('started','success','failed','rolled_back')),
        error       TEXT,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  /** Return the set of versions that have been successfully applied. */
  async _appliedVersions() {
    if (!this.db) return new Set();
    const { rows } = await this.db.query(`
      SELECT DISTINCT version FROM migration_history
      WHERE direction = 'up' AND status = 'success'
      AND version NOT IN (
        SELECT version FROM migration_history WHERE direction = 'down' AND status = 'success'
      )
    `);
    return new Set(rows.map((r) => r.version));
  }

  /** Append an entry to the audit log (DB + file). */
  async _audit(entry) {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });

    // File-based audit trail (always written)
    try {
      fs.appendFileSync(this.auditLogPath, line + '\n');
    } catch (_) { /* non-fatal */ }

    // DB audit trail
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO migration_history (version, description, direction, status, error)
           VALUES ($1, $2, $3, $4, $5)`,
          [entry.version, entry.description || null, entry.direction, entry.status, entry.error || null]
        );
      } catch (_) { /* non-fatal audit failure should not abort migration */ }
    }
  }

  /** Validate stream data integrity before/after migration. */
  async _runValidate(migration, streams, label) {
    if (!migration.validate) return { ok: true };
    const result = await migration.validate(streams);
    if (!result.ok) {
      const msg = `Validation ${label} failed for v${migration.version}: ${result.reason}`;
      await this._audit({ version: migration.version, direction: 'validation', status: 'failed', error: msg });
      throw new Error(msg);
    }
    return result;
  }

  /**
   * Run all pending migrations (up direction).
   * @param {Array} streams - current stream data to migrate
   * @returns {Array} migrated streams
   */
  async migrate(streams) {
    await this._ensureTable();
    const applied = await this._appliedVersions();
    const pending = this._sortedVersions().filter((v) => !applied.has(v));

    if (pending.length === 0) {
      console.log('[migration] Nothing to migrate.');
      return streams;
    }

    let current = streams;

    for (const version of pending) {
      const mig = this._migrations.get(version);
      console.log(`[migration] Running v${version}: ${mig.description}`);

      // Before validation
      await this._runValidate(mig, current, 'before');

      await this._audit({ version, description: mig.description, direction: 'up', status: 'started' });
      this.notifier?.notify('migration_started', { version, description: mig.description });

      let migrated;
      try {
        migrated = await mig.up(current);
      } catch (err) {
        await this._audit({ version, description: mig.description, direction: 'up', status: 'failed', error: err.message });
        this.notifier?.notify('migration_failed', { version, error: err.message });
        throw err;
      }

      // After validation
      await this._runValidate(mig, migrated, 'after');

      await this._audit({ version, description: mig.description, direction: 'up', status: 'success' });
      this.notifier?.notify('migration_success', { version, description: mig.description, count: migrated.length });

      current = migrated;
    }

    return current;
  }

  /**
   * Roll back to a target version (exclusive).
   * @param {Array} streams - current stream data
   * @param {string} targetVersion - roll back all versions > targetVersion
   * @returns {Array} rolled-back streams
   */
  async rollback(streams, targetVersion) {
    await this._ensureTable();
    const applied = await this._appliedVersions();
    const toRollback = this._sortedVersions()
      .filter((v) => applied.has(v) && v > targetVersion)
      .reverse(); // roll back newest-first

    if (toRollback.length === 0) {
      console.log('[migration] Nothing to roll back.');
      return streams;
    }

    let current = streams;

    for (const version of toRollback) {
      const mig = this._migrations.get(version);
      if (!mig.down) throw new Error(`Migration v${version} has no rollback (down) function`);

      console.log(`[migration] Rolling back v${version}: ${mig.description}`);
      await this._audit({ version, description: mig.description, direction: 'down', status: 'started' });
      this.notifier?.notify('rollback_started', { version });

      try {
        current = await mig.down(current);
      } catch (err) {
        await this._audit({ version, description: mig.description, direction: 'down', status: 'failed', error: err.message });
        this.notifier?.notify('rollback_failed', { version, error: err.message });
        throw err;
      }

      await this._audit({ version, description: mig.description, direction: 'down', status: 'rolled_back' });
      this.notifier?.notify('rollback_success', { version });
    }

    return current;
  }

  /** Return audit log entries from file. */
  readAuditLog() {
    try {
      return fs.readFileSync(this.auditLogPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch (_) {
      return [];
    }
  }
}

module.exports = { MigrationRunner };
