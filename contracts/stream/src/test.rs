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

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------

#[test]
fn test_create_stream() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    client.set_min_deposit(&admin, &100);
    let id = client.create_stream(&employer, &employee, &token_id, &3600, &1, &0);
    assert_eq!(id, 1);
    assert_eq!(client.stream_count(), 1);

    let s = client.get_stream(&id);
    assert_eq!(s.status, StreamStatus::Active);
    assert_eq!(s.deposit, 3600);
    assert_eq!(s.rate_per_second, 1);
    assert_eq!(s.withdrawn, 0);
    // Guard must start unlocked
    assert!(!s.locked);
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
    // Guard must be released after a successful withdraw
    assert!(!s.locked);
}

#[test]
fn test_stream_exhausted_when_fully_withdrawn() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    client.set_min_deposit(&admin, &100);
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

/// Issue #15: paused 100s must not count toward claimable
#[test]
fn test_pause_excludes_paused_time() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    // 50s active → pause → 100s paused → resume → 50s active
    env.ledger().with_mut(|l| l.timestamp += 50);
    client.pause_stream(&employer, &id);
    env.ledger().with_mut(|l| l.timestamp += 100); // paused — must not count
    client.resume_stream(&employer, &id);
    env.ledger().with_mut(|l| l.timestamp += 50);

    // Only 50 + 50 = 100s of active time counted
    assert_eq!(client.claimable(&id), 1000);
}

/// Issue #15: multiple pause/resume cycles all exclude paused time
#[test]
fn test_multiple_pause_resume_cycles() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    // cycle 1: 30s active, 200s paused
    env.ledger().with_mut(|l| l.timestamp += 30);
    client.pause_stream(&employer, &id);
    env.ledger().with_mut(|l| l.timestamp += 200);
    client.resume_stream(&employer, &id);

    // cycle 2: 20s active, 300s paused
    env.ledger().with_mut(|l| l.timestamp += 20);
    client.pause_stream(&employer, &id);
    env.ledger().with_mut(|l| l.timestamp += 300);
    client.resume_stream(&employer, &id);

    // 40s active after last resume
    env.ledger().with_mut(|l| l.timestamp += 40);

    // Only 30 + 20 + 40 = 90s of active time → 900 tokens
    assert_eq!(client.claimable(&id), 900);
}

/// Issue #15: withdraw during pause returns 0 new accrual
#[test]
#[should_panic(expected = "stream not active")]
fn test_withdraw_during_pause_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 50);
    client.pause_stream(&employer, &id);
    env.ledger().with_mut(|l| l.timestamp += 100);
    // withdraw while paused must fail
    client.withdraw(&employee, &id);
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

// ---------------------------------------------------------------------------
// Issue #10 – Withdraw on exhausted stream returns 0 gracefully
// ---------------------------------------------------------------------------

/// Withdrawing from an already-exhausted stream must return 0, not panic.
#[test]
fn test_withdraw_exhausted_returns_zero() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    client.set_min_deposit(&admin, &100);
    let id = client.create_stream(&employer, &employee, &token_id, &500, &10, &0);

    // Exhaust the stream
    env.ledger().with_mut(|l| l.timestamp += 100);
    client.withdraw(&employee, &id);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Exhausted);

    // Second withdraw on exhausted stream must return 0, no panic, no transfer
    let result = client.withdraw(&employee, &id);
    assert_eq!(result, 0);
}

/// Withdrawing from a cancelled stream must still panic (not graceful).
#[test]
#[should_panic(expected = "stream not active")]
fn test_withdraw_cancelled_still_panics() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);
    client.cancel_stream(&employer, &id);
    client.withdraw(&employee, &id);
}

// ---------------------------------------------------------------------------
// Issue #1 – Reentrancy guard
// ---------------------------------------------------------------------------

/// Verify that a stream with `locked = true` (simulating a mid-flight
/// cross-contract callback) is rejected with the E003 error code.
///
/// In production Soroban the host prevents true reentrancy, but this test
/// confirms the guard logic fires correctly if the flag is ever set.
#[test]
#[should_panic(expected = "E003")]
fn test_reentrant_withdraw_rejected() {
    use storage::save_stream;

    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    // Manually set the locked flag to simulate a reentrant call mid-flight
    env.as_contract(&client.address, || {
        let mut stream = storage::load_stream(&env, id).unwrap();
        stream.locked = true;
        save_stream(&env, &stream);
    });

    env.ledger().with_mut(|l| l.timestamp += 100);
    // This must panic with E003
    client.withdraw(&employee, &id);
}

// ---------------------------------------------------------------------------
// Issue #2 – Overflow / checked arithmetic
// ---------------------------------------------------------------------------

/// claimable_amount with rate = i128::MAX and elapsed = 2 must panic (overflow)
/// rather than silently wrap to a wrong value.
#[test]
#[should_panic(expected = "E004")]
fn test_claimable_overflow_panics() {
    use storage::claimable_amount;
    use types::{Stream, StreamStatus};

    let env = Env::default();
    let addr = Address::generate(&env);

    let stream = Stream {
        id: 1,
        employer: addr.clone(),
        employee: addr.clone(),
        token: addr.clone(),
        deposit: i128::MAX,
        withdrawn: 0,
        rate_per_second: i128::MAX,
        start_time: 0,
        stop_time: 0,
        last_withdraw_time: 0,
        status: StreamStatus::Active,
        locked: false,
    };

    // elapsed = 2, rate = i128::MAX → product overflows i128
    claimable_amount(&stream, 2);
}

/// Boundary value: rate = 1, elapsed = u64::MAX – claimable should equal
/// deposit (capped by remaining) without panicking.
#[test]
fn test_claimable_large_elapsed_capped_by_deposit() {
    use storage::claimable_amount;
    use types::{Stream, StreamStatus};

    let env = Env::default();
    let addr = Address::generate(&env);

    let deposit: i128 = 1_000_000;
    let stream = Stream {
        id: 1,
        employer: addr.clone(),
        employee: addr.clone(),
        token: addr.clone(),
        deposit,
        withdrawn: 0,
        rate_per_second: 1,
        start_time: 0,
        stop_time: 0,
        last_withdraw_time: 0,
        status: StreamStatus::Active,
        locked: false,
    };

    // elapsed = u64::MAX → earned = u64::MAX as i128, but capped to deposit
    let result = claimable_amount(&stream, u64::MAX);
    assert_eq!(result, deposit);
}

// ---------------------------------------------------------------------------
// Issue #3 – Zero-rate validation
// ---------------------------------------------------------------------------

/// Creating a stream with rate_per_second = 0 must panic with E001.
#[test]
#[should_panic(expected = "E001")]
fn test_create_stream_zero_rate_rejected() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    // rate_per_second = 0 → must panic
    client.create_stream(&employer, &employee, &token_id, &10_000, &0, &0);
}

/// Creating a stream with a valid positive rate must still succeed.
#[test]
fn test_create_stream_positive_rate_ok() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &3600, &1, &0);
    assert_eq!(id, 1);
    assert_eq!(client.get_stream(&id).rate_per_second, 1);
}

// ---------------------------------------------------------------------------
// Issue #20 – Contract upgrade / migration path
// ---------------------------------------------------------------------------

// Import the compiled WASM for upgrade tests. The contract must be built first.
// In CI this is handled by the build step before tests run.
mod stream_wasm {
    soroban_sdk::contractimport!(
        file = "../../../target/wasm32v1-none/release/paystream_stream.wasm"
    );
}

/// Upgrading the contract with the same WASM preserves all existing stream state.
#[test]
fn test_upgrade_preserves_stream_state() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);

    client.initialize(&admin);
    let id = client.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

    env.ledger().with_mut(|l| l.timestamp += 100);

    // Upload the current contract WASM and upgrade — state must survive
    let new_wasm_hash = env.deployer().upload_contract_wasm(stream_wasm::WASM);
    client.upgrade(&admin, &new_wasm_hash);

    // Stream state is intact after upgrade
    let s = client.get_stream(&id);
    assert_eq!(s.deposit, 10_000);
    assert_eq!(s.rate_per_second, 10);
    assert_eq!(s.status, StreamStatus::Active);
    assert_eq!(client.claimable(&id), 1000);
}

/// migrate() is a no-op in the base version and must not panic.
#[test]
fn test_migrate_noop() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.migrate(&admin); // must not panic
}

/// Only admin can call upgrade.
#[test]
#[should_panic]
fn test_upgrade_non_admin_rejected() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    client.initialize(&admin);

    let new_wasm_hash = env.deployer().upload_contract_wasm(stream_wasm::WASM);
    client.upgrade(&attacker, &new_wasm_hash);
}

// ---------------------------------------------------------------------------
// Issue #19 – Two-step admin transfer
// ---------------------------------------------------------------------------

#[test]
fn test_admin_transfer_full_flow() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    client.initialize(&admin);

    client.propose_admin(&new_admin);
    client.accept_admin(&new_admin);

    // new_admin can now call propose_admin (proves they are admin)
    let another = Address::generate(&env);
    client.propose_admin(&another); // would panic if new_admin is not admin
}

#[test]
#[should_panic]
fn test_propose_admin_non_admin_rejected() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    client.initialize(&admin);
    client.propose_admin(&attacker); // attacker tries to propose themselves
}

#[test]
#[should_panic(expected = "not the pending admin")]
fn test_accept_admin_wrong_address_rejected() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    client.initialize(&admin);
    client.propose_admin(&new_admin);
    client.accept_admin(&attacker); // wrong address
}
