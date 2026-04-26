# Glossary

Definitions for PayStream-specific and Stellar/Soroban terms used throughout this documentation. Terms are listed alphabetically.

---

**Admin**
The privileged address set during contract initialisation. The admin can pause/unpause the contract, set the minimum deposit, configure the protocol fee, and perform contract upgrades. Admin rights are transferred via a two-step process (see [ADR-0004](adr/0004-two-step-admin-transfer.md)).

**Admin Nonce**
A monotonically-increasing counter stored on-chain that must be supplied with every admin operation. Prevents replay attacks where a signed admin transaction is re-submitted. See `DataKey::AdminNonce` in `contracts/stream/src/types.rs`.

**Claimable Amount**
The number of tokens an employee can withdraw at a given moment. Calculated as:
```
claimable = min(
    (now - last_withdraw_time) × rate_per_second,
    deposit - withdrawn
)
```
Time is capped at `stop_time` if set; paused intervals are excluded. See [`docs/api-reference.md`](api-reference.md).

**Cooldown Period**
An optional minimum number of seconds that must elapse between successive withdrawals on a stream. Set per-stream at creation time. A value of `0` disables the cooldown.

**Deposit**
The total amount of tokens an employer locks into the contract escrow when creating a stream. The deposit is the maximum the employee can ever earn from that stream.

**Employee**
The address that receives streamed tokens. The employee calls `withdraw` to claim earned tokens. The employee cannot access unearned funds.

**Employer**
The address that creates a stream and funds the escrow. The employer can pause, resume, top-up, or cancel their streams. The employer cannot withdraw tokens already earned by the employee.

**Escrow**
Funds held by the stream contract on behalf of a stream. Tokens are transferred from the employer to the contract at stream creation and released to the employee (or refunded to the employer on cancellation) by the contract logic.

**Exhausted (stream status)**
A stream reaches the Exhausted status when the employee has withdrawn the full deposit. No further withdrawals are possible. See [Stream Status Lifecycle](../README.md#stream-status-lifecycle).

**Fee BPS (fee_bps)**
The protocol fee expressed in basis points (1 bps = 0.01%). A value of `100` means a 1% fee. The maximum configurable value is `100` bps (1%). A value of `0` disables the fee entirely.

**Fee Recipient**
The address that receives protocol fees collected on withdrawals. Configured by the admin alongside `fee_bps`.

**Instance Storage**
A Soroban storage tier whose lifetime is tied to the contract instance. Used for global contract state such as `Admin`, `StreamCount`, `MinDeposit`, and `Paused`. Data in instance storage is lost if the contract instance expires.

**Last Withdraw Time**
A per-stream timestamp (Unix seconds) recording when the employee last withdrew, or the stream start time if no withdrawal has occurred. Used as the baseline for the claimable amount calculation.

**Ledger**
A single block on the Stellar network. Ledgers close approximately every 5 seconds. Timestamps in Soroban contracts are ledger timestamps in Unix seconds.

**Locked (reentrancy guard)**
A boolean field on each `Stream` struct set to `true` while a `withdraw` cross-contract token transfer is in flight. Acts as a defence-in-depth reentrancy guard. See `ERR_REENTRANT` in `contracts/stream/src/types.rs`.

**Min Deposit**
The minimum deposit amount enforced on `create_stream`. Configurable by the admin. Defaults to `10,000` stroops. Prevents dust streams that would be uneconomical to operate.

**Paused (contract)**
A contract-wide flag that blocks `create_stream`, `create_streams_batch`, and `withdraw`. Set and cleared by the admin via `pause_contract` / `unpause_contract`. Admin operations remain available while paused.

**Paused (stream status)**
A per-stream status set by the employer via `pause_stream`. Stops token accrual for that stream. The employee cannot withdraw while the stream is paused. Paused time is excluded from the claimable calculation.

**Pending Admin**
An address nominated by the current admin as the next admin (step 1 of the two-step transfer). The pending admin must call `accept_admin` to complete the transfer. Stored under `DataKey::PendingAdmin`.

**Persistent Storage**
A Soroban storage tier with an explicit TTL (time-to-live) measured in ledgers. Used for per-stream data and address indexes. PayStream extends TTLs on every active-stream operation to keep data alive for up to 2 years.

**Protocol Fee**
An optional percentage of each withdrawal amount collected by the contract and sent to the fee recipient. Expressed in basis points (`fee_bps`). Configurable by the admin; can be set to `0` to disable.

**Rate Per Second (rate_per_second)**
The number of tokens streamed to the employee every second. Must be between 1 and 1,000,000,000 (inclusive). Stored as `i128`.

**Reentrancy**
An attack where a malicious contract calls back into the victim contract before the first call completes, potentially manipulating state. PayStream uses a `locked` flag on each stream as a defence-in-depth guard against this.

**SAC (Stellar Asset Contract)**
A Soroban smart contract that wraps a classic Stellar asset and exposes the SEP-41 token interface. PayStream streams can use any SAC token as the payment asset.

**SEP-41**
[Stellar Ecosystem Proposal 41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) — the standard fungible token interface for Soroban contracts. Defines `transfer`, `balance`, `approve`, and related functions. PayStream requires the stream token to be SEP-41 compliant.

**Soroban**
The smart contract platform built into the Stellar network. Contracts are written in Rust and compiled to WebAssembly (WASM). Soroban provides deterministic execution, metered resource usage, and a structured storage model.

**Stop Time**
An optional Unix timestamp (seconds) at which a stream hard-stops accruing tokens. After `stop_time`, `claimable` returns the amount earned up to that moment. A value of `0` means the stream runs indefinitely until the deposit is exhausted or the employer cancels it.

**Stream**
The core data structure representing a salary payment agreement between an employer and an employee. Contains the deposit, rate, status, timestamps, and token address. Identified by a unique `u64` stream ID.

**Stream ID**
A unique, sequentially-assigned `u64` identifier for each stream. IDs start at 1 and are assigned by `next_id()` in `storage.rs`. The highest stream ID equals `stream_count`.

**Stroops**
The smallest unit of a Stellar asset. 1 XLM = 10,000,000 stroops. Token amounts in PayStream are expressed in the smallest unit of the relevant asset (analogous to stroops for XLM or wei for ETH).

**Temporary Storage**
A Soroban storage tier with a short TTL, suitable for data that does not need to persist long-term. Used by the token contract for allowances (`Allowance(owner, spender)`).

**Withdrawn**
The cumulative amount of tokens already transferred to the employee from a stream. Used together with `deposit` to compute the remaining balance and cap the claimable amount.
