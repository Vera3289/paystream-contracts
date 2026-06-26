use soroban_sdk::{Env, Address, symbol_short};

// Naming convention: topic = (event_name_symbol, stream_id)
// Data = full relevant state for off-chain indexing.

pub fn stream_created(env: &Env, id: u64, employer: &Address, employee: &Address, rate: i128, deposit: i128, token: &Address, stop_time: u64) {
    env.events().publish(
        (symbol_short!("created"), id),
        (employer.clone(), employee.clone(), token.clone(), deposit, rate, stop_time),
    );
}

pub fn withdrawn(env: &Env, id: u64, employee: &Address, amount: i128, total_withdrawn: i128) {
    env.events().publish(
        (symbol_short!("withdraw"), id),
        (employee.clone(), amount, total_withdrawn),
    );
}

pub fn topped_up(env: &Env, id: u64, employer: &Address, amount: i128, new_deposit: i128) {
    env.events().publish(
        (symbol_short!("topup"), id),
        (employer.clone(), amount, new_deposit),
    );
}

pub fn stream_paused(env: &Env, id: u64, employer: &Address) {
    env.events().publish(
        (symbol_short!("paused"), id),
        employer.clone(),
    );
}

pub fn stream_resumed(env: &Env, id: u64, employer: &Address) {
    env.events().publish(
        (symbol_short!("resumed"), id),
        employer.clone(),
    );
}

pub fn stream_cancelled(env: &Env, id: u64, employer: &Address, employee_payout: i128, employer_refund: i128) {
    env.events().publish(
        (symbol_short!("cancel"), id),
        (employer.clone(), employee_payout, employer_refund),
    );
}
