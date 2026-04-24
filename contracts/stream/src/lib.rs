#![no_std]

mod events;
mod storage;
mod types;
mod validate;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, Vec};
use storage::{
    claimable_amount, consume_admin_nonce, get_admin, get_admin_nonce, get_employee_streams,
    get_employer_streams, get_min_deposit, index_employee_stream, index_employer_stream,
    load_stream, next_id, save_stream, set_admin, set_min_deposit,
};
use types::{
    DataKey, Stream, StreamParams, StreamStatus, ERR_REENTRANT, ERR_STREAM_CANCELLED,
    ERR_STREAM_EXHAUSTED, ERR_ZERO_DEPOSIT, ERR_ZERO_RATE,
};
use validate::{validate_create_stream, validate_top_up};

fn get_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}

#[contract]
pub struct StreamContract;

#[contractimpl]
impl StreamContract {
    /// Initialise with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        set_admin(&env, &admin);
    }

    /// Admin pauses the entire contract — blocks new streams and withdrawals.
    /// `nonce` must equal the current admin nonce (replay protection).
    pub fn pause_contract(env: Env, nonce: u64) {
        let admin = get_admin(&env);
        admin.require_auth();
        consume_admin_nonce(&env, nonce);
        set_paused(&env, true);
        events::contract_paused(&env, true);
    }

    /// Admin unpauses the contract, restoring normal operation.
    /// `nonce` must equal the current admin nonce (replay protection).
    pub fn unpause_contract(env: Env, nonce: u64) {
        let admin = get_admin(&env);
        admin.require_auth();
        consume_admin_nonce(&env, nonce);
        set_paused(&env, false);
        events::contract_paused(&env, false);
    }

    /// Set the minimum deposit enforced on create_stream.
    /// `nonce` must equal the current admin nonce (replay protection).
    pub fn set_min_deposit(env: Env, admin: Address, nonce: u64, amount: i128) {
        admin.require_auth();
        let stored_admin = get_admin(&env);
        assert_eq!(admin, stored_admin, "not the admin");
        consume_admin_nonce(&env, nonce);
        assert!(amount > 0, "{}", ERR_ZERO_DEPOSIT);
        set_min_deposit(&env, amount);
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
        assert!(!get_paused(&env), "contract is paused");

        let now = env.ledger().timestamp();
        let min_deposit = get_min_deposit(&env);
        validate_create_stream(deposit, min_deposit, rate_per_second, stop_time, now, &employer, &employee);

        let token_client = token::Client::new(&env, &token_address);
        token_client.balance(&employer); // SEP-41 probe
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
        index_employee_stream(&env, &employee, id);
        events::stream_created(&env, id, &employer, &employee, rate_per_second);
        id
    }

    /// Employer creates multiple salary streams atomically in a single transaction.
    pub fn create_streams_batch(
        env: Env,
        employer: Address,
        params: Vec<StreamParams>,
    ) -> Vec<u64> {
        employer.require_auth();
        assert!(!get_paused(&env), "contract is paused");
        assert!(!params.is_empty(), "params must not be empty");

        let now = env.ledger().timestamp();
        let min_deposit = get_min_deposit(&env);
        let mut ids: Vec<u64> = Vec::new(&env);

        for p in params.iter() {
            validate_create_stream(p.deposit, min_deposit, p.rate_per_second, p.stop_time, now, &employer, &p.employee);

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
                locked: false,
            };
            save_stream(&env, &stream);
            index_employer_stream(&env, &employer, id);
            index_employee_stream(&env, &p.employee, id);
            events::stream_created(&env, id, &employer, &p.employee, p.rate_per_second);
            ids.push_back(id);
        }

        ids
    }

    /// Employee withdraws all claimable tokens earned so far.
    pub fn withdraw(env: Env, employee: Address, stream_id: u64) -> i128 {
        employee.require_auth();
        assert!(!get_paused(&env), "contract is paused");
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employee, employee, "not the employee");
        assert!(
            stream.status == StreamStatus::Active || stream.status == StreamStatus::Exhausted,
            "stream not active"
        );

        let now = env.ledger().timestamp();
        let amount = claimable_amount(&stream, now);
        if amount == 0 {
            return 0;
        }

        assert!(!stream.locked, "{}", ERR_REENTRANT);
        stream.locked = true;
        save_stream(&env, &stream);

        stream.withdrawn = stream
            .withdrawn
            .checked_add(amount)
            .expect("withdrawn overflow");
        stream.last_withdraw_time = now;
        if stream.withdrawn >= stream.deposit {
            stream.status = StreamStatus::Exhausted;
        }

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(&env.current_contract_address(), &employee, &amount);

        stream.locked = false;
        save_stream(&env, &stream);
        events::withdrawn(&env, stream_id, &employee, amount);
        amount
    }

    /// Employer tops up an active stream with additional funds.
    pub fn top_up(env: Env, employer: Address, stream_id: u64, amount: i128) {
        employer.require_auth();
        validate_top_up(amount);
        let mut stream = load_stream(&env, stream_id).expect("stream not found");
        assert_eq!(stream.employer, employer, "not the employer");
        assert!(stream.status != StreamStatus::Cancelled, "{}", ERR_STREAM_CANCELLED);
        assert!(stream.status != StreamStatus::Exhausted, "{}", ERR_STREAM_EXHAUSTED);

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(&employer, &env.current_contract_address(), &amount);

        stream.deposit = stream
            .deposit
            .checked_add(amount)
            .expect("deposit overflow");
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

        let refund = stream.deposit.checked_sub(stream.withdrawn).unwrap_or(0).max(0);
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
    pub fn claimable_at(env: Env, stream_id: u64, timestamp: u64) -> i128 {
        let stream = load_stream(&env, stream_id).expect("stream not found");
        claimable_amount(&stream, timestamp)
    }

    /// Admin upgrades the contract WASM in-place.
    /// `nonce` must equal the current admin nonce (replay protection).
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>, nonce: u64) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
        consume_admin_nonce(&env, nonce);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// No-op migration hook called after an upgrade.
    pub fn migrate(env: Env, admin: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        assert_eq!(admin, stored_admin, "not the admin");
    }

    /// Total streams created.
    pub fn stream_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::StreamCount)
            .unwrap_or(0)
    }

    /// Current admin nonce (useful for callers building admin transactions).
    pub fn admin_nonce(env: Env) -> u64 {
        get_admin_nonce(&env)
    }

    /// Return all stream IDs owned by `employer`.
    pub fn streams_by_employer(env: Env, employer: Address) -> Vec<u64> {
        get_employer_streams(&env, &employer)
    }

    /// Return all stream IDs paying `employee`.
    pub fn streams_by_employee(env: Env, employee: Address) -> Vec<u64> {
        get_employee_streams(&env, &employee)
    }
}
