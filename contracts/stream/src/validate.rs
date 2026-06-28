use soroban_sdk::{contracttype, Address, Env, Map};

use crate::types::DataKey;

/// Validate that employer and employee are distinct addresses (no self-transfer).
pub fn require_distinct(employer: &Address, employee: &Address) {
    assert!(employer != employee, "employer and employee must be different addresses");
}

/// Address book: employers can register trusted employee addresses.
/// Key: employer address → Map<label: u32, Address>
#[contracttype]
pub enum AddrBookKey {
    Book(Address),
}

/// Add an address to the caller's address book under a numeric label.
pub fn address_book_add(env: &Env, owner: &Address, label: u32, addr: &Address) {
    let key = AddrBookKey::Book(owner.clone());
    let mut book: Map<u32, Address> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Map::new(env));
    book.set(label, addr.clone());
    env.storage().persistent().set(&key, &book);
}

/// Look up an address from the caller's address book by label.
pub fn address_book_get(env: &Env, owner: &Address, label: u32) -> Option<Address> {
    let key = AddrBookKey::Book(owner.clone());
    let book: Map<u32, Address> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Map::new(env));
    book.get(label)
}
