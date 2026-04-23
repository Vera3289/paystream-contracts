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

// ── Multi-token tests (issue #23) ────────────────────────────────────────────

#[test]
fn test_streams_with_different_tokens() {
    // Two concurrent streams each using a distinct SEP-41 token contract.
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);

    let token_a = setup_token(&env, &employer);
    let token_b = setup_token(&env, &employer);

    client.initialize(&admin);
    let id_a = client.create_stream(&employer, &employee, &token_a, &1_000, &5, &0);
    let id_b = client.create_stream(&employer, &employee, &token_b, &2_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 100);

    // Each stream accrues independently with its own token
    assert_eq!(client.claimable(&id_a), 500);  // 100s * 5
    assert_eq!(client.claimable(&id_b), 1000); // 100s * 10

    assert_eq!(client.get_stream(&id_a).token, token_a);
    assert_eq!(client.get_stream(&id_b).token, token_b);
}

#[test]
fn test_withdraw_correct_token_per_stream() {
    // Withdrawing from each stream transfers the correct token.
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);

    let token_a = setup_token(&env, &employer);
    let token_b = setup_token(&env, &employer);

    client.initialize(&admin);
    let id_a = client.create_stream(&employer, &employee, &token_a, &500, &5, &0);
    let id_b = client.create_stream(&employer, &employee, &token_b, &500, &5, &0);

    env.ledger().with_mut(|l| l.timestamp += 50);

    let w_a = client.withdraw(&employee, &id_a);
    let w_b = client.withdraw(&employee, &id_b);

    assert_eq!(w_a, 250); // 50s * 5
    assert_eq!(w_b, 250);
    // Tokens are independent — each stream tracks its own withdrawn amount
    assert_eq!(client.get_stream(&id_a).withdrawn, 250);
    assert_eq!(client.get_stream(&id_b).withdrawn, 250);
}
