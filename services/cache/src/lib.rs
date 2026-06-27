// SPDX-License-Identifier: Apache-2.0

//! Redis caching layer for PayStream off-chain services (#484).
//!
//! Provides TTL-based caching for stream details, user stats, and token info
//! with cache-aside pattern, hit/miss metrics, and graceful fallback.

use std::time::Duration;

use redis::{aio::ConnectionManager, AsyncCommands, Client};
use serde::{de::DeserializeOwned, Serialize};
use thiserror::Error;
use tracing::{debug, warn};

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------

/// Stream details change on every withdraw/top-up — short TTL.
pub const TTL_STREAM: u64 = 30;
/// User stats (aggregate over many streams) — medium TTL.
pub const TTL_USER_STATS: u64 = 60;
/// Token metadata rarely changes — long TTL.
pub const TTL_TOKEN_INFO: u64 = 300;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum CacheError {
    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("serialization error: {0}")]
    Serialize(#[from] serde_json::Error),
}

// ---------------------------------------------------------------------------
// Metrics (simple atomics — replace with Prometheus counters in production)
// ---------------------------------------------------------------------------

use std::sync::atomic::{AtomicU64, Ordering};

static HITS: AtomicU64 = AtomicU64::new(0);
static MISSES: AtomicU64 = AtomicU64::new(0);

pub struct CacheMetrics {
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}

pub fn metrics() -> CacheMetrics {
    let hits = HITS.load(Ordering::Relaxed);
    let misses = MISSES.load(Ordering::Relaxed);
    let total = hits + misses;
    CacheMetrics {
        hits,
        misses,
        hit_rate: if total == 0 { 0.0 } else { hits as f64 / total as f64 },
    }
}

// ---------------------------------------------------------------------------
// Cache key strategy
// ---------------------------------------------------------------------------

pub fn key_stream(stream_id: u64) -> String {
    format!("ps:stream:{stream_id}")
}

pub fn key_user_stats(address: &str) -> String {
    format!("ps:user:{address}:stats")
}

pub fn key_token_info(token_address: &str) -> String {
    format!("ps:token:{token_address}")
}

// ---------------------------------------------------------------------------
// CacheClient
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct CacheClient {
    conn: ConnectionManager,
}

impl CacheClient {
    /// Connect to Redis using the provided URL (e.g. `redis://127.0.0.1:6379`).
    /// Uses a `ConnectionManager` that automatically reconnects on failure.
    pub async fn connect(redis_url: &str) -> Result<Self, CacheError> {
        let client = Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    /// GET a cached value by key. Returns `None` on miss or deserialization failure.
    pub async fn get<T: DeserializeOwned>(&mut self, key: &str) -> Option<T> {
        match self.conn.get::<_, Option<String>>(key).await {
            Ok(Some(json)) => match serde_json::from_str::<T>(&json) {
                Ok(v) => {
                    HITS.fetch_add(1, Ordering::Relaxed);
                    debug!(key, "cache hit");
                    Some(v)
                }
                Err(e) => {
                    warn!(key, %e, "cache deserialize error — treating as miss");
                    MISSES.fetch_add(1, Ordering::Relaxed);
                    None
                }
            },
            Ok(None) => {
                MISSES.fetch_add(1, Ordering::Relaxed);
                debug!(key, "cache miss");
                None
            }
            Err(e) => {
                warn!(key, %e, "cache get error — treating as miss");
                MISSES.fetch_add(1, Ordering::Relaxed);
                None
            }
        }
    }

    /// SET a value with explicit TTL. Silently ignores Redis errors (fallback).
    pub async fn set<T: Serialize>(&mut self, key: &str, value: &T, ttl_secs: u64) {
        match serde_json::to_string(value) {
            Ok(json) => {
                if let Err(e) = self
                    .conn
                    .set_ex::<_, _, ()>(key, json, ttl_secs)
                    .await
                {
                    warn!(key, %e, "cache set error — continuing without cache");
                }
            }
            Err(e) => warn!(key, %e, "cache serialize error"),
        }
    }

    /// DELETE a key (invalidation on update).
    pub async fn invalidate(&mut self, key: &str) {
        if let Err(e) = self.conn.del::<_, ()>(key).await {
            warn!(key, %e, "cache invalidate error");
        }
    }

    /// Cache-aside helper: return cached value if present, otherwise call
    /// `loader`, cache the result, and return it.
    ///
    /// Falls back transparently if Redis is unavailable.
    pub async fn get_or_load<T, F, Fut>(
        &mut self,
        key: &str,
        ttl_secs: u64,
        loader: F,
    ) -> Result<T, CacheError>
    where
        T: Serialize + DeserializeOwned,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, CacheError>>,
    {
        if let Some(cached) = self.get::<T>(key).await {
            return Ok(cached);
        }
        let value = loader().await?;
        self.set(key, &value, ttl_secs).await;
        Ok(value)
    }

    /// Warm the cache for a set of stream IDs using a bulk loader function.
    /// Intended to be called on service startup.
    pub async fn warm_streams<F, Fut, T>(&mut self, stream_ids: &[u64], loader: F)
    where
        T: Serialize + DeserializeOwned,
        F: Fn(u64) -> Fut,
        Fut: std::future::Future<Output = Option<T>>,
    {
        for &id in stream_ids {
            let key = key_stream(id);
            if self.get::<T>(&key).await.is_none() {
                if let Some(v) = loader(id).await {
                    self.set(&key, &v, TTL_STREAM).await;
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tests (require a live Redis; skipped by default via cfg flag)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
    struct Dummy {
        id: u64,
        value: String,
    }

    /// Unit tests for key helpers — no Redis required.
    #[test]
    fn test_cache_keys() {
        assert_eq!(key_stream(42), "ps:stream:42");
        assert_eq!(key_user_stats("GABC"), "ps:user:GABC:stats");
        assert_eq!(key_token_info("GBBD"), "ps:token:GBBD");
    }

    #[test]
    fn test_metrics_initial() {
        let m = metrics();
        // Counters are global; just verify the hit_rate formula doesn't panic.
        let _ = m.hit_rate;
    }
}
