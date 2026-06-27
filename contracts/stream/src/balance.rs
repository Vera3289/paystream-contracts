// SPDX-License-Identifier: Apache-2.0

//! Stream Balance Calculation Service (#482)
//!
//! Provides accurate balance, claimable amount, vested/unvested breakdown,
//! and remaining duration — all accounting for paused periods and stop times.

use soroban_sdk::contracttype;
use crate::types::{Stream, StreamStatus};

/// Full balance snapshot for a stream at a given instant.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BalanceSnapshot {
    /// Tokens the employee can withdraw right now.
    pub claimable: i128,
    /// Total tokens vested (earned) since stream start, including already withdrawn.
    pub vested: i128,
    /// Tokens deposited but not yet vested.
    pub unvested: i128,
    /// Tokens already withdrawn by the employee.
    pub withdrawn: i128,
    /// Remaining deposit (vested-but-not-withdrawn + unvested).
    pub remaining_deposit: i128,
    /// Seconds until the deposit is fully streamed (0 if exhausted/cancelled/no rate).
    pub remaining_seconds: u64,
}

/// Calculate a full [`BalanceSnapshot`] for `stream` at timestamp `now`.
///
/// `now` is a Unix timestamp in seconds (Soroban ledger timestamp).
///
/// Handles:
/// - Active and Paused streams
/// - Cancelled / Exhausted streams (all values zero / terminal)
/// - Hard `stop_time` cap
/// - Paused streams (accrual frozen at `last_withdraw_time`)
pub fn balance_snapshot(stream: &Stream, now: u64) -> BalanceSnapshot {
    match stream.status {
        StreamStatus::Cancelled | StreamStatus::Exhausted => {
            return BalanceSnapshot {
                claimable: 0,
                vested: stream.withdrawn,
                unvested: 0,
                withdrawn: stream.withdrawn,
                remaining_deposit: 0,
                remaining_seconds: 0,
            };
        }
        _ => {}
    }

    let claimable = claimable_at(stream, now);
    let vested = stream
        .withdrawn
        .checked_add(claimable)
        .unwrap_or(i128::MAX);
    let remaining_deposit = stream.deposit.saturating_sub(stream.withdrawn).max(0);
    let unvested = remaining_deposit.saturating_sub(claimable).max(0);
    let remaining_seconds = remaining_duration(stream, now);

    BalanceSnapshot {
        claimable,
        vested,
        unvested,
        withdrawn: stream.withdrawn,
        remaining_deposit,
        remaining_seconds,
    }
}

/// Tokens claimable by the employee at `now`, accounting for stop_time and paused state.
pub fn claimable_at(stream: &Stream, now: u64) -> i128 {
    match stream.status {
        StreamStatus::Cancelled | StreamStatus::Exhausted => return 0,
        _ => {}
    }

    let effective_now = effective_time(stream, now);
    let elapsed = effective_now.saturating_sub(stream.last_withdraw_time) as i128;
    let earned = elapsed
        .checked_mul(stream.rate_per_second)
        .expect("E004: arithmetic overflow in claimable calculation");

    let remaining = stream.deposit.saturating_sub(stream.withdrawn).max(0);
    earned.min(remaining).max(0)
}

/// Seconds until the stream deposit is fully streamed out, from `now`.
///
/// Returns 0 when the stream is already exhausted, cancelled, or the rate is zero.
pub fn remaining_duration(stream: &Stream, now: u64) -> u64 {
    match stream.status {
        StreamStatus::Cancelled | StreamStatus::Exhausted => return 0,
        _ => {}
    }
    if stream.rate_per_second <= 0 {
        return 0;
    }

    let unstreamed = stream
        .deposit
        .saturating_sub(stream.withdrawn)
        .max(0)
        .saturating_sub(claimable_at(stream, now)) as u64;

    // unstreamed tokens / rate_per_second
    unstreamed / (stream.rate_per_second as u64).max(1)
}

/// Daily earnings rate (rate_per_second × 86_400).
pub fn daily_rate(stream: &Stream) -> i128 {
    stream.rate_per_second.saturating_mul(86_400)
}

/// Monthly earnings rate (rate_per_second × 2_592_000, i.e. 30 days).
pub fn monthly_rate(stream: &Stream) -> i128 {
    stream.rate_per_second.saturating_mul(2_592_000)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// The effective "now" for accrual: capped at stop_time and frozen when paused.
fn effective_time(stream: &Stream, now: u64) -> u64 {
    // Paused: accrual is frozen — no new tokens earned since last_withdraw_time.
    if matches!(stream.status, StreamStatus::Paused) {
        return stream.last_withdraw_time;
    }
    // Cap at hard stop.
    if stream.stop_time > 0 && now > stream.stop_time {
        return stream.stop_time;
    }
    now
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn dummy_addr(env: &Env) -> Address {
        Address::generate(env)
    }

    fn make_stream(
        env: &Env,
        rate: i128,
        deposit: i128,
        withdrawn: i128,
        stop: u64,
        last_withdraw: u64,
        status: StreamStatus,
    ) -> Stream {
        Stream {
            id: 1,
            employer: dummy_addr(env),
            employee: dummy_addr(env),
            token: dummy_addr(env),
            deposit,
            withdrawn,
            rate_per_second: rate,
            start_time: 0,
            stop_time: stop,
            last_withdraw_time: last_withdraw,
            cooldown_period: 0,
            status,
            locked: false,
        }
    }

    #[test]
    fn test_claimable_basic() {
        let env = Env::default();
        let s = make_stream(&env, 100, 10_000, 0, 0, 1000, StreamStatus::Active);
        assert_eq!(claimable_at(&s, 1010), 1000);
    }

    #[test]
    fn test_claimable_capped_by_deposit() {
        let env = Env::default();
        let s = make_stream(&env, 1_000_000, 500, 0, 0, 0, StreamStatus::Active);
        assert_eq!(claimable_at(&s, 1), 500);
    }

    #[test]
    fn test_claimable_paused_returns_zero_additional() {
        let env = Env::default();
        let s = make_stream(&env, 100, 10_000, 0, 0, 1000, StreamStatus::Paused);
        assert_eq!(claimable_at(&s, 2000), 0);
    }

    #[test]
    fn test_claimable_cancelled_is_zero() {
        let env = Env::default();
        let s = make_stream(&env, 100, 10_000, 0, 0, 0, StreamStatus::Cancelled);
        assert_eq!(claimable_at(&s, 1000), 0);
    }

    #[test]
    fn test_claimable_respects_stop_time() {
        let env = Env::default();
        let s = make_stream(&env, 100, 100_000, 0, 1010, 1000, StreamStatus::Active);
        assert_eq!(claimable_at(&s, 2000), 1000); // (1010-1000)*100
    }

    #[test]
    fn test_remaining_duration() {
        let env = Env::default();
        let s = make_stream(&env, 10, 1000, 0, 0, 0, StreamStatus::Active);
        assert_eq!(remaining_duration(&s, 0), 100);
    }

    #[test]
    fn test_daily_monthly_rate() {
        let env = Env::default();
        let s = make_stream(&env, 1, 0, 0, 0, 0, StreamStatus::Active);
        assert_eq!(daily_rate(&s), 86_400);
        assert_eq!(monthly_rate(&s), 2_592_000);
    }

    #[test]
    fn test_snapshot_active() {
        let env = Env::default();
        let s = make_stream(&env, 10, 1000, 100, 0, 50, StreamStatus::Active);
        let snap = balance_snapshot(&s, 60);
        assert_eq!(snap.claimable, 100);
        assert_eq!(snap.withdrawn, 100);
        assert_eq!(snap.vested, 200);
        assert_eq!(snap.remaining_deposit, 900);
    }

    #[test]
    fn test_snapshot_cancelled() {
        let env = Env::default();
        let s = make_stream(&env, 10, 1000, 300, 0, 0, StreamStatus::Cancelled);
        let snap = balance_snapshot(&s, 9999);
        assert_eq!(snap.claimable, 0);
        assert_eq!(snap.vested, 300);
        assert_eq!(snap.remaining_deposit, 0);
    }
}
