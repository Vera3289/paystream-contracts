use soroban_sdk::{contracttype, Address};

/// Status of a salary stream.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum StreamStatus {
    Active,
    Paused,
    Cancelled,
    Exhausted,
}

/// A salary stream: employer deposits funds, employee withdraws per-second.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Stream {
    pub id: u64,
    pub employer: Address,
    pub employee: Address,
    pub token: Address,       // SAC token contract address
    pub deposit: i128,        // total deposited amount
    pub withdrawn: i128,      // total already withdrawn
    pub rate_per_second: i128, // tokens streamed per second
    pub start_time: u64,      // ledger timestamp when stream started
    pub stop_time: u64,       // 0 = no end, else hard stop timestamp
    pub last_withdraw_time: u64,
    pub status: StreamStatus,
}

/// Storage keys.
#[contracttype]
pub enum DataKey {
    Stream(u64),
    StreamCount,
    Admin,
}

/// Parameters for a single stream inside a batch creation call.
#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamParams {
    pub employee: Address,
    pub token: Address,
    pub deposit: i128,
    pub rate_per_second: i128,
    pub stop_time: u64,
}
