// SPDX-License-Identifier: Apache-2.0
//! API response validation tests for the PayStream stream contract.
//!
//! Validates return types, field presence, and error codes across all public
//! contract entrypoints documented in docs/api-reference.md.

#[cfg(test)]
pub mod error_codes;
#[cfg(test)]
pub mod schema;

#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env};

    use crate::{StreamContract, StreamContractClient};
    use crate::types::StreamStatus;
    use super::schema::{validate_claimable_response, validate_stream_count_response, validate_stream_schema};

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

    // -----------------------------------------------------------------------
    // get_stream() response validation
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_stream_returns_valid_schema() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &3600, &1, &0, &0, &0);

        let stream = client.get_stream(&id);
        validate_stream_schema(&stream);
        assert_eq!(stream.id, id);
        assert_eq!(stream.employer, employer);
        assert_eq!(stream.employee, employee);
        assert_eq!(stream.deposit, 3600);
        assert_eq!(stream.rate_per_second, 1);
        assert_eq!(stream.withdrawn, 0);
    }

    #[test]
    fn test_get_stream_status_active_on_create() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);

        let stream = client.get_stream(&id);
        assert_eq!(stream.status, StreamStatus::Active);
    }

    #[test]
    fn test_get_stream_status_paused_after_pause() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);

        client.pause_stream(&employer, &id);
        assert_eq!(client.get_stream(&id).status, StreamStatus::Paused);
    }

    #[test]
    fn test_get_stream_status_cancelled_after_cancel() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);

        client.cancel_stream(&employer, &id);
        assert_eq!(client.get_stream(&id).status, StreamStatus::Cancelled);
    }

    #[test]
    fn test_get_stream_status_exhausted_when_fully_withdrawn() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        // deposit=100, rate=100 → exhausted after 1 second
        let id = client.create_stream(&employer, &employee, &token, &100, &100, &0, &0, &0);
        env.ledger().with_mut(|l| l.timestamp += 2);
        client.withdraw(&employee, &id);
        assert_eq!(client.get_stream(&id).status, StreamStatus::Exhausted);
    }

    // -----------------------------------------------------------------------
    // claimable() response validation
    // -----------------------------------------------------------------------

    #[test]
    fn test_claimable_returns_i128_zero_at_start() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);

        let amount: i128 = client.claimable(&id);
        validate_claimable_response(amount);
        assert_eq!(amount, 0);
    }

    #[test]
    fn test_claimable_returns_correct_i128_after_time() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &10_000, &5, &0, &0, &0);

        env.ledger().with_mut(|l| l.timestamp += 100);
        let amount: i128 = client.claimable(&id);
        validate_claimable_response(amount);
        // 100 seconds × 5 per second = 500
        assert_eq!(amount, 500);
    }

    #[test]
    fn test_claimable_capped_at_deposit() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &100, &10, &0, &0, &0);

        // advance far past exhaustion
        env.ledger().with_mut(|l| l.timestamp += 1000);
        let amount: i128 = client.claimable(&id);
        validate_claimable_response(amount);
        assert_eq!(amount, 100); // capped at deposit
    }

    // -----------------------------------------------------------------------
    // stream_count() response validation
    // -----------------------------------------------------------------------

    #[test]
    fn test_stream_count_returns_u64_zero_initially() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        let count: u64 = client.stream_count();
        validate_stream_count_response(count);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_stream_count_increments_on_create() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);

        for i in 1u64..=3 {
            let employee = Address::generate(&env);
            client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);
            let count: u64 = client.stream_count();
            validate_stream_count_response(count);
            assert_eq!(count, i);
        }
    }

    // -----------------------------------------------------------------------
    // StreamStatus enum completeness
    // -----------------------------------------------------------------------

    #[test]
    fn test_stream_status_variants_are_distinct() {
        assert_ne!(StreamStatus::Active, StreamStatus::Paused);
        assert_ne!(StreamStatus::Active, StreamStatus::Cancelled);
        assert_ne!(StreamStatus::Active, StreamStatus::Exhausted);
        assert_ne!(StreamStatus::Paused, StreamStatus::Cancelled);
        assert_ne!(StreamStatus::Paused, StreamStatus::Exhausted);
        assert_ne!(StreamStatus::Cancelled, StreamStatus::Exhausted);
    }
}
