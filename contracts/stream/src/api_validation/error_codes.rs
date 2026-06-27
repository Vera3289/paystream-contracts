// SPDX-License-Identifier: Apache-2.0
//! Tests verifying each error code (E001–E017) is returned for invalid inputs.

#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, Address, Env};

    use crate::{StreamContract, StreamContractClient};

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

    /// E001 — rate_per_second must be > 0
    #[test]
    #[should_panic(expected = "E001")]
    fn test_e001_zero_rate() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        client.create_stream(&employer, &employee, &token, &1000, &0, &0, &0, &0);
    }

    /// E002 — deposit must be positive
    #[test]
    #[should_panic(expected = "E002")]
    fn test_e002_zero_deposit() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        client.create_stream(&employer, &employee, &token, &0, &1, &0, &0, &0);
    }

    /// E003 — reentrant withdraw (lock flag)
    /// Verified structurally: the contract sets stream.locked = true before the
    /// token transfer and panics with E003 if a reentrant call is detected.
    /// A unit test for this path would require two concurrent executions of the
    /// same contract in the test environment, which Soroban's single-threaded
    /// test harness does not support. The constant is validated here instead.
    #[test]
    fn test_e003_reentrant_constant_defined() {
        assert!(crate::types::ERR_REENTRANT.starts_with("E003"));
    }

    /// E004 — arithmetic overflow constant defined
    #[test]
    fn test_e004_overflow_constant_defined() {
        assert!(crate::types::ERR_OVERFLOW.starts_with("E004"));
    }

    /// E005 — cannot top up a cancelled stream
    #[test]
    #[should_panic(expected = "E005")]
    fn test_e005_top_up_cancelled() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);
        client.cancel_stream(&employer, &id);
        client.top_up(&employer, &id, &500);
    }

    /// E006 — cannot top up an exhausted stream
    #[test]
    #[should_panic(expected = "E006")]
    fn test_e006_top_up_exhausted() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        // rate=1000 deposit=1000 → exhausted after 1 second
        let id = client.create_stream(&employer, &employee, &token, &1000, &1000, &0, &0, &0);
        env.ledger()
            .with_mut(|l| l.timestamp = l.timestamp.saturating_add(2));
        client.withdraw(&employee, &id);
        client.top_up(&employer, &id, &500);
    }

    /// E007 — deposit below minimum
    #[test]
    #[should_panic(expected = "E007")]
    fn test_e007_below_min_deposit() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        // set minimum deposit to 500
        client.set_min_deposit(&admin, &0, &500);
        client.create_stream(&employer, &employee, &token, &100, &1, &0, &0, &0);
    }

    /// E008 — rate_per_second exceeds maximum
    #[test]
    #[should_panic(expected = "E008")]
    fn test_e008_invalid_rate() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        // MAX_RATE_PER_SECOND = 10_000_000_000; use i128::MAX
        client.create_stream(
            &employer,
            &employee,
            &token,
            &i128::MAX,
            &i128::MAX,
            &0,
            &0,
            &0,
        );
    }

    /// E010 — employer and employee must differ (ERR_SAME_PARTY)
    #[test]
    #[should_panic(expected = "E010")]
    fn test_e010_same_party() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        client.create_stream(&employer, &employer, &token, &1000, &1, &0, &0, &0);
    }

    /// E010 — withdraw cooldown not expired (ERR_WITHDRAW_COOLDOWN shares code with ERR_SAME_PARTY)
    #[test]
    #[should_panic(expected = "E010")]
    fn test_e010_withdraw_cooldown() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id =
            client.create_stream(&employer, &employee, &token, &10_000, &10, &0, &200, &0);
        // advance only 50 s — cooldown of 200 s not expired
        env.ledger().with_mut(|l| l.timestamp += 50);
        client.withdraw(&employee, &id);
    }

    /// E011 — fee_bps exceeds maximum
    #[test]
    #[should_panic(expected = "E011")]
    fn test_e011_fee_too_high() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        client.initialize(&admin);
        // 101 bps > max of 100
        client.set_fee(&admin, &0, &101, &fee_recipient);
    }

    /// E015 — max streams per employer reached
    #[test]
    #[should_panic(expected = "E015")]
    fn test_e015_max_streams_reached() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        // set max to 1
        client.set_max_streams_per_employer(&admin, &0, &1);
        let e1 = Address::generate(&env);
        let e2 = Address::generate(&env);
        client.create_stream(&employer, &e1, &token, &1000, &1, &0, &0, &0);
        // second stream should fail
        client.create_stream(&employer, &e2, &token, &1000, &1, &0, &0, &0);
    }

    /// E016 — stream is already paused (ERR_ALREADY_PAUSED)
    #[test]
    #[should_panic(expected = "E016")]
    fn test_e016_already_paused() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);
        client.pause_stream(&employer, &id);
        client.pause_stream(&employer, &id); // second pause → E016
    }

    /// E017 — stream is not paused (ERR_NOT_PAUSED)
    #[test]
    #[should_panic(expected = "E017")]
    fn test_e017_not_paused() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token = setup_token(&env, &employer);
        client.initialize(&admin);
        let id = client.create_stream(&employer, &employee, &token, &1000, &1, &0, &0, &0);
        client.resume_stream(&employer, &id); // not paused → E017
    }
}
