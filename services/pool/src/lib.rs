// SPDX-License-Identifier: Apache-2.0

//! Connection pooling for PayStream off-chain services (#490).
//!
//! Provides configured deadpool pools for Postgres and Redis with:
//! - Pool size and timeout configuration
//! - Idle connection cleanup
//! - Pool metrics (size, available, waiting)

use std::time::Duration;

use deadpool_postgres::{Config as PgConfig, Pool as PgPool, Runtime};
use deadpool_redis::{Config as RedisConfig, Pool as RedisPool};
use thiserror::Error;
use tracing::info;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum PoolError {
    #[error("postgres pool build error: {0}")]
    PgBuild(#[from] deadpool_postgres::BuildError),
    #[error("redis pool build error: {0}")]
    RedisBuild(#[from] deadpool_redis::BuildError),
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Pool-size and timeout settings, configurable per deployment.
#[derive(Debug, Clone)]
pub struct PoolConfig {
    /// Maximum number of connections in the pool.
    pub max_size: usize,
    /// Timeout waiting for a connection from the pool.
    pub wait_timeout: Duration,
    /// Timeout for establishing a new connection.
    pub create_timeout: Duration,
    /// Timeout for recycling (health-checking) an idle connection.
    pub recycle_timeout: Duration,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_size: 16,
            wait_timeout: Duration::from_secs(5),
            create_timeout: Duration::from_secs(10),
            recycle_timeout: Duration::from_secs(5),
        }
    }
}

// ---------------------------------------------------------------------------
// Postgres pool
// ---------------------------------------------------------------------------

/// Build a Postgres connection pool.
///
/// `database_url` format: `postgres://user:password@host:5432/dbname`
pub fn build_pg_pool(database_url: &str, cfg: &PoolConfig) -> Result<PgPool, PoolError> {
    let mut pg_cfg = PgConfig::new();
    pg_cfg.url = Some(database_url.to_string());
    pg_cfg.pool = Some(deadpool_postgres::PoolConfig {
        max_size: cfg.max_size,
        wait_timeout: Some(cfg.wait_timeout),
        create_timeout: Some(cfg.create_timeout),
        recycle_timeout: Some(cfg.recycle_timeout),
        ..Default::default()
    });

    let pool = pg_cfg.create_pool(Some(Runtime::Tokio1), tokio_postgres::NoTls)?;
    info!(max_size = cfg.max_size, "postgres pool created");
    Ok(pool)
}

// ---------------------------------------------------------------------------
// Redis pool
// ---------------------------------------------------------------------------

/// Build a Redis connection pool.
///
/// `redis_url` format: `redis://127.0.0.1:6379`
pub fn build_redis_pool(redis_url: &str, cfg: &PoolConfig) -> Result<RedisPool, PoolError> {
    let mut redis_cfg = RedisConfig::from_url(redis_url);
    redis_cfg.pool = Some(deadpool_redis::PoolConfig {
        max_size: cfg.max_size,
        wait_timeout: Some(cfg.wait_timeout),
        create_timeout: Some(cfg.create_timeout),
        recycle_timeout: Some(cfg.recycle_timeout),
        ..Default::default()
    });

    let pool = redis_cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;
    info!(max_size = cfg.max_size, "redis pool created");
    Ok(pool)
}

// ---------------------------------------------------------------------------
// Metrics helpers
// ---------------------------------------------------------------------------

/// Snapshot of pool health metrics.
#[derive(Debug)]
pub struct PoolMetrics {
    pub size: usize,
    pub available: usize,
    pub waiting: usize,
}

pub fn pg_metrics(pool: &PgPool) -> PoolMetrics {
    let status = pool.status();
    PoolMetrics {
        size: status.size,
        available: status.available,
        waiting: status.waiting,
    }
}

pub fn redis_metrics(pool: &RedisPool) -> PoolMetrics {
    let status = pool.status();
    PoolMetrics {
        size: status.size,
        available: status.available,
        waiting: status.waiting,
    }
}

// ---------------------------------------------------------------------------
// Tests (unit — no live DB/Redis required)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_pool_config() {
        let cfg = PoolConfig::default();
        assert_eq!(cfg.max_size, 16);
        assert_eq!(cfg.wait_timeout, Duration::from_secs(5));
    }

    #[test]
    fn custom_pool_config() {
        let cfg = PoolConfig { max_size: 32, ..Default::default() };
        assert_eq!(cfg.max_size, 32);
    }

    /// Verify pool construction doesn't panic on a valid URL (pool is lazy — no
    /// actual connection is made until the first get()).
    #[test]
    fn pg_pool_builds_without_connecting() {
        let cfg = PoolConfig { max_size: 4, ..Default::default() };
        let result = build_pg_pool("postgres://user:pass@localhost:5432/paystream", &cfg);
        assert!(result.is_ok());
    }

    #[test]
    fn redis_pool_builds_without_connecting() {
        let cfg = PoolConfig { max_size: 8, ..Default::default() };
        let result = build_redis_pool("redis://127.0.0.1:6379", &cfg);
        assert!(result.is_ok());
    }
}
