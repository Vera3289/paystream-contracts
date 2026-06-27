// SPDX-License-Identifier: Apache-2.0

//! Test framework module — helper utilities, setup functions, and test data factories.
//!
//! These helpers mirror the patterns used in `contracts/stream/src/test.rs`.
//! To use these directly in the contract crate, copy them into the `#[cfg(test)]`
//! section of `contracts/stream/src/test.rs`.
//!
//! Run via: `cargo test -p paystream-stream`

// NOTE: This file documents the shared test framework helpers.
// The actual runnable tests live in `contracts/stream/src/test.rs`,
// `stress_tests.rs`, `security_tests.rs`, and `state_transition_tests.rs`
// in this directory — they use identical patterns.

#[cfg(test)]
pub mod helpers {
    use soroban_sdk::{testutils::Address as _, Address, Env};

    /// Standard test deposit large enough to survive most test scenarios.
    pub const DEFAULT_DEPOSIT: i128 = 10_000;
    /// Default rate: 10 tokens per second.
    pub const DEFAULT_RATE: i128 = 10;
    /// Large deposit for stress tests (10 million tokens).
    pub const LARGE_DEPOSIT: i128 = 10_000_000;

    /// Register and initialise the stream contract; mock all auths.
    ///
    /// Returns `(env, client)`.  Place in `contracts/stream/src/` to compile.
    pub fn setup_stream() {
        // Inline version — see contracts/stream/src/test.rs for the real impl:
        //
        // let env = Env::default();
        // env.mock_all_auths();
        // let id = env.register(StreamContract, ());
        // let client = StreamContractClient::new(&env, &id);
        // (env, client)
    }

    /// Register a SEP-41 token, mint `supply` to `admin`, return its address.
    pub fn setup_token_with_supply() {
        // let token_id = env.register(paystream_token::TokenContract, ());
        // let token = paystream_token::TokenContractClient::new(env, &token_id);
        // token.initialize(admin, &supply);
        // token_id
    }

    /// Create a minimal active stream and return its `stream_id`.
    pub fn create_default_stream() {
        // client.create_stream(employer, employee, token, &DEFAULT_DEPOSIT,
        //                      &DEFAULT_RATE, &0, &0, &0)
    }

    /// Advance ledger by `secs` seconds.
    pub fn advance_time() {
        // env.ledger().with_mut(|l| l.timestamp += secs);
    }

    /// Assert token balance equals `expected`.
    pub fn assert_balance() {
        // assert_eq!(token.balance(addr), expected);
    }
}

#[cfg(test)]
mod framework_meta_tests {
    /// Verify the module compiles and the constants are sane.
    #[test]
    fn constants_are_positive() {
        assert!(super::helpers::DEFAULT_DEPOSIT > 0);
        assert!(super::helpers::DEFAULT_RATE > 0);
        assert!(super::helpers::LARGE_DEPOSIT > super::helpers::DEFAULT_DEPOSIT);
    }
}
