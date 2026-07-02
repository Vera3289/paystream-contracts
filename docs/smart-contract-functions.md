# Smart Contract Functions

Detailed documentation for all PayStream smart contract functions: signatures, parameters, return values, error conditions, usage examples, gas/resource estimates, and call sequence diagrams.

> For CLI-level invocation examples, see [docs/api-reference.md](api-reference.md).
> For on-chain event payloads emitted by these functions, see [docs/events.md](events.md).

---

## Table of Contents

- [Stream Contract](#stream-contract)
  - [initialize](#initialize)
  - [propose_admin / accept_admin](#propose_admin--accept_admin)
  - [create_stream](#create_stream)
  - [create_streams_batch](#create_streams_batch)
  - [withdraw](#withdraw)
  - [top_up](#top_up)
  - [pause_stream](#pause_stream)
  - [resume_stream](#resume_stream)
  - [cancel_stream](#cancel_stream)
  - [get_stream](#get_stream)
  - [claimable](#claimable)
  - [stream_count](#stream_count)
- [Token Contract](#token-contract)
- [Gas / Resource Estimates](#gas--resource-estimates)
- [Call Sequence Diagrams](#call-sequence-diagrams)

---

## Stream Contract

### `initialize`

**Signature**
```rust
fn initialize(env: Env, admin: Address)
```

**Description:** One-time setup — sets the contract admin. Must be called immediately after deployment before any other function.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `admin` | `Address` | Yes | Address that becomes the contract admin |

**Returns:** `()` — nothing

**Errors**

| Condition | Behaviour |
|---|---|
| Admin auth fails | Panics |
| Called more than once | Panics (`AlreadyInitialized`) |

**Example**
```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --source $ADMIN_KEY \
  --network testnet \
  -- initialize --admin $ADMIN_ADDRESS
```

---

### `propose_admin` / `accept_admin`

Two-step admin transfer to prevent accidental lockout.

**Signatures**
```rust
fn propose_admin(env: Env, new_admin: Address)
fn accept_admin(env: Env)
```

**`propose_admin` Parameters**

| Parameter | Type | Description |
|---|---|---|
| `new_admin` | `Address` | Address being nominated |

**`accept_admin` Parameters:** none — the caller must be the previously nominated address.

**Returns:** `()` for both.

**Errors**

| Function | Condition | Behaviour |
|---|---|---|
| `propose_admin` | Caller is not current admin | Panics |
| `accept_admin` | Caller is not pending admin | Panics |
| `accept_admin` | No pending admin set | Panics |

---

### `create_stream`

**Signature**
```rust
fn create_stream(
    env: Env,
    employer: Address,
    employee: Address,
    token: Address,
    deposit: i128,
    rate_per_second: i128,
    stop_time: u64,
) -> u64
```

**Description:** Creates a salary stream and transfers `deposit` from the employer into escrow. Returns the new stream ID.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `employer` | `Address` | Payer; must authorise the call |
| `employee` | `Address` | Payee |
| `token` | `Address` | SEP-41 token contract address |
| `deposit` | `i128` | Total funds locked in escrow (in token's base units) |
| `rate_per_second` | `i128` | Accrual rate in token base units per ledger-second |
| `stop_time` | `u64` | Optional hard-stop Unix timestamp; `0` = no hard stop |

**Returns:** `u64` — the newly assigned stream ID (monotonically increasing counter).

**Errors**

| Condition | Behaviour |
|---|---|
| `employer` auth fails | Panics |
| `deposit` ≤ 0 | Panics (`InvalidAmount`) |
| `rate_per_second` ≤ 0 | Panics (`InvalidRate`) |
| `stop_time` is in the past | Panics (`InvalidStopTime`) |
| Token transfer fails (insufficient balance/allowance) | Panics (token contract error) |

**Example**
```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --source $EMPLOYER_KEY \
  --network testnet \
  -- create_stream \
  --employer $EMPLOYER_ADDRESS \
  --employee $EMPLOYEE_ADDRESS \
  --token $TOKEN_ADDRESS \
  --deposit 36000000000 \
  --rate_per_second 10000000 \
  --stop_time 0
```

---

### `create_streams_batch`

**Signature**
```rust
fn create_streams_batch(
    env: Env,
    employer: Address,
    params: Vec<StreamParams>,
) -> Vec<u64>
```

**Description:** Atomically creates multiple streams in a single transaction. All streams succeed or all revert. Cheaper than N individual `create_stream` calls for N ≥ 2 (one base fee instead of N).

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `employer` | `Address` | Payer for all streams; must authorise |
| `params` | `Vec<StreamParams>` | List of stream parameter objects (same fields as `create_stream` minus `employer`) |

**`StreamParams` fields**

| Field | Type | Description |
|---|---|---|
| `employee` | `Address` | Payee |
| `token` | `Address` | SEP-41 token address |
| `deposit` | `i128` | Deposit per stream |
| `rate_per_second` | `i128` | Rate per stream |
| `stop_time` | `u64` | Hard stop per stream; `0` = none |

**Returns:** `Vec<u64>` — list of new stream IDs in the same order as `params`.

**Errors:** Same per-stream validations as `create_stream`; any failure rolls back all streams.

---

### `withdraw`

**Signature**
```rust
fn withdraw(env: Env, employee: Address, stream_id: u64) -> i128
```

**Description:** Transfers all claimable earnings to the employee. Updates `last_withdraw_time` and `withdrawn` state.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `employee` | `Address` | Must match the stream's employee; must authorise |
| `stream_id` | `u64` | ID of the stream to withdraw from |

**Returns:** `i128` — amount transferred (in token base units).

**Errors**

| Condition | Behaviour |
|---|---|
| `employee` auth fails | Panics |
| Stream not found | Panics (`StreamNotFound`) |
| Caller is not the stream's employee | Panics (`Unauthorized`) |
| Stream is paused or cancelled | Panics (`StreamNotActive`) |
| Claimable amount is 0 | Panics (`NothingToWithdraw`) |

---

### `top_up`

**Signature**
```rust
fn top_up(env: Env, employer: Address, stream_id: u64, amount: i128)
```

**Description:** Adds more funds to an existing active or paused stream's escrow, extending its runway.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `employer` | `Address` | Must match the stream's employer; must authorise |
| `stream_id` | `u64` | Target stream |
| `amount` | `i128` | Additional funds to deposit (token base units) |

**Returns:** `()`

**Errors**

| Condition | Behaviour |
|---|---|
| `employer` auth fails | Panics |
| Stream not found | Panics (`StreamNotFound`) |
| Caller is not the stream's employer | Panics (`Unauthorized`) |
| Stream is cancelled | Panics (`StreamCancelled`) |
| `amount` ≤ 0 | Panics (`InvalidAmount`) |

---

### `pause_stream`

**Signature**
```rust
fn pause_stream(env: Env, employer: Address, stream_id: u64)
```

**Description:** Pauses salary accrual. Time elapsed while paused does not count toward claimable balance.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `employer` | `Address` | Must match stream's employer; must authorise |
| `stream_id` | `u64` | Stream to pause |

**Returns:** `()`

**Errors**

| Condition | Behaviour |
|---|---|
| Auth fails | Panics |
| Stream not found | Panics (`StreamNotFound`) |
| Stream already paused | Panics (`AlreadyPaused`) |
| Stream is cancelled | Panics (`StreamCancelled`) |

---

### `resume_stream`

**Signature**
```rust
fn resume_stream(env: Env, employer: Address, stream_id: u64)
```

**Description:** Resumes a paused stream. Sets a new effective start time so paused duration is excluded.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `employer` | `Address` | Must match stream's employer; must authorise |
| `stream_id` | `u64` | Stream to resume |

**Returns:** `()`

**Errors**

| Condition | Behaviour |
|---|---|
| Auth fails | Panics |
| Stream not found | Panics (`StreamNotFound`) |
| Stream is not paused | Panics (`NotPaused`) |
| Stream is cancelled | Panics (`StreamCancelled`) |

---

### `cancel_stream`

**Signature**
```rust
fn cancel_stream(env: Env, employer: Address, stream_id: u64)
```

**Description:** Cancels a stream. Transfers earned-but-unwithdrawn balance to the employee, then refunds remaining deposit to the employer.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `employer` | `Address` | Must match stream's employer; must authorise |
| `stream_id` | `u64` | Stream to cancel |

**Returns:** `()`

**Errors**

| Condition | Behaviour |
|---|---|
| Auth fails | Panics |
| Stream not found | Panics (`StreamNotFound`) |
| Stream already cancelled | Panics (`AlreadyCancelled`) |

---

### `get_stream`

**Signature**
```rust
fn get_stream(env: Env, stream_id: u64) -> Stream
```

**Description:** Returns the full state of a stream. Read-only; no auth required.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `stream_id` | `u64` | ID of the stream to query |

**Returns:** `Stream` struct

**`Stream` fields**

| Field | Type | Description |
|---|---|---|
| `employer` | `Address` | Payer |
| `employee` | `Address` | Payee |
| `token` | `Address` | Payment token |
| `deposit` | `i128` | Original deposit |
| `rate_per_second` | `i128` | Accrual rate |
| `withdrawn` | `i128` | Total already withdrawn |
| `start_time` | `u64` | Stream start (Unix timestamp) |
| `stop_time` | `u64` | Hard stop; `0` = none |
| `last_withdraw_time` | `u64` | Last withdrawal timestamp |
| `status` | `StreamStatus` | `Active`, `Paused`, or `Cancelled` |

**Errors**

| Condition | Behaviour |
|---|---|
| Stream not found | Panics (`StreamNotFound`) |

---

### `claimable`

**Signature**
```rust
fn claimable(env: Env, stream_id: u64) -> i128
```

**Description:** Calculates the withdrawable amount at the current ledger timestamp without modifying state.

**Formula**
```
claimable = min(
    (now - last_withdraw_time) * rate_per_second,
    deposit - withdrawn
)
```
`now` is capped at `stop_time` when set. Returns `0` if the stream is paused or cancelled.

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `stream_id` | `u64` | Stream to query |

**Returns:** `i128` — claimable amount in token base units.

**Errors**

| Condition | Behaviour |
|---|---|
| Stream not found | Panics (`StreamNotFound`) |

---

### `stream_count`

**Signature**
```rust
fn stream_count(env: Env) -> u64
```

**Description:** Returns the total number of streams ever created (including cancelled). Useful for iterating all stream IDs (`0..stream_count()`).

**Parameters:** none

**Returns:** `u64`

**Errors:** none

---

## Token Contract

PayStream uses a standard SEP-41 fungible token contract. Key functions used internally:

| Function | Called by | Purpose |
|---|---|---|
| `transfer_from` | Stream contract | Move deposit from employer to escrow on `create_stream` / `top_up` |
| `transfer` | Stream contract | Pay employee on `withdraw` / `cancel_stream` |
| `transfer` | Stream contract | Refund employer remainder on `cancel_stream` |

---

## Gas / Resource Estimates

Measured on Soroban testnet (values are approximate; actual fees depend on ledger congestion and contract version).

> Detailed per-operation CPU and memory breakdowns: [docs/performance.md](performance.md)

| Function | Instructions (approx.) | Read bytes (approx.) | Write bytes (approx.) | Typical fee (XLM) |
|---|---|---|---|---|
| `initialize` | 200K | 1 KB | 0.1 KB | < 0.001 |
| `create_stream` | 2.5M | 4 KB | 1 KB | ~0.01 |
| `create_streams_batch` (N=5) | 8M | 12 KB | 4 KB | ~0.02 |
| `withdraw` | 2M | 4 KB | 0.5 KB | ~0.01 |
| `top_up` | 1.5M | 3 KB | 0.5 KB | ~0.008 |
| `pause_stream` | 500K | 2 KB | 0.2 KB | ~0.003 |
| `resume_stream` | 500K | 2 KB | 0.2 KB | ~0.003 |
| `cancel_stream` | 2.5M | 4 KB | 0.5 KB | ~0.01 |
| `get_stream` | 100K | 2 KB | 0 | < 0.001 |
| `claimable` | 150K | 2 KB | 0 | < 0.001 |
| `stream_count` | 50K | 0.5 KB | 0 | < 0.001 |

**Batch savings:** `create_streams_batch` with N=5 costs roughly the same as 2 individual `create_stream` calls due to the single base transaction fee.

---

## Call Sequence Diagrams

### Setup Flow

```
Admin                 Stream Contract
  |                         |
  |--- initialize(admin) -->|
  |                         |-- store admin
  |<-- () ------------------|
```

### Create Stream Flow

```
Employer        Token Contract      Stream Contract
   |                  |                   |
   |-- approve(stream_contract, deposit)->|
   |<-- () -----------|                   |
   |                  |                   |
   |-- create_stream(employer, employee, token, deposit, rate, stop_time) -->|
   |                  |                   |-- validate params
   |                  |<-- transfer_from(employer, contract, deposit) --------|
   |                  |-- transfer ok --->|
   |                  |                   |-- store Stream{id, ...}
   |<-- stream_id ----|-------------------|
```

### Withdraw Flow

```
Employee              Stream Contract      Token Contract
   |                        |                    |
   |-- withdraw(employee, stream_id) ----------->|
   |                        |-- calc claimable   |
   |                        |-- update state     |
   |                        |-- transfer(employee, claimable) ->|
   |                        |<-- ok -------------|
   |<-- amount claimable ---|
```

### Cancel Stream Flow

```
Employer              Stream Contract      Token Contract
   |                        |                    |
   |-- cancel_stream(employer, stream_id) ------>|
   |                        |-- calc earned      |
   |                        |-- transfer(employee, earned) ---->|
   |                        |<-- ok -------------|
   |                        |-- transfer(employer, remainder) ->|
   |                        |<-- ok -------------|
   |                        |-- status = Cancelled
   |<-- () -----------------|
```

### Pause / Resume Flow

```
Employer              Stream Contract
   |                        |
   |-- pause_stream(id) --->|-- status = Paused, record pause_time
   |<-- () -----------------|
   |                        |
   ... time passes (not accruing) ...
   |                        |
   |-- resume_stream(id) -->|-- status = Active, adjust last_withdraw_time
   |<-- () -----------------|
```

### Batch Create Flow

```
Employer        Token Contract      Stream Contract
   |                  |                   |
   |-- approve(contract, total_deposit) ->|
   |                  |                   |
   |-- create_streams_batch(employer, [p1, p2, ...]) ---------->|
   |                  |                   |-- validate all params
   |                  |<-- transfer_from(employer, contract, deposit_1) ------|
   |                  |<-- transfer_from(employer, contract, deposit_2) ------|
   |                  |   ...             |-- store all streams atomically
   |<-- [id1, id2, ...]------------------|
```
