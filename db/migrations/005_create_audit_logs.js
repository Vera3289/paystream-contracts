/* eslint-disable camelcase */
exports.up = (pgm) => {
  pgm.createTable('audit_logs', {
    id: { type: 'bigserial', primaryKey: true },
    actor: { type: 'varchar(56)', notNull: true },
    action: { type: 'varchar(64)', notNull: true },
    entity_type: { type: 'varchar(32)' },
    entity_id: { type: 'varchar(64)' },
    before_state: { type: 'jsonb' },
    after_state: { type: 'jsonb' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('audit_logs', 'actor');
  pgm.createIndex('audit_logs', 'action');
  pgm.createIndex('audit_logs', 'created_at');

  // Immutable: prevent UPDATE and DELETE
  pgm.sql(`
    CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
    CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;
    DROP RULE IF EXISTS audit_logs_no_delete ON audit_logs;
  `);
  pgm.dropTable('audit_logs');
};
