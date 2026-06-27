# Testing Guide

**Version:** 1.0
**Scope:** `paystream-stream` and `paystream-token` Soroban smart contracts

---

## Overview

PayStream uses a multi-layer testing strategy:

| Layer | Tool | Location | When to run |
|---|---|---|---|
| Unit tests | `cargo test` + Soroban test SDK | `contracts/*/src/test.rs` | Every commit |
| Property / fuzz tests | `proptest` | `contracts/stream/fuzz/` | CI + before release |
| Integration tests | `cargo test` (end-to-end scenarios) | `contracts/stream/src/test.rs` | Every commit |
| Static analysis | `cargo clippy` | project root | Every commit |
| Dependency audit | `cargo deny` | project root | Every commit |

There are no separate E2E tests against a live network in this repository; testnet deployment instructions are in [docs/testnet.md](testnet.md).

---

## Quick Start

```bash
# Run all tests
make test
# or
cargo test

# Run tests for one contract only
cargo test -p paystream-stream
cargo test -p paystream-token

# Run a single test by name
cargo test test_create_stream

# Run tests with output visible
cargo test -- --nocapture
```

---

## Unit Testing

### Framework

Unit tests use the [Soroban SDK test environment](https://developers.stellar.org/docs/build/smart-contracts/getting-started/testing) (`soroban_sdk::Env`). This is a lightweight in-process simulator — no network, node, or external process is required.

### Test Setup Pattern

Every test in `contracts/stream/src/test.rs` follows this pattern:

```rust
fn setup() -> (Env, StreamContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();          // skip signature verification in tests
    let id = env.register(StreamContract, ());
    let client = StreamContractClient::new(&env, &id);
    (env, client)
}

fn setup_token(env: &Env, admin: &Address) -> Address {
    let token_id = env.register(paystream_token::TokenContract, ());
    let token = paystream_token::TokenContractClient::new(env, &token_id);
    token.initialize(admin, &1_000_000_000);
    token_id
}
```

Key points:
- `Env::default()` creates a fresh, isolated ledger for each test
- `mock_all_auths()` bypasses `require_auth()` checks — tests focus on business logic, not key management
- Call `env.mock_auths(...)` when you specifically want to test authentication rejection
- The token contract is registered in the same `Env` so cross-contract calls work in-process

### Time Manipulation

Soroban tests control ledger time directly:

```rust
// Advance time by 100 seconds
env.ledger().with_mut(|l| l.timestamp += 100);
```

Use this to test accrual, stop-time expiry, and pause/resume behavior without waiting.

### Writing a New Unit Test

1. Add a `#[test]` function in `contracts/stream/src/test.rs`
2. Call `setup()` (and `setup_token()` if the test needs token transfers)
3. Call `client.initialize(&admin)` before any other contract function
4. Set `min_deposit` if your test creates streams: `client.set_min_deposit(&admin, &nonce, &min)`
5. Assert expected state via `client.get_stream(&id)`, `client.claimable(&id)`, etc.
6. For error cases, use `#[should_panic(expected = "E002")]` to assert specific error codes

**Example — testing a validation rejection:**

```rust
#[test]
#[should_panic(expected = "E001")]
fn test_zero_rate_rejected() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let employee = Address::generate(&env);
    let token_id = setup_token(&env, &employer);
    client.initialize(&admin);
    // rate_per_second = 0 must panic with E001
    client.create_stream(&employer, &employee, &token_id, &1000, &0, &0);
}
```

---

## Integration Testing

Integration tests live alongside unit tests in `test.rs`. They exercise multi-step flows that span several contract calls:

| Scenario | Key assertions |
|---|---|
| Full stream lifecycle | create → advance time → withdraw → verify balance |
| Pause / resume | pause → advance time → resume → verify no accrual during pause |
| Cancel stream | create → partial withdraw → cancel → verify employer refund |
| Top-up | create → advance past initial deposit → top-up → continue streaming |
| Batch create | `create_streams_batch` with N streams → verify each stream individually |
| Stop-time expiry | create with `stop_time` → advance past it → verify capped claimable |
| Admin nonce | admin call with correct nonce → verify nonce increments; replay with old nonce → panic E009 |

### Cross-Contract Call Testing

The Soroban test SDK executes cross-contract calls in-process. Register both contracts in the same `Env`:

```rust
let stream_id = env.register(StreamContract, ());
let token_id  = env.register(paystream_token::TokenContract, ());
```

Calls from `stream` to `token` (e.g., `token::transfer` on withdraw) execute within the same test transaction and are observable immediately.

---

## Property / Fuzz Testing

### Location

`contracts/stream/fuzz/src/`

### Tool

[`proptest`](https://crates.io/crates/proptest) — generates random inputs across large value spaces and checks invariants hold for all of them.

### Running

```bash
# Run fuzz tests (1,000,000 cases by default — takes ~30 s)
cargo test -p paystream-stream-fuzz

# Run with a custom seed for reproducibility
PROPTEST_SEED=12345 cargo test -p paystream-stream-fuzz
```

### Current Fuzz Targets

| Target | Invariant tested |
|---|---|
| `fuzz_claimable_no_panic_and_bounded` | `claimable_amount` never panics (except documented overflow) and always returns a value in `[0, deposit - withdrawn]` |

### Adding a Fuzz Target

```rust
proptest! {
    #[test]
    fn fuzz_my_invariant(
        deposit in 1i128..=i64::MAX as i128,
        rate    in 1i128..=1_000_000i128,
    ) {
        // assert your invariant here
        prop_assert!(rate <= deposit || /* ... */);
    }
}
```

Keep fuzz targets focused on a single invariant. Use `prop_assume!` to skip invalid input combinations rather than panicking on setup.

---

## Test Data Setup

All test data is generated inside each test using `Address::generate(&env)`. There is no shared fixture database. This keeps tests isolated and deterministic.

### Common Values

| Parameter | Typical test value | Notes |
|---|---|---|
| `deposit` | `10_000` | Large enough to stream for a few hundred seconds at `rate=10` |
| `rate_per_second` | `1` or `10` | Easy mental arithmetic |
| `stop_time` | `0` (no end) or `now + 3600` | Use `env.ledger().timestamp() + 3600` |
| `min_deposit` | `100` or `0` | Set via `set_min_deposit` before `create_stream` |
| Token supply | `1_000_000_000` | Set in `setup_token` |

---

## CI/CD Integration

Tests run automatically on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`).

### Pipeline Steps

1. **Formatting check** — `cargo fmt --check` (fails fast on style issues)
2. **Clippy** — `cargo clippy --all-targets -- -D warnings`
3. **Tests** — `cargo test` (unit + integration + fuzz tests)
4. **WASM build** — `stellar contract build` (verifies contracts compile to WASM)
5. **Dependency audit** — `cargo deny check` (license and vulnerability checks)

### Running the Full CI Check Locally

```bash
make fmt-check   # formatting
make lint        # clippy
make test        # all tests
make build       # WASM compile check
make deny        # dependency audit
```

Or run everything with Docker (no local Rust installation required):

```bash
docker compose run --rm test
```

---

## Coverage Targets

| Category | Target |
|---|---|
| Happy-path flows | 100% of public entry points have at least one passing test |
| Error paths | Every error code (E001–E009) has a `#[should_panic]` test |
| Edge cases | `stop_time` expiry, zero-claimable withdraw, batch with N=1 and N>1 |
| Fuzz coverage | `claimable_amount` property holds for ≥ 1,000,000 random inputs |

To check which tests currently exist:

```bash
grep '#\[test\]' contracts/stream/src/test.rs | wc -l
```

---

## Test Snapshots

Test snapshots are stored in `contracts/*/test_snapshots/`. These capture expected contract state after specific operations and are used to detect unintended state-format changes during refactors.

If a refactor intentionally changes state layout, update the snapshots:

```bash
cargo test -- --test-update-snapshots 2>/dev/null || \
  UPDATE_EXPECT=1 cargo test
```

---

## Troubleshooting

**Tests compile but panic with an unexpected message**
- Check that `client.initialize(&admin)` is called before any other function
- Check that `set_min_deposit` has been called if your stream deposit is small

**`mock_all_auths` is not suppressing a panic**
- Some auth failures come from the contract's own ownership checks (`assert_eq!(stream.employer, employer)`), not from `require_auth()`. These must be satisfied by passing the correct address.

**Fuzz test fails with a specific seed**
- `proptest` saves failing cases in `.proptest-regressions/`. Re-run `cargo test` to reproduce. The regression file is committed so the failure is always reproduced in CI.

**WASM build fails but tests pass**
- `cargo test` compiles for the host target. Run `stellar contract build` (or `make build`) to catch WASM-specific issues.
