# PayStream Contracts

[![CI](https://github.com/Vera3289/paystream-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/Vera3289/paystream-contracts/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Soroban smart contracts for **PayStream** — decentralized payroll and salary streaming on the Stellar blockchain.

PayStream lets employers stream salaries to employees in real-time, per-second. Instead of waiting for a monthly paycheck, employees earn and can withdraw their salary continuously as they work — fully on-chain, trustless, and transparent.

> 🎬 **[Watch the demo](https://youtu.be/paystream-demo)** — see the full `create_stream → withdraw` flow in action.

---

## Why PayStream?

- **Real-time pay** — employees access earned wages any time, not just payday
- **Trustless escrow** — funds locked on-chain; employer cannot claw back earned salary
- **Transparent** — every stream, withdrawal, and cancellation is an immutable on-chain event
- **Stellar-native** — built on Stellar's fast, low-fee infrastructure with Soroban smart contracts
- **Flexible** — pause, resume, top-up, or cancel streams; optional hard stop time
- **Multi-token** — each stream can use any [SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) compliant token; employer and employee can run concurrent streams in different assets

---

## Project Structure

```
.
├── contracts
│   ├── stream              # Core salary streaming and escrow contract
│   │   ├── src
│   │   │   ├── lib.rs      # Stream entrypoints
│   │   │   ├── storage.rs  # Persistence and claimable calculation
│   │   │   ├── events.rs   # On-chain event publishing
│   │   │   ├── types.rs    # Domain models and storage keys
│   │   │   └── test.rs     # Contract tests
│   │   └── Cargo.toml
│   └── token               # Fungible payment token contract
│       ├── src
│       │   ├── lib.rs
│       │   ├── storage.rs
│       │   ├── types.rs
│       │   └── test.rs
│       └── Cargo.toml
├── scripts
│   ├── build.sh
│   ├── deploy-local.sh
│   ├── deploy-testnet.sh
│   └── init-testnet.sh
├── Cargo.toml
├── Makefile
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

---

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)

```bash
git clone https://github.com/Vera3289/paystream-contracts.git
cd paystream-contracts
rustup target add wasm32-unknown-unknown
```

### Build

```bash
make build
# or: stellar contract build
```

### Test

```bash
make test
# or: cargo test
```

### Format & Lint

```bash
make fmt-check
make lint
```

---

### Docker (no local Rust/Stellar CLI required)

Build and test entirely inside Docker — no local Rust or Stellar CLI installation needed.

**Run tests:**
```bash
docker compose run --rm test
```

**Build contracts only:**
```bash
docker compose run --rm build stellar contract build
```

The `cargo-cache` volume persists the Cargo registry between runs so subsequent builds are fast.

---

## Stream Contract Reference

> Full parameter, return value, error, and example documentation: **[docs/api-reference.md](docs/api-reference.md)**

### Functions

| Function | Caller | Description |
|---|---|---|
| `initialize(admin)` | Admin | Set contract admin |
| `create_stream(employer, employee, token, deposit, rate_per_second, stop_time)` | Employer | Create stream, lock deposit |
| `create_streams_batch(employer, params)` | Employer | Create multiple streams atomically; all succeed or all revert |
| `withdraw(employee, stream_id)` | Employee | Withdraw all claimable earnings |
| `top_up(employer, stream_id, amount)` | Employer | Add more funds to active stream |
| `pause_stream(employer, stream_id)` | Employer | Pause accrual |
| `resume_stream(employer, stream_id)` | Employer | Resume accrual |
| `cancel_stream(employer, stream_id)` | Employer | Pay employee earned share, refund remainder |
| `get_stream(stream_id)` | Anyone | Read stream state |
| `claimable(stream_id)` | Anyone | Query withdrawable amount right now |
| `stream_count()` | Anyone | Total streams created |

### Batch vs Individual Stream Creation — Fee Comparison

| Approach | Transactions | Approx. fee |
|---|---|---|
| N individual `create_stream` calls | N | N × base fee |
| One `create_streams_batch` call | 1 | 1 × base fee + per-stream resource overhead |

`create_streams_batch` is cheaper for N ≥ 2 because Stellar charges one base fee per transaction. Per-stream resource overhead grows linearly but is far smaller than the per-transaction base fee saved.

### Stream Status Lifecycle

```
Active → Paused → Active
Active → Cancelled
Active → Exhausted  (deposit fully streamed)
```

### Claimable Calculation

```
claimable = min(
    (now - last_withdraw_time) * rate_per_second,
    deposit - withdrawn
)
```

Time is capped at `stop_time` if set. Paused time is excluded.

---

## Deployment

### Testnet

```bash
./scripts/build.sh
./scripts/deploy-testnet.sh

export STELLAR_ADMIN_ADDRESS=<YOUR_PUBLIC_KEY>
export TOKEN_CONTRACT_ID=<FROM_DEPLOY>
export STREAM_CONTRACT_ID=<FROM_DEPLOY>
./scripts/init-testnet.sh
```

### Local

```bash
make deploy-local
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Blockchain | Stellar (Soroban) |
| Language | Rust |
| SDK | Soroban SDK v22.0.0 |
| CI/CD | GitHub Actions |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities to `security@paystream.example` — not via public issues.

## License

[Apache 2.0](LICENSE)

---

Built with ❤️ on Stellar
