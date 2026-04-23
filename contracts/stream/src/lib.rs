#![no_std]

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};
use storage::{claimable_amount, get_admin, load_stream, next_id, save_stream, set_admin};
use types::{DataKey, Stream, StreamParams, StreamStatus};

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
        assert!(deposit > 0, "deposit must be positive");
        assert!(rate_per_second > 0, "rate must be positive");

        let now = env.ledger().timestamp();
        if stop_time > 0 {
            assert!(stop_time > now, "stop_time must be in the future");
        }

        // Pull deposit from employer into this contract
        let token_client = token::Client::new(&env, &token_address);
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
        };
        save_stream(&env, &stream);
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
    pub fn withdraw(env: Env, employee: Address, stream_id: u64) -> i128 {
        employee.require_auth();
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employee, employee, "not the employee");
        assert_eq!(stream.status, StreamStatus::Active, "stream not active");

        let now = env.ledger().timestamp();
        let amount = claimable_amount(&stream, now);
        assert!(amount > 0, "nothing to withdraw");

        stream.withdrawn += amount;
        stream.last_withdraw_time = now;

        // Mark exhausted if fully drained
        if stream.withdrawn >= stream.deposit {
            stream.status = StreamStatus::Exhausted;
        }

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(&env.current_contract_address(), &employee, &amount);

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

        stream.deposit += amount;
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
            stream.withdrawn += claimable;
        }

        // Return remaining deposit to employer
        let refund = stream.deposit - stream.withdrawn;
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

    /// Total streams created.
    pub fn stream_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::StreamCount).unwrap_or(0)
    }
}
