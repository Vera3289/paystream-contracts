# Development Environment Setup

This guide covers setting up the PayStream Contracts development environment locally and with Docker.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | latest stable | [rustup.rs](https://rustup.rs/) |
| Stellar CLI | latest | [docs](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| Docker | 24+ | [docker.com](https://www.docker.com/get-started) |
| Docker Compose | 2.x | bundled with Docker Desktop |
| Git | 2.x | system package manager |

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Vera3289/paystream-contracts.git
cd paystream-contracts
```

### 2. Install Rust WASM target

```bash
rustup target add wasm32-unknown-unknown
```

### 3. Install Stellar CLI

```bash
cargo install --locked stellar-cli --features opt
```

### 4. Build contracts

```bash
make build
# or: stellar contract build
```

### 5. Run tests

```bash
make test
# or: cargo test
```

---

## Docker Setup

### Build and run in a container

```bash
docker build -t paystream-dev .
docker run --rm paystream-dev make test
```

### Docker Compose (with local Stellar node)

```bash
docker compose -f docker/docker-compose.dev.yml up
```

This starts:
- `stellar-node` — local Stellar Quickstart node on port 8000
- `paystream-dev` — contract build/test environment

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STELLAR_NETWORK` | Target network (`local`, `testnet`, `mainnet`) | `local` |
| `STELLAR_RPC_URL` | Soroban RPC endpoint | `http://localhost:8000/soroban/rpc` |
| `STELLAR_ADMIN_ADDRESS` | Admin account public key | — |
| `TOKEN_CONTRACT_ID` | Deployed token contract ID | — |
| `STREAM_CONTRACT_ID` | Deployed stream contract ID | — |

Copy and populate the example env file:

```bash
cp .env.example .env
# edit .env with your values
```

---

## Database Initialization

PayStream contracts are fully on-chain — there is no off-chain database. Contract state lives in Stellar ledger entries.

To initialize contract state on a local node:

```bash
./scripts/deploy-local.sh
```

This deploys both contracts and runs `initialize(admin)` on the stream contract.

---

## First-Time Setup Verification

Run the full check to confirm your environment is ready:

```bash
make build   # should output .wasm files under target/
make test    # all tests should pass
make lint    # no warnings
```

---

## Common Issues and Solutions

### `wasm32-unknown-unknown` target missing

```
error: target 'wasm32-unknown-unknown' not found
```

**Fix:** `rustup target add wasm32-unknown-unknown`

---

### Stellar CLI not found

```
stellar: command not found
```

**Fix:** Ensure `~/.cargo/bin` is in your `PATH`:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

---

### Build fails with `soroban-sdk` version mismatch

**Fix:** Ensure you are on the latest stable Rust toolchain:

```bash
rustup update stable
```

---

### Local node not reachable

```
error: connection refused at http://localhost:8000
```

**Fix:** Start the local Stellar node:

```bash
docker compose -f docker/docker-compose.dev.yml up stellar-node
```

Wait ~30 seconds for the node to be ready, then retry.

---

### Tests fail with `ContractError`

Run with backtrace enabled for more detail:

```bash
RUST_BACKTRACE=1 cargo test
```

---

## Useful Make Targets

```bash
make build        # compile contracts to WASM
make test         # run all tests
make fmt          # format code
make fmt-check    # check formatting (CI)
make lint         # run clippy
make deploy-local # deploy to local Stellar node
```
