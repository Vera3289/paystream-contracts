// SPDX-License-Identifier: Apache-2.0
// Snapshot / Checkpoint system for PayStream streams (#503)
// Records periodic stream state snapshots for historical analysis and recovery.

'use strict';

/**
 * SnapshotStore manages periodic stream state checkpoints.
 *
 * Storage design (minimal overhead):
 *   - Snapshots stored as newline-delimited JSON (NDJSON) in a single file per stream,
 *     or in-memory for test/ephemeral use.
 *   - Each snapshot is a compact object: { ts, id, status, deposit, withdrawn, rate }
 *   - Old snapshots beyond retentionLimit are pruned in-place.
 */
class SnapshotStore {
  /**
   * @param {object} opts
   * @param {object} opts.storage         - storage backend: { save(key, snapshots), load(key) }
   * @param {number} [opts.intervalSecs]  - snapshot frequency in seconds (default: 3600 = 1 hour)
   * @param {number} [opts.retentionLimit] - max snapshots kept per stream (default: 720 = 30 days at 1/hr)
   */
  constructor({ storage, intervalSecs = 3600, retentionLimit = 720 } = {}) {
    if (!storage) throw new Error('storage backend is required');
    this.storage = storage;
    this.intervalSecs = intervalSecs;
    this.retentionLimit = retentionLimit;
  }

  /**
   * Record a snapshot for a stream if the snapshot interval has elapsed since the last one.
   * @param {object} stream - stream state object
   * @param {number} [nowSecs] - unix timestamp override
   * @returns {object|null} the new snapshot, or null if interval not elapsed
   */
  async checkpoint(stream, nowSecs) {
    const now = nowSecs !== undefined ? nowSecs : Math.floor(Date.now() / 1000);
    const key = `stream:${stream.id}`;
    const snapshots = await this.storage.load(key) || [];

    const last = snapshots[snapshots.length - 1];
    if (last && now - last.ts < this.intervalSecs) {
      return null; // too soon
    }

    const snapshot = this._compact(stream, now);
    snapshots.push(snapshot);

    // Prune old snapshots beyond retentionLimit
    const trimmed = snapshots.slice(-this.retentionLimit);
    await this.storage.save(key, trimmed);

    return snapshot;
  }

  /**
   * Force a snapshot regardless of interval (e.g. on withdrawal or status change).
   * @param {object} stream
   * @param {number} [nowSecs]
   * @returns {object} the new snapshot
   */
  async forceCheckpoint(stream, nowSecs) {
    const now = nowSecs !== undefined ? nowSecs : Math.floor(Date.now() / 1000);
    const key = `stream:${stream.id}`;
    const snapshots = await this.storage.load(key) || [];

    const snapshot = this._compact(stream, now);
    snapshots.push(snapshot);

    const trimmed = snapshots.slice(-this.retentionLimit);
    await this.storage.save(key, trimmed);

    return snapshot;
  }

  /**
   * Query snapshots for a stream, optionally filtered by time range.
   * @param {number|string} streamId
   * @param {object} [opts]
   * @param {number} [opts.fromTs] - start of range (inclusive)
   * @param {number} [opts.toTs]   - end of range (inclusive)
   * @returns {Array} matching snapshots
   */
  async query(streamId, { fromTs, toTs } = {}) {
    const key = `stream:${streamId}`;
    const snapshots = await this.storage.load(key) || [];
    return snapshots.filter((s) => {
      if (fromTs !== undefined && s.ts < fromTs) return false;
      if (toTs !== undefined && s.ts > toTs) return false;
      return true;
    });
  }

  /**
   * Find the most recent snapshot at or before a given timestamp (for recovery/audit).
   * @param {number|string} streamId
   * @param {number} atTs
   * @returns {object|null}
   */
  async queryAt(streamId, atTs) {
    const snapshots = await this.query(streamId, { toTs: atTs });
    return snapshots[snapshots.length - 1] || null;
  }

  /**
   * Delete snapshots older than a given timestamp (cleanup).
   * @param {number|string} streamId
   * @param {number} olderThanTs
   * @returns {number} number of snapshots deleted
   */
  async cleanup(streamId, olderThanTs) {
    const key = `stream:${streamId}`;
    const snapshots = await this.storage.load(key) || [];
    const kept = snapshots.filter((s) => s.ts >= olderThanTs);
    await this.storage.save(key, kept);
    return snapshots.length - kept.length;
  }

  /** Compact snapshot: only the fields needed for analysis/recovery. */
  _compact(stream, ts) {
    return {
      ts,
      id: stream.id,
      status: stream.status,
      deposit: stream.deposit,
      withdrawn: stream.withdrawn,
      rate_per_second: stream.rate_per_second,
      last_withdraw_time: stream.last_withdraw_time,
    };
  }
}

/**
 * In-memory storage backend (default for testing / ephemeral use).
 */
class MemoryStorage {
  constructor() {
    this._store = new Map();
  }
  async save(key, value) { this._store.set(key, value); }
  async load(key) { return this._store.get(key) || null; }
}

module.exports = { SnapshotStore, MemoryStorage };
