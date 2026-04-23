#![no_std]

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Env};
use storage::{claimable_amount, load_stream, next_id, save_stream, set_admin};
use types::{DataKey, Stream, StreamStatus, ERR_REENTRANT, ERR_ZERO_DEPOSIT, ERR_ZERO_RATE};

#[contract]
pub struct StreamContract;

#[contractimpl]
impl StreamContract {
    /// Initialise with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        set_admin(&env, &admin);
    }

    /// Employer creates a salary stream and deposits funds into the contract.
    /// `stop_time` = 0 means indefinite; otherwise a hard end timestamp.
    ///
    /// # Panics
    /// - `E001` if `rate_per_second` is 0 (stream would never pay out, locking
    ///   the deposit permanently).
    /// - `E002` if `deposit` is not positive.
    pub fn create_stream(
        env: Env,
        employer: Address,
        employee: Address,
        token_address: Address,
        deposit: i128,
        rate_per_second: i128,
        stop_time: u64,
    ) -> u64 {
        employer.require_auth();
        assert!(deposit > 0, "{}", ERR_ZERO_DEPOSIT);
        // Issue #3: a zero rate produces a permanently stuck deposit because
        // claimable_amount would always return 0.  Reject it explicitly.
        assert!(rate_per_second > 0, "{}", ERR_ZERO_RATE);

        let now = env.ledger().timestamp();
        if stop_time > 0 {
            assert!(stop_time > now, "stop_time must be in the future");
        }

        // Validate token is SEP-41 compliant by probing the balance interface,
        // then pull deposit from employer into this contract.
        let token_client = token::Client::new(&env, &token_address);
        token_client.balance(&employer); // panics if token is not SEP-41
        token_client.transfer(&employer, &env.current_contract_address(), &deposit);

        let id = next_id(&env);
        let stream = Stream {
            id,
            employer: employer.clone(),
            employee: employee.clone(),
            token: token_address,
            deposit,
            withdrawn: 0,
            rate_per_second,
            start_time: now,
            stop_time,
            last_withdraw_time: now,
            status: StreamStatus::Active,
            locked: false,
        };
        save_stream(&env, &stream);
        index_employer_stream(&env, &employer, id);
        events::stream_created(&env, id, &employer, &employee, rate_per_second);
        id
    }

    /// Employer creates multiple salary streams atomically in a single transaction.
    /// All streams succeed or the entire transaction reverts — no partial state.
    /// Returns the list of newly created stream IDs in the same order as `params`.
    pub fn create_streams_batch(
        env: Env,
        employer: Address,
        params: Vec<StreamParams>,
    ) -> Vec<u64> {
        employer.require_auth();
        assert!(!params.is_empty(), "params must not be empty");

        let now = env.ledger().timestamp();
        let mut ids: Vec<u64> = Vec::new(&env);

        for p in params.iter() {
            assert!(p.deposit > 0, "deposit must be positive");
            assert!(p.rate_per_second > 0, "rate must be positive");
            if p.stop_time > 0 {
                assert!(p.stop_time > now, "stop_time must be in the future");
            }

            let token_client = token::Client::new(&env, &p.token);
            token_client.balance(&employer); // SEP-41 probe
            token_client.transfer(&employer, &env.current_contract_address(), &p.deposit);

            let id = next_id(&env);
            let stream = Stream {
                id,
                employer: employer.clone(),
                employee: p.employee.clone(),
                token: p.token.clone(),
                deposit: p.deposit,
                withdrawn: 0,
                rate_per_second: p.rate_per_second,
                start_time: now,
                stop_time: p.stop_time,
                last_withdraw_time: now,
                status: StreamStatus::Active,
            };
            save_stream(&env, &stream);
            events::stream_created(&env, id, &employer, &p.employee, p.rate_per_second);
            ids.push_back(id);
        }

        ids
    }

    /// Employee withdraws all claimable tokens earned so far.
    ///
    /// # Reentrancy analysis
    /// Soroban contracts execute within a single-threaded, atomic transaction
    /// frame.  Cross-contract calls are synchronous and the host does **not**
    /// allow a callee to re-enter the caller mid-execution; the caller's
    /// storage is not visible to the callee until the call returns.  Therefore
    /// no reentrant execution path exists in the current implementation.
    ///
    /// The `locked` flag on the stream is kept as defence-in-depth: if a
    /// future protocol upgrade introduces callbacks or the token contract is
    /// replaced with one that fires a hook, the guard will catch the attempt
    /// and panic with `E003` before any state mutation occurs.
    pub fn withdraw(env: Env, employee: Address, stream_id: u64) -> i128 {
        employee.require_auth();
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employee, employee, "not the employee");
        assert_eq!(stream.status, StreamStatus::Active, "stream not active");

        // Reentrancy guard – set before any cross-contract call (Issue #1)
        assert!(!stream.locked, "{}", ERR_REENTRANT);
        stream.locked = true;
        save_stream(&env, &stream);

        let now = env.ledger().timestamp();
        let amount = claimable_amount(&stream, now);
        assert!(amount > 0, "nothing to withdraw");

        stream.withdrawn = stream
            .withdrawn
            .checked_add(amount)
            .expect("withdrawn overflow");
        stream.last_withdraw_time = now;
        // Single comparison; avoids re-reading deposit from the struct twice.
        if stream.withdrawn >= stream.deposit {
            stream.status = StreamStatus::Exhausted;
        }

        // Cross-contract call – guard is already persisted above
        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(&env.current_contract_address(), &employee, &amount);

        // Release guard and persist final state
        stream.locked = false;
        save_stream(&env, &stream);
        events::withdrawn(&env, stream_id, &employee, amount);
        amount
    }

    /// Employer tops up an active stream with additional funds.
    pub fn top_up(env: Env, employer: Address, stream_id: u64, amount: i128) {
        employer.require_auth();
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employer, employer, "not the employer");
        assert_eq!(stream.status, StreamStatus::Active, "stream not active");
        assert!(amount > 0, "amount must be positive");

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(&employer, &env.current_contract_address(), &amount);

        stream.deposit = stream
            .deposit
            .checked_add(amount)
            .expect("deposit overflow");
        if stream.status == StreamStatus::Exhausted {
            stream.status = StreamStatus::Active;
        }
        save_stream(&env, &stream);
        events::topped_up(&env, stream_id, &employer, amount);
    }

    /// Employer pauses an active stream.
    pub fn pause_stream(env: Env, employer: Address, stream_id: u64) {
        employer.require_auth();
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employer, employer, "not the employer");
        assert_eq!(stream.status, StreamStatus::Active, "stream not active");
        stream.status = StreamStatus::Paused;
        save_stream(&env, &stream);
        events::stream_status_changed(&env, stream_id, &StreamStatus::Paused);
    }

    /// Employer resumes a paused stream.
    pub fn resume_stream(env: Env, employer: Address, stream_id: u64) {
        employer.require_auth();
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employer, employer, "not the employer");
        assert_eq!(stream.status, StreamStatus::Paused, "stream not paused");
        // Reset last_withdraw_time to now so paused time is not counted
        stream.last_withdraw_time = env.ledger().timestamp();
        stream.status = StreamStatus::Active;
        save_stream(&env, &stream);
        events::stream_status_changed(&env, stream_id, &StreamStatus::Active);
    }

    /// Employer cancels a stream and reclaims unstreamed funds.
    pub fn cancel_stream(env: Env, employer: Address, stream_id: u64) {
        employer.require_auth();
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employer, employer, "not the employer");
        assert!(
            stream.status == StreamStatus::Active || stream.status == StreamStatus::Paused,
            "stream already ended"
        );

        // Pay out any claimable amount to employee first
        let now = env.ledger().timestamp();
        let claimable = claimable_amount(&stream, now);
        let token_client = token::Client::new(&env, &stream.token);

        if claimable > 0 {
            token_client.transfer(&env.current_contract_address(), &stream.employee, &claimable);
            stream.withdrawn = stream
                .withdrawn
                .checked_add(claimable)
                .expect("withdrawn overflow");
        }

        // Return remaining deposit to employer
        let refund = stream
            .deposit
            .checked_sub(stream.withdrawn)
            .unwrap_or(0)
            .max(0);
        if refund > 0 {
            token_client.transfer(&env.current_contract_address(), &employer, &refund);
        }

        stream.status = StreamStatus::Cancelled;
        save_stream(&env, &stream);
        events::stream_status_changed(&env, stream_id, &StreamStatus::Cancelled);
    }

    /// Read a stream by ID.
    pub fn get_stream(env: Env, stream_id: u64) -> Stream {
        load_stream(&env, stream_id).expect("stream not found")
    }

    /// How many tokens the employee can withdraw right now.
    pub fn claimable(env: Env, stream_id: u64) -> i128 {
        let stream = load_stream(&env, stream_id).expect("stream not found");
        claimable_amount(&stream, env.ledger().timestamp())
    }

    /// How many tokens would be claimable at an arbitrary timestamp.
    /// Useful for UI projections (future) and auditing (past).
    pub fn claimable_at(env: Env, stream_id: u64, timestamp: u64) -> i128 {
        let stream = load_stream(&env, stream_id).expect("stream not found");
        storage_claimable_at(&stream, timestamp)
    }

    /// Total streams created.
    pub fn stream_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::StreamCount).unwrap_or(0)
    }

    /// Return all stream IDs owned by `employer`. O(n) in the number of their streams,
    /// not the total stream count — backed by a per-employer index.
    pub fn streams_by_employer(env: Env, employer: Address) -> Vec<u64> {
        get_employer_streams(&env, &employer)
    }
}
