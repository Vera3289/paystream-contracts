// SPDX-License-Identifier: Apache-2.0
'use strict';

const { SnapshotStore, MemoryStorage } = require('./snapshotStore');

const STREAM = {
  id: 42,
  status: 'Active',
  deposit: 10000,
  withdrawn: 0,
  rate_per_second: 1,
  last_withdraw_time: 1000,
};

function makeStore(opts = {}) {
  return new SnapshotStore({ storage: new MemoryStorage(), intervalSecs: 60, retentionLimit: 5, ...opts });
}

describe('SnapshotStore', () => {
  test('records first snapshot immediately', async () => {
    const store = makeStore();
    const snap = await store.checkpoint(STREAM, 1000);
    expect(snap).not.toBeNull();
    expect(snap.ts).toBe(1000);
    expect(snap.id).toBe(42);
  });

  test('skips snapshot if interval not elapsed', async () => {
    const store = makeStore();
    await store.checkpoint(STREAM, 1000);
    const snap = await store.checkpoint(STREAM, 1030); // only 30s, interval is 60s
    expect(snap).toBeNull();
  });

  test('records snapshot after interval has elapsed', async () => {
    const store = makeStore();
    await store.checkpoint(STREAM, 1000);
    const snap = await store.checkpoint(STREAM, 1060);
    expect(snap).not.toBeNull();
    expect(snap.ts).toBe(1060);
  });

  test('forceCheckpoint always records', async () => {
    const store = makeStore();
    await store.checkpoint(STREAM, 1000);
    const snap = await store.forceCheckpoint(STREAM, 1005);
    expect(snap).not.toBeNull();
    expect(snap.ts).toBe(1005);
  });

  test('prunes old snapshots beyond retentionLimit', async () => {
    const store = makeStore({ intervalSecs: 1, retentionLimit: 3 });
    for (let i = 0; i < 5; i++) {
      await store.checkpoint(STREAM, 1000 + i * 10);
    }
    const all = await store.query(STREAM.id);
    expect(all.length).toBe(3);
  });

  test('query returns all snapshots in range', async () => {
    const store = makeStore({ intervalSecs: 10 });
    await store.checkpoint(STREAM, 1000);
    await store.checkpoint(STREAM, 1010);
    await store.checkpoint(STREAM, 1020);
    const result = await store.query(STREAM.id, { fromTs: 1005, toTs: 1015 });
    expect(result.length).toBe(1);
    expect(result[0].ts).toBe(1010);
  });

  test('queryAt returns most recent snapshot at or before given time', async () => {
    const store = makeStore({ intervalSecs: 10 });
    await store.checkpoint(STREAM, 1000);
    await store.checkpoint(STREAM, 1010);
    await store.checkpoint(STREAM, 1020);
    const snap = await store.queryAt(STREAM.id, 1015);
    expect(snap.ts).toBe(1010);
  });

  test('queryAt returns null if no snapshots before given time', async () => {
    const store = makeStore();
    const snap = await store.queryAt(STREAM.id, 999);
    expect(snap).toBeNull();
  });

  test('cleanup removes old snapshots and returns count', async () => {
    const store = makeStore({ intervalSecs: 10 });
    await store.checkpoint(STREAM, 1000);
    await store.checkpoint(STREAM, 1010);
    await store.checkpoint(STREAM, 1020);
    const deleted = await store.cleanup(STREAM.id, 1015);
    expect(deleted).toBe(2); // 1000 and 1010 removed (< 1015)
    const remaining = await store.query(STREAM.id);
    expect(remaining.length).toBe(1);
  });

  test('snapshot is compact (only required fields)', async () => {
    const store = makeStore();
    const snap = await store.checkpoint(STREAM, 1000);
    expect(Object.keys(snap).sort()).toEqual(
      ['deposit', 'id', 'last_withdraw_time', 'rate_per_second', 'status', 'ts', 'withdrawn'].sort()
    );
  });

  test('requires storage backend', () => {
    expect(() => new SnapshotStore()).toThrow('storage backend is required');
  });
});
