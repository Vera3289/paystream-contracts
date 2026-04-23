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

    // Time passes while paused — should not accrue
    env.ledger().with_mut(|l| l.timestamp += 100);
    client.resume_stream(&employer, &id);

    // 50s after resume
    env.ledger().with_mut(|l| l.timestamp += 50);
    assert_eq!(client.claimable(&id), 500); // only 50s counted
}

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

/// Full lifecycle: create → withdraw → top_up → pause → resume → cancel
///
/// Timeline (all timestamps relative to stream start = T0):
///   T0+100  withdraw (100s * 10 = 1_000 tokens)
///   T0+100  top_up   (+5_000 tokens, deposit becomes 14_000)
///   T0+200  pause    (100s * 10 = 1_000 more claimable, not yet withdrawn)
///   T0+300  resume   (paused 100s — not counted)
///   T0+350  cancel   (50s * 10 = 500 claimable → employee; remainder → employer)
#[test]
fn test_full_stream_lifecycle() {
    let (env, client) = setup();
    let admin    = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);
    let token    = paystream_token::TokenContractClient::new(&env, &token_id);

    client.initialize(&admin);

    // ── Create ──────────────────────────────────────────────────────────────
    // deposit=10_000, rate=10/s, no stop_time
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    let contract_id = env.register(StreamContract, ());

    // Employer spent 10_000; employee has 0.
    assert_eq!(token.balance(&employer), 0);
    assert_eq!(token.balance(&employee), 0);

    // ── Withdraw after 100s ─────────────────────────────────────────────────
    env.ledger().with_mut(|l| l.timestamp += 100);
    let w1 = client.withdraw(&employee, &id);
    assert_eq!(w1, 1_000);                          // 100s * 10
    assert_eq!(token.balance(&employee), 1_000);

    let s = client.get_stream(&id);
    assert_eq!(s.withdrawn, 1_000);
    assert_eq!(s.status, StreamStatus::Active);

    // ── Top-up ──────────────────────────────────────────────────────────────
    // Mint 5_000 more to employer first, then top up.
    token.mint(&admin, &employer, &5_000);
    client.top_up(&employer, &id, &5_000);
    assert_eq!(client.get_stream(&id).deposit, 15_000);

    // ── Pause after another 100s ────────────────────────────────────────────
    env.ledger().with_mut(|l| l.timestamp += 100);
    // 1_000 tokens claimable at pause time (not yet withdrawn)
    client.pause_stream(&employer, &id);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Paused);

    // ── Time passes while paused (100s) — should not accrue ─────────────────
    env.ledger().with_mut(|l| l.timestamp += 100);

    // ── Resume ──────────────────────────────────────────────────────────────
    client.resume_stream(&employer, &id);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Active);
    // last_withdraw_time reset to now; paused window excluded
    assert_eq!(client.claimable(&id), 0);

    // ── Cancel after 50s post-resume ────────────────────────────────────────
    env.ledger().with_mut(|l| l.timestamp += 50);
    // Claimable at cancel: 50s * 10 = 500 (post-resume accrual)
    // Plus the 1_000 that accrued before pause but was never withdrawn.
    // Note: resume resets last_withdraw_time, so pre-pause accrual is lost
    // (by design — pause forfeits undrawn accrual). Only 500 goes to employee.
    let employer_before = token.balance(&employer);
    client.cancel_stream(&employer, &id);

    let s = client.get_stream(&id);
    assert_eq!(s.status, StreamStatus::Cancelled);

    // Employee received 500 from cancel payout
    assert_eq!(token.balance(&employee), 1_000 + 500); // w1 + cancel claimable

    // Employer refunded: deposit(15_000) - withdrawn(1_000) - cancel_claimable(500) = 13_500
    assert_eq!(token.balance(&employer), employer_before + 13_500);
}
