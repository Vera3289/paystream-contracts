// SPDX-License-Identifier: Apache-2.0

use soroban_sdk::{Env, Address};
use crate::types::TokenDataKey;

pub fn balance_of(env: &Env, owner: &Address) -> i128 {
    env.storage().persistent().get(&TokenDataKey::Balance(owner.clone())).unwrap_or(0)
}

pub fn set_balance(env: &Env, owner: &Address, amount: i128) {
    env.storage().persistent().set(&TokenDataKey::Balance(owner.clone()), &amount);
}

pub fn allowance(env: &Env, owner: &Address, spender: &Address) -> i128 {
    env.storage()
        .temporary()
        .get(&TokenDataKey::Allowance(owner.clone(), spender.clone()))
        .unwrap_or(0)
}

pub fn set_allowance(env: &Env, owner: &Address, spender: &Address, amount: i128) {
    env.storage()
        .temporary()
        .set(&TokenDataKey::Allowance(owner.clone(), spender.clone()), &amount);
}

pub fn total_supply(env: &Env) -> i128 {
    env.storage().instance().get(&TokenDataKey::TotalSupply).unwrap_or(0)
}

pub fn set_total_supply(env: &Env, supply: i128) {
    env.storage().instance().set(&TokenDataKey::TotalSupply, &supply);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&TokenDataKey::Admin).expect("admin not set")
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&TokenDataKey::Admin, admin);
}

pub fn is_minter(env: &Env, address: &Address) -> bool {
    env.storage()
        .instance()
        .get(&TokenDataKey::Minter(address.clone()))
        .unwrap_or(false)
}

pub fn set_minter(env: &Env, address: &Address, enabled: bool) {
    env.storage()
        .instance()
        .set(&TokenDataKey::Minter(address.clone()), &enabled);
}
