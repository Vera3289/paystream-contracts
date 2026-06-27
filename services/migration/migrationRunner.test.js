// SPDX-License-Identifier: Apache-2.0
'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { MigrationRunner } = require('./migrationRunner');

// Minimal in-memory DB stub
function makeDb() {
  const rows = [];
  return {
    rows,
    async query(sql, params) {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('INSERT INTO migration_history')) {
        rows.push({ version: params[0], direction: params[2], status: params[3] });
        return { rows: [] };
      }
      if (sql.includes('SELECT DISTINCT version')) {
        const up = rows.filter((r) => r.direction === 'up' && r.status === 'success').map((r) => r.version);
        const down = rows.filter((r) => r.direction === 'down' && r.status === 'success').map((r) => r.version);
        const applied = up.filter((v) => !down.includes(v));
        return { rows: applied.map((v) => ({ version: v })) };
      }
      return { rows: [] };
    },
  };
}

function makeRunner(db) {
  const auditLog = path.join(os.tmpdir(), `migration-test-${Date.now()}.log`);
  const runner = new MigrationRunner({ db, auditLog });
  return { runner, auditLog };
}

const SAMPLE_STREAMS = [{ id: 1, deposit: 1000, withdrawn: 0 }];

describe('MigrationRunner', () => {
  test('runs an up migration and transforms data', async () => {
    const db = makeDb();
    const { runner } = makeRunner(db);
    runner.register({
      version: '0001',
      description: 'Add foo field',
      up: async (streams) => streams.map((s) => ({ ...s, foo: 'bar' })),
      down: async (streams) => streams.map(({ foo: _, ...rest }) => rest),
    });
    const result = await runner.migrate(SAMPLE_STREAMS);
    expect(result[0].foo).toBe('bar');
  });

  test('skips already-applied migrations', async () => {
    const db = makeDb();
    const { runner } = makeRunner(db);
    let calls = 0;
    runner.register({
      version: '0001',
      description: 'once only',
      up: async (streams) => { calls++; return streams; },
      down: async (s) => s,
    });
    await runner.migrate(SAMPLE_STREAMS);
    await runner.migrate(SAMPLE_STREAMS);
    expect(calls).toBe(1);
  });

  test('rollback reverses applied migration', async () => {
    const db = makeDb();
    const { runner } = makeRunner(db);
    runner.register({
      version: '0001',
      description: 'Add foo',
      up: async (streams) => streams.map((s) => ({ ...s, foo: 'bar' })),
      down: async (streams) => streams.map(({ foo: _, ...rest }) => rest),
    });
    const migrated = await runner.migrate(SAMPLE_STREAMS);
    const rolledBack = await runner.rollback(migrated, '0000');
    expect(rolledBack[0].foo).toBeUndefined();
  });

  test('before-validation failure aborts migration', async () => {
    const { runner } = makeRunner(null);
    runner.register({
      version: '0001',
      description: 'Validated',
      up: async (s) => s,
      down: async (s) => s,
      validate: async () => ({ ok: false, reason: 'bad data' }),
    });
    await expect(runner.migrate(SAMPLE_STREAMS)).rejects.toThrow('Validation before failed');
  });

  test('audit log entries are written on success', async () => {
    const db = makeDb();
    const { runner, auditLog } = makeRunner(db);
    runner.register({
      version: '0001',
      description: 'Logged',
      up: async (s) => s,
      down: async (s) => s,
    });
    await runner.migrate(SAMPLE_STREAMS);
    const entries = runner.readAuditLog();
    const versions = entries.map((e) => e.version);
    expect(versions).toContain('0001');
    fs.unlinkSync(auditLog);
  });

  test('notifier receives migration_success event', async () => {
    const events = [];
    const notifier = { notify: (ev, data) => events.push({ ev, data }) };
    const auditLog = path.join(os.tmpdir(), `notifier-test-${Date.now()}.log`);
    const runner = new MigrationRunner({ notifier, auditLog });
    runner.register({
      version: '0001',
      description: 'Notify test',
      up: async (s) => s,
      down: async (s) => s,
    });
    await runner.migrate(SAMPLE_STREAMS);
    expect(events.some((e) => e.ev === 'migration_success')).toBe(true);
    fs.unlinkSync(auditLog);
  });

  test('throws when down migration missing on rollback', async () => {
    const db = makeDb();
    const { runner } = makeRunner(db);
    runner.register({
      version: '0001',
      description: 'No down',
      up: async (s) => s,
    });
    await runner.migrate(SAMPLE_STREAMS);
    await expect(runner.rollback(SAMPLE_STREAMS, '0000')).rejects.toThrow('no rollback');
  });
});
