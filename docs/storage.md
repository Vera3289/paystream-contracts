# Storage Architecture

This document describes all storage keys, value types, and TTL (Time-To-Live) settings used by the Stream Contract.

## Overview

The contract uses Soroban's three storage tiers:
- **Instance Storage**: Contract-level configuration and counters (lives with the contract instance)
- **Persistent Storage**: Stream data, indexes, proposals, and history (explicit TTL management)
- **Temporary Storage**: Not currently used

## Storage Keys

All storage keys are defined in the `DataKey` enum in `types.rs`:

```rust
pub enum DataKey {
    Stream(u64),
    StreamCount,
    Admin,
    MinDeposit,
    AdminNonce,
    Paused,
    EmployerStreams(Address),
    EmployeeStreams(Address),
    PendingAdmin,
    FeeBps,
    FeeRecipient,
    PendingEmployer(u64),
    MaxStreamsPerEmployer,
    PauseHistory(u64),
    Proposal(u64),
    ProposalCount,
    Voted(u64, Address),
}
```

## Instance Storage Keys

Instance storage persists for the lifetime of the contract instance and does not require explicit TTL management.

### `StreamCount`
- **Type**: `u64`
- **Purpose**: Monotonic counter for generating unique stream IDs
- **Access**: Read on every `create_stream`, incremented atomically
- **Default**: `0`

### `Admin`
- **Type**: `Address`
- **Purpose**: Current contract administrator address
- **Access**: Set during `initialize()`, updated via two-step transfer
- **Required**: Yes (set during initialization)

### `PendingAdmin`
- **Type**: `Address`
- **Purpose**: Proposed new admin during two-step admin transfer
- **Access**: Set by `propose_admin()`, cleared after `accept_admin()`
- **Default**: None (optional)

### `MinDeposit`
- **Type**: `i128`
- **Purpose**: Minimum deposit amount required to create a stream
- **Access**: Read on stream creation, updated by admin
- **Default**: `10_000` (defined as `DEFAULT_MIN_DEPOSIT`)

### `AdminNonce`
- **Type**: `u64`
- **Purpose**: Replay protection for admin operations
- **Access**: Incremented on every admin action requiring nonce
- **Default**: `0`

### `Paused`
- **Type**: `bool`
- **Purpose**: Global contract pause state
- **Access**: Set by `pause_contract()` / `unpause_contract()`
- **Default**: `false`

### `FeeBps`
- **Type**: `u32`
- **Purpose**: Protocol fee in basis points (1 bps = 0.01%)
- **Access**: Set by `set_protocol_fee()`, read on every withdrawal
- **Default**: `0` (no fee)
- **Maximum**: `100` (1%)

### `FeeRecipient`
- **Type**: `Address`
- **Purpose**: Address that receives protocol fees
- **Access**: Set by `set_protocol_fee()`, read when fee > 0
- **Default**: None (optional)

### `MaxStreamsPerEmployer`
- **Type**: `u32`
- **Purpose**: Maximum number of streams a single employer can create
- **Access**: Checked on stream creation, updated by admin
- **Default**: `100`

### `ProposalCount`
- **Type**: `u64`
- **Purpose**: Monotonic counter for generating unique proposal IDs
- **Access**: Read and incremented on `propose_parameter()`
- **Default**: `0`

## Persistent Storage Keys

Persistent storage requires explicit TTL management. The contract uses:
- **TTL_THRESHOLD**: `6_307_200` seconds (~73 days)
- **TTL_EXTEND_TO**: `12_614_400` seconds (~146 days)

When a persistent entry is accessed, its TTL is extended if it's below the threshold.

### `Stream(u64)`
- **Type**: `Stream` struct
- **Purpose**: Core stream data indexed by stream ID
- **TTL**: Extended on every read/write via `save_stream()` and `load_stream()`
- **Lifecycle**: Created on stream creation, updated throughout stream lifetime

#### Stream Struct Fields

```rust
pub struct Stream {
    pub id: u64,                    // Unique stream identifier
    pub employer: Address,          // Payer address
    pub employee: Address,          // Recipient address
    pub token: Address,             // Token contract address (SEP-41)
    pub deposit: i128,              // Total deposited amount
    pub withdrawn: i128,            // Total amount withdrawn by employee
    pub rate_per_second: i128,      // Streaming rate (tokens per second)
    pub start_time: u64,            // Ledger timestamp when stream started
    pub stop_time: u64,             // Optional end timestamp (0 = no end)
    pub last_withdraw_time: u64,    // Last withdrawal timestamp
    pub cooldown_period: u64,       // Minimum seconds between withdrawals
    pub status: StreamStatus,       // Active | Paused | Cancelled | Exhausted
    pub locked: bool,               // Reentrancy guard
    pub cliff_time: u64,            // Optional cliff timestamp (0 = no cliff)
    pub paused_at: u64,             // Timestamp when paused (0 = not paused)
}
```

**Status Values**:
- `Active`: Stream is running and tokens are accruing
- `Paused`: Stream is temporarily stopped (no accrual)
- `Cancelled`: Stream terminated by employer
- `Exhausted`: All deposited funds have been withdrawn

### `EmployerStreams(Address)`
- **Type**: `Vec<u64>` (list of stream IDs)
- **Purpose**: Index of all streams created by an employer
- **TTL**: Extended on every access
- **Access**: Append-only on stream creation, read by `streams_by_employer()`
- **Default**: Empty vector

### `EmployeeStreams(Address)`
- **Type**: `Vec<u64>` (list of stream IDs)
- **Purpose**: Index of all streams where address is the employee
- **TTL**: Extended on every access
- **Access**: Append-only on stream creation, read by `streams_by_employee()`
- **Default**: Empty vector

### `PendingEmployer(u64)`
- **Type**: `Address`
- **Purpose**: Proposed new employer during two-step stream ownership transfer
- **Access**: Set by `propose_employer_transfer()`, cleared after `accept_employer_transfer()`
- **Lifecycle**: Temporary (cleared after transfer completes)

### `PauseHistory(u64)`
- **Type**: `Vec<PauseEvent>`
- **Purpose**: Chronological log of pause/resume events for a stream
- **TTL**: Extended on every access
- **Access**: Append-only on `pause_stream()` / `resume_stream()`, read by `pause_history()`

#### PauseEvent Struct

```rust
pub struct PauseEvent {
    pub stream_id: u64,     // Stream identifier
    pub timestamp: u64,     // Ledger timestamp of event
    pub is_pause: bool,     // true = pause, false = resume
}
```

### `Proposal(u64)`
- **Type**: `Proposal` struct
- **Purpose**: Governance proposal data indexed by proposal ID
- **Access**: Created by `propose_parameter()`, updated by voting and execution
- **Lifecycle**: Permanent record of governance actions

#### Proposal Struct

```rust
pub struct Proposal {
    pub id: u64,                    // Unique proposal identifier
    pub param: GovParam,            // MinDeposit | MaxDuration | FeeBps
    pub new_value: u64,             // Proposed new value
    pub votes_for: u64,             // Number of votes in favor
    pub votes_against: u64,         // Number of votes against
    pub status: ProposalStatus,     // Active | Passed | Executed | Rejected
    pub executable_after: u64,      // Timelock expiration (2 days)
}
```

### `Voted(u64, Address)`
- **Type**: `bool`
- **Purpose**: Tracks whether an address has voted on a proposal
- **Access**: Set by `vote()`, checked to prevent double-voting
- **Default**: `false`

## Storage Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    INSTANCE STORAGE                         │
│  (Contract-level configuration, lives with instance)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  StreamCount: u64           ─┐                             │
│  ProposalCount: u64          │ Monotonic counters          │
│  AdminNonce: u64            ─┘                             │
│                                                             │
│  Admin: Address             ─┐                             │
│  PendingAdmin: Address?      │ Admin management            │
│                             ─┘                             │
│  Paused: bool               ─── Global pause state         │
│                                                             │
│  MinDeposit: i128           ─┐                             │
│  MaxStreamsPerEmployer: u32  │ Stream constraints          │
│                             ─┘                             │
│  FeeBps: u32                ─┐                             │
│  FeeRecipient: Address?      │ Protocol fees               │
│                             ─┘                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   PERSISTENT STORAGE                        │
│         (Explicit TTL: 73d threshold, 146d extend)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stream(id) → Stream        ─── Core stream data           │
│    ├─ id, employer, employee                               │
│    ├─ token, deposit, withdrawn                            │
│    ├─ rate_per_second, times                               │
│    ├─ status, locked                                       │
│    └─ cliff_time, paused_at                                │
│                                                             │
│  EmployerStreams(addr) → Vec<u64>  ─┐                      │
│  EmployeeStreams(addr) → Vec<u64>   │ Lookup indexes       │
│                                    ─┘                      │
│  PendingEmployer(id) → Address?  ─── Ownership transfer    │
│                                                             │
│  PauseHistory(id) → Vec<PauseEvent> ─ Audit trail          │
│                                                             │
│  Proposal(id) → Proposal        ─┐                         │
│  Voted(id, addr) → bool          │ Governance              │
│                                 ─┘                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      DATA FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  create_stream()                                            │
│    ├─ Read: StreamCount, MinDeposit, MaxStreamsPerEmployer │
│    ├─ Write: Stream(id), StreamCount                       │
│    └─ Append: EmployerStreams, EmployeeStreams             │
│                                                             │
│  withdraw()                                                 │
│    ├─ Read: Stream(id), FeeBps, FeeRecipient               │
│    └─ Write: Stream(id) [withdrawn, last_withdraw_time]    │
│                                                             │
│  pause_stream() / resume_stream()                           │
│    ├─ Read: Stream(id)                                     │
│    ├─ Write: Stream(id) [status, paused_at]                │
│    └─ Append: PauseHistory(id)                             │
│                                                             │
│  propose_admin() / accept_admin()                           │
│    ├─ Read: Admin, PendingAdmin, AdminNonce                │
│    └─ Write: Admin, PendingAdmin, AdminNonce               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Storage Access Patterns

### Stream Creation
1. Read `StreamCount` (instance)
2. Read `MinDeposit` (instance)
3. Read `MaxStreamsPerEmployer` (instance)
4. Read `EmployerStreams(employer)` (persistent) to check limit
5. Increment `StreamCount` (instance)
6. Write `Stream(id)` (persistent) with TTL extension
7. Append to `EmployerStreams(employer)` (persistent) with TTL extension
8. Append to `EmployeeStreams(employee)` (persistent) with TTL extension

### Withdrawal
1. Read `Stream(id)` (persistent) with TTL extension
2. Read `FeeBps` (instance)
3. Read `FeeRecipient` (instance) if fee > 0
4. Write `Stream(id)` (persistent) with updated `withdrawn` and `last_withdraw_time`

### Admin Operations
All admin operations that modify state require:
1. Read `Admin` (instance) for authorization
2. Read and increment `AdminNonce` (instance) for replay protection
3. Perform the specific operation

## TTL Management Strategy

The contract uses a **proactive TTL extension** strategy:

- **Threshold**: 73 days (6,307,200 seconds)
- **Extension**: 146 days (12,614,400 seconds)

When any persistent entry is accessed (read or write), the contract checks if the TTL is below the threshold. If so, it extends the TTL to the extension value.

### Why This Approach?

1. **Active streams stay alive**: Streams with regular activity (withdrawals, top-ups) automatically maintain their storage
2. **Inactive streams expire**: Abandoned streams eventually clean up after ~73 days of inactivity
3. **Predictable costs**: Storage costs are amortized across regular operations
4. **No manual maintenance**: No need for separate "keep-alive" transactions

### Cost Implications

Every access to persistent storage incurs:
- Base read/write cost
- TTL extension cost (if below threshold)

For active streams (regular withdrawals), this is negligible overhead. For inactive streams, the contract allows natural expiration rather than paying indefinitely for unused data.

## Storage Size Estimates

Approximate storage sizes (in bytes):

| Type | Size | Notes |
|------|------|-------|
| `Stream` | ~300 | Includes all fields and overhead |
| `Address` | 32 | Stellar address |
| `u64` | 8 | Counter or ID |
| `i128` | 16 | Token amount |
| `Vec<u64>` | 8n + overhead | n = number of stream IDs |
| `PauseEvent` | ~50 | Per event |
| `Proposal` | ~100 | Includes all fields |

### Example: 1000 Active Streams

- 1000 × Stream entries: ~300 KB
- 1000 × Employer indexes (avg 10 streams each): ~80 KB
- 1000 × Employee indexes: ~80 KB
- **Total**: ~460 KB persistent storage

## Best Practices

### For Contract Developers

1. **Always extend TTL on access**: Use `save_stream()` and `load_stream()` helpers
2. **Use instance storage for config**: Frequently accessed, rarely changed data
3. **Use persistent storage for user data**: Streams, indexes, proposals
4. **Batch operations carefully**: Each persistent write extends TTL

### For Integrators

1. **Monitor stream activity**: Inactive streams will expire after ~73 days
2. **Regular withdrawals extend TTL**: Even small withdrawals keep storage alive
3. **Query indexes efficiently**: Use `streams_by_employer()` / `streams_by_employee()`
4. **Plan for storage costs**: Factor TTL extension into gas estimates

## Related Documentation

- [ADR 0003: Storage Layout](adr/0003-storage-layout.md) - Design decisions
- [API Reference](api-reference.md) - Function signatures
- [Performance Guide](performance.md) - Optimization tips
