// SPDX-License-Identifier: Apache-2.0

#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env};
use storage::{
    allowance, balance_of, get_admin, set_admin, set_allowance,
    set_balance, set_total_supply, total_supply,
};

pub const MAX_SUPPLY: i128 = 1_000_000_000_000_000_000;
const ERR_SUPPLY_CAP_EXCEEDED: &str = "supply cap exceeded";

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    /// Initialise the token contract with an admin and an initial supply.
    ///
    /// Mints `initial_supply` tokens directly to `admin`. Must be called once
    /// after deployment before any other function.
    ///
    /// # Parameters
    /// - `admin` — address that becomes the token admin (can mint)
    /// - `initial_supply` — tokens minted to `admin` on initialisation
    ///
    /// # Errors
    /// - Panics if `admin` auth fails
    /// - Panics if `initial_supply` exceeds `MAX_SUPPLY`
    pub fn initialize(env: Env, admin: Address, initial_supply: i128) {
        admin.require_auth();
        assert!(initial_supply >= 0, "amount must be positive");
        assert!(initial_supply <= MAX_SUPPLY, "{}", ERR_SUPPLY_CAP_EXCEEDED);
        set_admin(&env, &admin);
        set_balance(&env, &admin, initial_supply);
        set_total_supply(&env, initial_supply);
    }

    /// Return the total token supply.
    ///
    /// # Returns
    /// Current total supply as `i128`.
    pub fn total_supply(env: Env) -> i128 { total_supply(&env) }

    /// Return the token balance of `owner`.
    ///
    /// # Parameters
    /// - `owner` — address to query
    ///
    /// # Returns
    /// Balance as `i128`; 0 if the address has never held tokens.
    pub fn balance(env: Env, owner: Address) -> i128 { balance_of(&env, &owner) }

    /// Transfer `amount` tokens from `from` to `to`.
    ///
    /// # Parameters
    /// - `from` — sender (requires auth)
    /// - `to` — recipient
    /// - `amount` — number of tokens to transfer (must be > 0)
    ///
    /// # Errors
    /// - Panics if `amount` ≤ 0
    /// - Panics if `from` has insufficient balance
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let from_bal = balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        set_balance(&env, &from, from_bal - amount);
        set_balance(&env, &to, balance_of(&env, &to) + amount);
    }

    /// Approve `spender` to transfer up to `amount` tokens on behalf of `owner`.
    ///
    /// Overwrites any existing allowance. Set `amount` to 0 to revoke.
    ///
    /// # Parameters
    /// - `owner` — token owner (requires auth)
    /// - `spender` — address being approved
    /// - `amount` — new allowance
    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        set_allowance(&env, &owner, &spender, amount);
    }

    /// Transfer `amount` tokens from `from` to `to` using `spender`'s allowance.
    ///
    /// # Parameters
    /// - `spender` — address with an existing allowance (requires auth)
    /// - `from` — token owner
    /// - `to` — recipient
    /// - `amount` — number of tokens to transfer
    ///
    /// # Errors
    /// - Panics if `spender`'s allowance for `from` is insufficient
    /// - Panics if `from` has insufficient balance
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

    /// Mint `amount` new tokens to `to`, increasing total supply.
    ///
    /// Only the admin may call this function.
    ///
    /// # Parameters
    /// - `admin` — must match the stored admin (requires auth)
    /// - `to` — recipient of minted tokens
    /// - `amount` — number of tokens to mint (must be > 0)
    ///
    /// # Errors
    /// - Panics if `admin` auth fails or does not match stored admin
    /// - Panics if `amount` ≤ 0
    /// - Panics if minting would exceed `MAX_SUPPLY`
    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        admin.require_auth();
        assert_eq!(get_admin(&env), admin, "not admin");
        assert!(amount > 0, "amount must be positive");
        let current_supply = total_supply(&env);
        let new_supply = current_supply
            .checked_add(amount)
            .expect("supply overflow");
        assert!(new_supply <= MAX_SUPPLY, "{}", ERR_SUPPLY_CAP_EXCEEDED);
        set_balance(&env, &to, balance_of(&env, &to) + amount);
        set_total_supply(&env, new_supply);
    }

    /// Burn `amount` tokens from `from`'s own balance, reducing total supply.
    ///
    /// # Parameters
    /// - `from` — address whose tokens are burned (requires auth)
    /// - `amount` — number of tokens to burn (must be > 0)
    ///
    /// # Errors
    /// - Panics if `amount` ≤ 0
    /// - Panics if `from` has insufficient balance
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let bal = balance_of(&env, &from);
        assert!(bal >= amount, "insufficient balance");
        set_balance(&env, &from, bal - amount);
        set_total_supply(&env, total_supply(&env) - amount);
    }

    /// Burn `amount` tokens from `from` using `spender`'s allowance.
    ///
    /// Reduces both `from`'s balance and the total supply.
    ///
    /// # Parameters
    /// - `spender` — address with an existing allowance (requires auth)
    /// - `from` — token owner whose tokens are burned
    /// - `amount` — number of tokens to burn (must be > 0)
    ///
    /// # Errors
    /// - Panics if `amount` ≤ 0
    /// - Panics if `spender`'s allowance for `from` is insufficient
    /// - Panics if `from` has insufficient balance
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

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Address, Env};

    fn setup() -> (Env, TokenContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(TokenContract, ());
        let client = TokenContractClient::new(&env, &id);
        (env, client)
    }

    #[test]
    fn test_initialize() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &1_000_000);
        assert_eq!(client.total_supply(), 1_000_000);
        assert_eq!(client.balance(&admin), 1_000_000);
    }

    #[test]
    fn test_transfer() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin, &1_000);
        client.transfer(&admin, &user, &400);
        assert_eq!(client.balance(&admin), 600);
        assert_eq!(client.balance(&user), 400);
    }

    #[test]
    fn test_mint_and_burn() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin, &1_000);
        client.mint(&admin, &user, &500);
        assert_eq!(client.total_supply(), 1_500);
        // holder burns their own tokens
        client.burn(&user, &200);
        assert_eq!(client.total_supply(), 1_300);
        assert_eq!(client.balance(&user), 300);
    }

    #[test]
    fn test_burn_from_with_allowance() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let spender = Address::generate(&env);
        client.initialize(&admin, &1_000);
        client.transfer(&admin, &user, &500);
        client.approve(&user, &spender, &300);
        client.burn_from(&spender, &user, &200);
        assert_eq!(client.balance(&user), 300);
        assert_eq!(client.total_supply(), 800);
    }

    #[test]
    #[should_panic(expected = "allowance exceeded")]
    fn test_burn_from_exceeds_allowance() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let spender = Address::generate(&env);
        client.initialize(&admin, &1_000);
        client.transfer(&admin, &user, &500);
        client.approve(&user, &spender, &100);
        client.burn_from(&spender, &user, &200);
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_burn_insufficient_balance() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin, &100);
        client.transfer(&admin, &user, &50);
        client.burn(&user, &200);
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_transfer_overdraft() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin, &100);
        client.transfer(&admin, &user, &999);
    }

    #[test]
    fn test_mint_to_cap_succeeds() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin, &0);
        client.mint(&admin, &user, &MAX_SUPPLY);
        assert_eq!(client.total_supply(), MAX_SUPPLY);
        assert_eq!(client.balance(&user), MAX_SUPPLY);
    }

    #[test]
    #[should_panic(expected = "supply cap exceeded")]
    fn test_mint_beyond_cap_fails() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin, &0);
        client.mint(&admin, &user, &MAX_SUPPLY);
        client.mint(&admin, &user, &1);
    }

    #[test]
    #[should_panic(expected = "supply cap exceeded")]
    fn test_initialize_beyond_cap_fails() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &MAX_SUPPLY + 1);
    }
}
