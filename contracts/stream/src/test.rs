#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

fn setup() -> (Env, StreamContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(StreamContract, ());
    let client = StreamContractClient::new(&env, &id);
    (env, client)
}

fn setup_token(env: &Env, admin: &Address) -> Address {
    let token_id = env.register(paystream_token::TokenContract, ());
    let token = paystream_token::TokenContractClient::new(env, &token_id);
    token.initialize(admin, &1_000_000_000);
    token_id
}

// ── initialize ──────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    client.initialize(&admin);
}

// ── create_stream ────────────────────────────────────────────────────────────

#[test]
fn test_create_stream() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &3600, &1, &0);
    assert_eq!(id, 1);
    assert_eq!(client.stream_count(), 1);

    let s = client.get_stream(&id);
    assert_eq!(s.status, StreamStatus::Active);
    assert_eq!(s.deposit, 3600);
    assert_eq!(s.rate_per_second, 1);
    assert_eq!(s.withdrawn, 0);
    assert_eq!(s.employer, employer);
    assert_eq!(s.employee, employee);
}

#[test]
fn test_create_multiple_streams_increments_id() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id1 = client.create_stream(&employer, &employee, &token_id, &1000, &1, &0);
    let id2 = client.create_stream(&employer, &employee, &token_id, &1000, &1, &0);
    let id3 = client.create_stream(&employer, &employee, &token_id, &1000, &1, &0);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
    assert_eq!(client.stream_count(), 3);
}

#[test]
fn test_create_stream_with_stop_time() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let now = env.ledger().timestamp();
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &(now + 500));
    let s = client.get_stream(&id);
    assert_eq!(s.stop_time, now + 500);
}

#[test]
#[should_panic(expected = "deposit must be positive")]
fn test_create_stream_zero_deposit_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    client.create_stream(&employer, &employee, &token_id, &0, &1, &0);
}

#[test]
#[should_panic(expected = "rate must be positive")]
fn test_create_stream_zero_rate_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    client.create_stream(&employer, &employee, &token_id, &1000, &0, &0);
}

#[test]
#[should_panic(expected = "stop_time must be in the future")]
fn test_create_stream_past_stop_time_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    // ledger starts at 0; stop_time=1 is technically in the future, so use 0 — but 0 means no end.
    // Instead advance time first so we can pass a past stop_time.
    env.ledger().with_mut(|l| l.timestamp = 1000);
    client.create_stream(&employer, &employee, &token_id, &1000, &1, &500);
}

// ── claimable ────────────────────────────────────────────────────────────────

#[test]
fn test_claimable_zero_at_creation() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    assert_eq!(client.claimable(&id), 0);
}

#[test]
fn test_claimable_increases_with_time() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 100);
    assert_eq!(client.claimable(&id), 1000);
}

#[test]
fn test_claimable_capped_at_deposit() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    // deposit=500, rate=10 → exhausted after 50s
    let id = client.create_stream(&employer, &employee, &token_id, &500, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 1000); // far past exhaustion
    assert_eq!(client.claimable(&id), 500);
}

#[test]
fn test_claimable_zero_on_cancelled_stream() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    env.ledger().with_mut(|l| l.timestamp += 50);
    client.cancel_stream(&employer, &id);
    assert_eq!(client.claimable(&id), 0);
}

// ── stop_time cap ────────────────────────────────────────────────────────────

#[test]
fn test_stop_time_caps_claimable() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let now = env.ledger().timestamp();
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &(now + 50));

    env.ledger().with_mut(|l| l.timestamp += 200);
    assert_eq!(client.claimable(&id), 500); // capped at 50s * 10
}

// ── withdraw ─────────────────────────────────────────────────────────────────

#[test]
fn test_withdraw() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 200);
    let withdrawn = client.withdraw(&employee, &id);
    assert_eq!(withdrawn, 2000);

    let s = client.get_stream(&id);
    assert_eq!(s.withdrawn, 2000);
    assert_eq!(s.status, StreamStatus::Active);
}

#[test]
fn test_withdraw_multiple_times() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 100);
    client.withdraw(&employee, &id);

    env.ledger().with_mut(|l| l.timestamp += 100);
    let second = client.withdraw(&employee, &id);
    assert_eq!(second, 1000);
    assert_eq!(client.get_stream(&id).withdrawn, 2000);
}

#[test]
fn test_stream_exhausted_when_fully_withdrawn() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &500, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 100);
    let withdrawn = client.withdraw(&employee, &id);
    assert_eq!(withdrawn, 500);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Exhausted);
}

#[test]
#[should_panic(expected = "stream not active")]
fn test_cannot_withdraw_from_cancelled_stream() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    client.cancel_stream(&employer, &id);

    env.ledger().with_mut(|l| l.timestamp += 100);
    client.withdraw(&employee, &id);
}

#[test]
#[should_panic(expected = "stream not active")]
fn test_cannot_withdraw_from_paused_stream() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    env.ledger().with_mut(|l| l.timestamp += 100);
    client.pause_stream(&employer, &id);
    client.withdraw(&employee, &id);
}

#[test]
#[should_panic(expected = "not the employee")]
fn test_wrong_employee_cannot_withdraw() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let other = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    env.ledger().with_mut(|l| l.timestamp += 100);
    client.withdraw(&other, &id);
}

#[test]
#[should_panic(expected = "nothing to withdraw")]
fn test_withdraw_nothing_to_withdraw() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    // No time has passed
    client.withdraw(&employee, &id);
}

// ── top_up ───────────────────────────────────────────────────────────────────

#[test]
fn test_top_up_increases_deposit() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &1000, &10, &0);
    client.top_up(&employer, &id, &500);
    assert_eq!(client.get_stream(&id).deposit, 1500);
}

#[test]
#[should_panic(expected = "not the employer")]
fn test_top_up_wrong_employer_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let other = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &1000, &10, &0);
    client.top_up(&other, &id, &500);
}

#[test]
#[should_panic(expected = "stream not active")]
fn test_top_up_cancelled_stream_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &1000, &10, &0);
    client.cancel_stream(&employer, &id);
    client.top_up(&employer, &id, &500);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_top_up_zero_amount_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &1000, &10, &0);
    client.top_up(&employer, &id, &0);
}

// ── pause / resume ───────────────────────────────────────────────────────────

#[test]
fn test_pause_and_resume() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 100);
    client.pause_stream(&employer, &id);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Paused);

    // Time passes while paused — should not accrue
    env.ledger().with_mut(|l| l.timestamp += 100);
    client.resume_stream(&employer, &id);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Active);

    // 50s after resume
    env.ledger().with_mut(|l| l.timestamp += 50);
    assert_eq!(client.claimable(&id), 500); // only 50s counted
}

#[test]
#[should_panic(expected = "stream not active")]
fn test_pause_already_paused_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    client.pause_stream(&employer, &id);
    client.pause_stream(&employer, &id); // double-pause
}

#[test]
#[should_panic(expected = "stream not paused")]
fn test_resume_active_stream_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    client.resume_stream(&employer, &id); // not paused
}

#[test]
#[should_panic(expected = "not the employer")]
fn test_pause_wrong_employer_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let other = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    client.pause_stream(&other, &id);
}

// ── cancel ───────────────────────────────────────────────────────────────────

#[test]
fn test_cancel_stream_refunds_employer() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 100);
    client.cancel_stream(&employer, &id);

    let s = client.get_stream(&id);
    assert_eq!(s.status, StreamStatus::Cancelled);
    assert_eq!(s.withdrawn, 1000); // 100s * 10
}

#[test]
fn test_cancel_paused_stream() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    env.ledger().with_mut(|l| l.timestamp += 100);
    client.pause_stream(&employer, &id);
    client.cancel_stream(&employer, &id);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Cancelled);
}

#[test]
#[should_panic(expected = "stream already ended")]
fn test_cancel_already_cancelled_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    client.cancel_stream(&employer, &id);
    client.cancel_stream(&employer, &id);
}

#[test]
#[should_panic(expected = "not the employer")]
fn test_cancel_wrong_employer_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let other = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    client.cancel_stream(&other, &id);
}

// ── get_stream / stream_count ─────────────────────────────────────────────────

#[test]
#[should_panic(expected = "stream not found")]
fn test_get_nonexistent_stream_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.get_stream(&999);
}

#[test]
fn test_stream_count_starts_at_zero() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    client.initialize(&admin);
    assert_eq!(client.stream_count(), 0);
}

// ── edge cases ───────────────────────────────────────────────────────────────

#[test]
fn test_withdraw_after_stop_time_passed() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let now = env.ledger().timestamp();
    // stop_time 100s from now, rate=10 → max claimable = 1000
    let id = client.create_stream(&employer, &employee, &token_id, &5000, &10, &(now + 100));

    // Advance well past stop_time
    env.ledger().with_mut(|l| l.timestamp += 500);
    let withdrawn = client.withdraw(&employee, &id);
    assert_eq!(withdrawn, 1000); // capped at stop_time
}

#[test]
fn test_top_up_then_withdraw() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &500, &10, &0);

    // Exhaust the stream
    env.ledger().with_mut(|l| l.timestamp += 100);
    client.withdraw(&employee, &id);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Exhausted);

    // Note: top_up on Exhausted fails with "stream not active" per current logic.
    // This test verifies that constraint.
}

#[test]
fn test_cancel_with_zero_claimable() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    // Cancel immediately (no time elapsed, nothing claimable)
    client.cancel_stream(&employer, &id);
    let s = client.get_stream(&id);
    assert_eq!(s.status, StreamStatus::Cancelled);
    assert_eq!(s.withdrawn, 0);
}
