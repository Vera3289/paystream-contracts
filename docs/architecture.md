# Architecture Documentation

---

## System Overview

PayStream is a fully on-chain payroll streaming system built on the Stellar blockchain using Soroban smart contracts. There is no off-chain backend or database — all state, logic, and events live on-chain.

```
┌─────────────────────────────────────────────────────────┐
│                     Stellar Network                      │
│                                                         │
│  ┌────────────────────┐    ┌────────────────────────┐   │
│  │   Stream Contract  │───▶│    Token Contract       │   │
│  │                    │    │  (Fungible payment token)│  │
│  │  - create_stream   │    │  - transfer             │   │
│  │  - withdraw        │    │  - balance              │   │
│  │  - pause/resume    │    │  - mint/burn (admin)    │   │
│  │  - cancel          │    └────────────────────────┘   │
│  │  - top_up          │                                  │
│  └────────────────────┘                                  │
│            │                                             │
│     Ledger Entries (on-chain state)                      │
└─────────────────────────────────────────────────────────┘
        ▲                    ▲
        │                    │
  Employer SDK          Employee SDK
  (create, top_up,      (withdraw,
   pause, cancel)        get_stream)
```

---

## Component Interactions

### Stream Contract (`contracts/stream`)

The core contract. Manages stream lifecycle and escrow.

| Module | Responsibility |
|--------|---------------|
| `lib.rs` | Public entrypoints — validates caller, delegates to storage/events |
| `storage.rs` | Reads/writes ledger entries; computes `claimable` amount |
| `types.rs` | `Stream` struct, `StreamStatus` enum, storage keys |
| `events.rs` | Publishes on-chain events for each state change |

### Token Contract (`contracts/token`)

A standard Stellar fungible token used as the payment currency for streams. The stream contract calls `transfer` on this contract to move funds between employer, contract escrow, and employee.

### Caller Interaction Flow

```
Employer                 Stream Contract          Token Contract
   │                           │                        │
   │── create_stream() ───────▶│                        │
   │                           │── transfer(deposit) ──▶│
   │                           │   (employer → contract)│
   │                           │◀───────────────────────│
   │◀── stream_id ─────────────│                        │
   │                           │                        │
Employee                       │                        │
   │── withdraw(stream_id) ───▶│                        │
   │                           │── transfer(claimable) ▶│
   │                           │   (contract → employee)│
   │◀── ok ────────────────────│                        │
```

---

## Data Flow

### Stream Creation

1. Employer calls `create_stream(employer, employee, token, deposit, rate_per_second, stop_time)`.
2. Contract validates inputs and transfers `deposit` from employer to itself via the token contract.
3. A `Stream` ledger entry is written with `status = Active`, `start_time = now`.
4. A `StreamCreated` event is emitted.

### Withdrawal

1. Employee calls `withdraw(employee, stream_id)`.
2. Contract reads stream, computes `claimable = min((now - last_withdraw_time) * rate_per_second, deposit - withdrawn)`.
3. Contract transfers `claimable` tokens to employee.
4. `last_withdraw_time` and `withdrawn` are updated in the ledger entry.
5. If `withdrawn == deposit`, status transitions to `Exhausted`.

### Claimable Calculation

```
elapsed = min(now, stop_time ?? now) - last_withdraw_time
claimable = min(elapsed * rate_per_second, deposit - withdrawn)
```

Paused periods are excluded: `last_withdraw_time` is set to the current time when pausing, so no accrual occurs while paused.

---

## Technology Stack Justification

| Technology | Choice | Reason |
|-----------|--------|--------|
| Blockchain | Stellar (Soroban) | Low fees (~$0.0001/tx), fast finality (5s), built-in token support, WASM-based contracts |
| Language | Rust | Required by Soroban; memory safety, zero-cost abstractions, strong type system |
| SDK | soroban-sdk v22 | Official SDK; provides storage, auth, events, cross-contract calls |
| CI | GitHub Actions | Native GitHub integration; matrix builds for lint/test/build |

---

## Scalability Considerations

- **Horizontal scaling**: Each stream is an independent ledger entry. There is no shared mutable state that creates contention. Throughput scales with Stellar network capacity (~1000 TPS).
- **State expiration**: Soroban ledger entries have a TTL. Long-running streams bump TTL on each interaction. Expired entries must be restored before use (standard Soroban pattern).
- **Stream count**: `stream_count` is a single counter updated on each `create_stream`. Under very high creation rates this is a single-entry bottleneck, but at current Stellar TPS it is not a concern.

---

## Security Architecture

| Threat | Mitigation |
|--------|-----------|
| Unauthorized withdrawal | `withdraw` checks `employee == caller` via `require_auth` |
| Employer claw-back of earned salary | Only `deposit - withdrawn` (unearned portion) is refunded on cancel |
| Re-entrancy | Soroban execution model is single-threaded; no re-entrancy possible |
| Integer overflow | Rust's checked arithmetic; `soroban-sdk` uses `i128` with overflow protection |
| Admin key compromise | Admin role is limited to contract initialization only |
| Token contract substitution | Token address is fixed at stream creation and stored in the stream entry |

---

## Deployment Architecture

```
GitHub Actions CI
       │
       ├── lint / test (cargo test)
       ├── build (stellar contract build → .wasm)
       │
       ▼
  Release artifact (.wasm)
       │
       ├── Testnet (staging)     ./scripts/deploy-testnet.sh
       │       │
       │       └── init          ./scripts/init-testnet.sh
       │
       └── Mainnet (production)  manual promotion after staging validation
```

- WASM artifacts are deterministic: the same source produces the same bytecode.
- Contract upgrades use Soroban's `update_current_contract_wasm` — the contract address stays the same; only the code changes.
- Deployment keys are stored as GitHub Actions secrets and never committed to the repository.
