-- Migration: 002_streams_table
BEGIN;
CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_address VARCHAR(64) NOT NULL,
    employee_address VARCHAR(64) NOT NULL,
    token_address VARCHAR(64) NOT NULL,
    deposit NUMERIC(38,0) NOT NULL,
    rate_per_second NUMERIC(38,0) NOT NULL,
    start_time BIGINT NOT NULL,
    stop_time BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
