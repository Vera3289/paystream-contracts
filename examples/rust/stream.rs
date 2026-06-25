//! PayStream Rust off-chain client example — create a stream, query claimable.
//!
//! Run:
//!   cd examples/rust
//!   cargo run
//!
//! Set env vars before running:
//!   EMPLOYER_SECRET    — employer Stellar secret key (S...)
//!   EMPLOYEE_PUBLIC    — employee Stellar public key (G...)
//!   TOKEN_CONTRACT_ID  — SEP-41 token contract ID
//!   STREAM_CONTRACT_ID — PayStream stream contract ID

use anyhow::Result;
use stellar_sdk::{
    keypair::Keypair,
    network::Networks,
    soroban::{
        scval::{ScVal, ToScVal},
        server::SorobanServer,
    },
    transaction::TransactionBuilder,
};
use std::env;

const RPC_URL: &str = "https://soroban-testnet.stellar.org";

#[tokio::main]
async fn main() -> Result<()> {
    let employer_secret = env::var("EMPLOYER_SECRET")?;
    let employee_public = env::var("EMPLOYEE_PUBLIC")?;
    let token_id = env::var("TOKEN_CONTRACT_ID")?;
    let stream_contract_id = env::var("STREAM_CONTRACT_ID")?;

    let employer = Keypair::from_secret(&employer_secret)?;
    let server = SorobanServer::new(RPC_URL);

    // Build create_stream invocation
    let args = vec![
        employer.public_key().to_sc_val(),   // employer
        employee_public.to_sc_val(),          // employee
        token_id.to_sc_val(),                 // token
        ScVal::I128(3600),                    // deposit
        ScVal::I128(1),                       // rate_per_second
        ScVal::U64(0),                        // stop_time (0 = no end)
    ];

    let account = server.load_account(employer.public_key()).await?;
    let tx = TransactionBuilder::new(account, Networks::TESTNET)
        .invoke_contract(&stream_contract_id, "create_stream", args)
        .set_timeout(30)
        .build()?;

    let prepared = server.prepare_transaction(tx).await?;
    let signed = prepared.sign(&employer)?;
    let response = server.send_transaction(signed).await?;

    let stream_id = server.poll_transaction(&response.hash).await?;
    println!("Stream created, ID: {:?}", stream_id);

    // Query claimable (read-only simulation)
    let account = server.load_account(employer.public_key()).await?;
    let query_tx = TransactionBuilder::new(account, Networks::TESTNET)
        .invoke_contract(&stream_contract_id, "claimable", vec![stream_id])
        .set_timeout(30)
        .build()?;

    let sim = server.simulate_transaction(query_tx).await?;
    println!("Claimable: {:?}", sim.result);

    Ok(())
}
