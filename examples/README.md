# PayStream SDK Examples

Runnable examples for interacting with PayStream contracts from off-chain clients.

| Language | Directory | Run command |
|---|---|---|
| JavaScript | [javascript/](javascript/) | `node stream.js` |
| Python | [python/](python/) | `python stream.py` |
| Rust | [rust/](rust/) | `cargo run` |

## Setup

Each example reads contract IDs and keys from environment variables:

```bash
export EMPLOYER_SECRET="S..."       # employer Stellar secret key
export EMPLOYEE_PUBLIC="G..."       # employee Stellar public key
export TOKEN_CONTRACT_ID="C..."     # SEP-41 token contract ID
export STREAM_CONTRACT_ID="C..."    # PayStream stream contract ID
```

Deploy contracts to testnet first: see [docs/testnet.md](../docs/testnet.md).

## What each example does

1. Creates a stream (3600 deposit, 1 stroop/second, no stop time)
2. Queries the stream state
3. Queries the claimable amount

For a full TypeScript frontend integration guide see [docs/integration/frontend.md](../docs/integration/frontend.md).
