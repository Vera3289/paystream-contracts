# Developer Onboarding Guide

Welcome to PayStream! This guide covers everything you need to go from zero to making your first contribution.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Code Structure](#code-structure)
3. [Development Environment Setup](#development-environment-setup)
4. [Testing Strategy](#testing-strategy)
5. [Code Style Guide](#code-style-guide)
6. [Contributing Guidelines](#contributing-guidelines)
7. [Pull Request Process](#pull-request-process)

---

## Architecture Overview

PayStream is a set of **Soroban smart contracts** on the Stellar blockchain. There are two contracts:

### Stream Contract (`contracts/stream`)
The core contract. Manages the full lifecycle of salary streams:
- Holds token deposits in escrow
- Tracks per-stream state (rate, timestamps, status)
- Computes claimable balances in real-time
- Emits on-chain events for every state change

### Token Contract (`contracts/token`)
A minimal SEP-41 compliant fungible token used in tests and local deployments. On mainnet/testnet you use any existing SEP-41 token (e.g., USDC).

### Data Flow

```
Employer
  │
  ▼
create_stream() ──► escrow holds deposit ──► Stream{Active}
                                                  │
                              time passes ────────┤
                                                  │
Employee                                          ▼
  │◄──── withdraw() ◄── claimable accrues ────────┘
```

### State Machine

```
Active ──pause──► Paused ──resume──► Active
Active ──cancel──► Cancelled
Active ──(deposit exhausted)──► Exhausted
```

---

## Code Structure

```
.
├── contracts/
│   ├── stream/src/
│   │   ├── lib.rs        # Public entrypoints — the contract interface
│   │   ├── storage.rs    # Read/write helpers + claimable calculation
│   │   ├── events.rs     # On-chain event emission
│   │   ├── types.rs      # Domain structs (Stream, StreamStatus, StorageKey)
│   │   └── test.rs       # Integration tests
│   └── token/src/
│       ├── lib.rs        # SEP-41 entrypoints
│       ├── storage.rs    # Balance and allowance persistence
│       ├── types.rs      # Token domain types
│       └── test.rs       # Token tests
├── .github/workflows/    # CI/CD pipelines
├── docs/                 # API and developer documentation
├── scripts/              # Build, deploy, and init scripts
├── audits/               # Security audit reports
├── benchmarks/           # Gas optimization reports
├── Makefile              # Common dev commands
└── deny.toml             # License and security policy
```

**Where to start reading:**
1. `contracts/stream/src/types.rs` — understand the domain model
2. `contracts/stream/src/lib.rs` — see the public API
3. `contracts/stream/src/storage.rs` — understand how claimable is calculated
4. `contracts/stream/src/test.rs` — see how the contract is tested

---

## Development Environment Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | latest | `cargo install --locked stellar-cli --features opt` |
| Docker (optional) | — | [docs.docker.com](https://docs.docker.com/get-docker/) |

### Clone and build

```bash
git clone https://github.com/Vera3289/paystream-contracts.git
cd paystream-contracts
rustup target add wasm32-unknown-unknown
make build
```

### Verify setup

```bash
make test       # all tests should pass
make lint       # no warnings
make fmt-check  # code should be formatted
```

### Docker (no local toolchain required)

```bash
docker compose run --rm test    # run all tests
docker compose run --rm build stellar contract build
```

### IDE Setup

**VS Code** — install the [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) extension. The workspace `Cargo.toml` at root is the entry point.

**Cursor / Neovim** — configure LSP to use `rust-analyzer` with the workspace root.

---

## Testing Strategy

### Philosophy

- Every contract function has at least one happy-path and one error-path test
- Tests use the Soroban test environment (`soroban_sdk::testutils`) — no network required
- Tests are co-located with the contract in `src/test.rs`

### Running tests

```bash
# All tests
make test

# Single contract
cargo test -p paystream-stream

# Specific test
cargo test test_withdraw

# With output
cargo test -- --nocapture
```

### Test anatomy

```rust
#[test]
fn test_create_stream() {
    let env = Env::default();
    env.mock_all_auths();                     // bypass auth for test setup

    let contract_id = env.register_contract(None, StreamContract);
    let client = StreamContractClient::new(&env, &contract_id);

    let token = /* deploy token contract */;
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);

    client.initialize(&employer);
    let stream_id = client.create_stream(&employer, &employee, &token, &1000, &10, &None);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.status, StreamStatus::Active);
}
```

### Snapshot tests

The `test_snapshots/` directories contain recorded ledger state snapshots. If your changes alter the storage layout, update snapshots by running:

```bash
UPDATE_EXPECT=true cargo test
```

---

## Code Style Guide

### General

- Follow standard Rust conventions (`rustfmt`, `clippy`)
- Run `make fmt` to auto-format, `make lint` to check
- Prefer `?` operator over explicit `match` for error propagation
- Keep functions small and focused — if a function needs a long comment to explain it, it should be split

### Naming

| Item | Convention | Example |
|---|---|---|
| Types / structs | `UpperCamelCase` | `StreamStatus` |
| Functions / variables | `snake_case` | `rate_per_second` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_STREAMS` |
| Storage keys | enum variants in `StorageKey` | `StorageKey::Stream(id)` |

### Error handling

- All contract errors are returned as Soroban `panic_with_error!` — never use `.unwrap()` in contract code
- Define error variants in `types.rs`

### Comments

- Use `///` doc comments on all public functions
- Inline comments (`//`) for non-obvious logic only — don't comment what the code already says clearly

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add top_up function
fix: clamp claimable to deposit remainder
docs: update stream contract README
test: add edge case for zero-rate stream
chore: update soroban-sdk to v22.1.0
```

---

## Contributing Guidelines

1. **Find an issue** — browse [open issues](https://github.com/Vera3289/paystream-contracts/issues) or open one describing the problem/feature
2. **Comment on the issue** to let others know you're working on it
3. **Fork** the repo and create a feature branch from `main`
4. **Write tests first** where practical (TDD is encouraged)
5. **Keep PRs focused** — one issue per PR
6. **Do not commit secrets** — `.env` files, keys, or credentials must never be committed

### What makes a good contribution

- Adds or fixes clearly described behavior
- Comes with tests covering the change
- Passes all CI checks (`cargo test`, `cargo clippy`, `cargo fmt --check`)
- Has a clear PR description explaining _why_, not just _what_

---

## Pull Request Process

### Before opening a PR

```bash
make test        # all tests pass
make fmt-check   # code is formatted
make lint        # no clippy warnings
```

### Branch naming

```
feature/<short-description>-<issue-number>
fix/<short-description>-<issue-number>
docs/<short-description>-<issue-number>
```

Examples: `feature/batch-streams-423`, `fix/claimable-overflow-401`

### PR checklist

- [ ] Branch is up to date with `main`
- [ ] All CI checks pass
- [ ] Tests added/updated for the change
- [ ] Documentation updated if the public API changed
- [ ] PR description references the issue (`Closes #NNN`)

### Review process

1. Open PR against `main` in `Vera3289/paystream-contracts`
2. At least one reviewer must approve
3. All CI checks must pass
4. Reviewer merges via **squash and merge** to keep history clean

### After merge

Your branch can be deleted. If your change deploys a new contract version, follow the [upgrade guide](./upgrade-guide.md).
