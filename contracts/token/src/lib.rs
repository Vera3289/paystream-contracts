#![no_std]

mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env};
use storage::{
    allowance, balance_of, get_admin, set_admin, set_allowance,
    set_balance, set_total_supply, total_supply,
};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(env: Env, admin: Address, initial_supply: i128) {
        admin.require_auth();
        set_admin(&env, &admin);
        set_balance(&env, &admin, initial_supply);
        set_total_supply(&env, initial_supply);
    }

    pub fn total_supply(env: Env) -> i128 { total_supply(&env) }

    pub fn balance(env: Env, owner: Address) -> i128 { balance_of(&env, &owner) }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let from_bal = balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        set_balance(&env, &from, from_bal - amount);
        set_balance(&env, &to, balance_of(&env, &to) + amount);
    }

    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        set_allowance(&env, &owner, &spender, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let allowed = allowance(&env, &from, &spender);
        assert!(allowed >= amount, "allowance exceeded");
        let from_bal = balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        set_allowance(&env, &from, &spender, allowed - amount);
        set_balance(&env, &from, from_bal - amount);
        set_balance(&env, &to, balance_of(&env, &to) + amount);
    }

    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        admin.require_auth();
        assert_eq!(get_admin(&env), admin, "not admin");
        assert!(amount > 0, "amount must be positive");
        set_balance(&env, &to, balance_of(&env, &to) + amount);
        set_total_supply(&env, total_supply(&env) + amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let bal = balance_of(&env, &from);
        assert!(bal >= amount, "insufficient balance");
        set_balance(&env, &from, bal - amount);
        set_total_supply(&env, total_supply(&env) - amount);
    }

    /// Burn tokens on behalf of `from` using an existing allowance.
    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        assert!(amount > 0, "amount must be positive");
        let allowed = allowance(&env, &from, &spender);
        assert!(allowed >= amount, "allowance exceeded");
        let bal = balance_of(&env, &from);
        assert!(bal >= amount, "insufficient balance");
        set_allowance(&env, &from, &spender, allowed - amount);
        set_balance(&env, &from, bal - amount);
        set_total_supply(&env, total_supply(&env) - amount);
    }
}
