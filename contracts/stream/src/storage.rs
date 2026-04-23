use soroban_sdk::{Env, Address};
use crate::types::{DataKey, Stream, StreamStatus};

pub fn save_stream(env: &Env, stream: &Stream) {
    env.storage().persistent().set(&DataKey::Stream(stream.id), stream);
}

pub fn load_stream(env: &Env, id: u64) -> Option<Stream> {
    env.storage().persistent().get(&DataKey::Stream(id))
}

pub fn next_id(env: &Env) -> u64 {
    let count: u64 = env.storage().instance().get(&DataKey::StreamCount).unwrap_or(0);
    let next = count + 1;
    env.storage().instance().set(&DataKey::StreamCount, &next);
    next
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).expect("admin not set")
}

/// Tokens earned by employee up to `now` that have not yet been withdrawn.
///
/// Optimised hot path: single status check via match, no redundant arithmetic
/// when stream is terminal, and effective_end computed with a single conditional.
pub fn claimable_amount(stream: &Stream, now: u64) -> i128 {
    match stream.status {
        StreamStatus::Cancelled | StreamStatus::Exhausted => return 0,
        _ => {}
    }
    // Cap at stop_time in one expression to avoid a branch in the common case.
    let effective_end = if stream.stop_time > 0 && now > stream.stop_time {
        stream.stop_time
    } else {
        now
    };
    let elapsed = effective_end.saturating_sub(stream.last_withdraw_time) as i128;
    // Avoid multiply when elapsed == 0 (common after a fresh withdraw).
    if elapsed == 0 {
        return 0;
    }
    let remaining = stream.deposit - stream.withdrawn;
    (elapsed * stream.rate_per_second).min(remaining).max(0)
}
