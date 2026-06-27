# Input Sanitization

**Version:** 1.0
**Scope:** `paystream-stream` Soroban smart contract

---

## Overview

PayStream is a Soroban smart contract on the Stellar blockchain. All inputs arrive as strongly-typed Rust values decoded by the Soroban host — there is no raw string parsing, SQL layer, or HTTP request surface. Traditional injection categories (SQL injection, XSS) do not apply. This document describes the sanitization rules that *do* apply: numeric bounds, address validation, state consistency, and overflow prevention.

---

## Sanitization Rules

### 1. Numeric Inputs (`deposit`, `rate_per_second`, `amount`)

| Rule | Enforced in | Error |
|---|---|---|
| `deposit > 0` | `validate_create_stream` | E002 |
| `deposit >= min_deposit` | `validate_create_stream` | E007 |
| `rate_per_second > 0` | `validate_create_stream` | E001 |
| `rate_per_second <= MAX_RATE_PER_SECOND` (1 × 10⁹) | `validate_create_stream` | E008 |
| `amount > 0` (top-up) | `validate_top_up` | panic |

`MAX_RATE_PER_SECOND = 1_000_000_000` prevents arithmetic overflow in `claimable_amount` for any elapsed time up to ~292 years (i128 max ÷ max rate).

### 2. Address Inputs (`employer`, `employee`, `token`, `admin`)

| Rule | Enforced by | Notes |
|---|---|---|
| `employer != employee` | `validate_create_stream` | Prevents self-stream accounting abuse |
| Address auth | `Address::require_auth()` at every mutating entry point | Soroban host rejects invalid or unsigned addresses |
| Token conforms to SEP-41 | `token_client.balance()` probe on stream creation | Panics if token lacks the required interface |

Address values are 32-byte Ed25519 public keys or contract addresses validated by the Soroban host before the contract body runs. No manual parsing is needed or performed.

### 3. Timestamp Inputs (`stop_time`)

| Rule | Enforced in | Notes |
|---|---|---|
| `stop_time == 0` (no end) OR `stop_time > now` | `validate_create_stream` | Prevents streams that are already expired at creation |

`now` is sourced from `env.ledger().timestamp()` — it cannot be spoofed by the caller.

### 4. Stream ID Inputs

Stream IDs are monotonically-incrementing `u64` values issued by the contract. On every read operation (`get_stream`, `claimable`, `withdraw`, etc.) the contract loads the stream from persistent storage and panics if the key is absent. There is no caller-controlled ID format to sanitize.

### 5. Admin Nonce

| Rule | Enforced in | Error |
|---|---|---|
| Submitted `nonce == stored_nonce` | `consume_admin_nonce` in `storage.rs` | E009 |

The nonce is consumed atomically, preventing replay of captured admin transactions.

### 6. Batch Parameters (`create_streams_batch`)

Each element of the `params` vector passes through the same `validate_create_stream` checks as individual stream creation. The batch call is atomic — any single failure reverts all streams.

---

## What Does Not Apply

| Traditional Attack | Status | Reason |
|---|---|---|
| SQL injection | Not applicable | No database; state stored in Soroban persistent storage (key-value) |
| Script injection / XSS | Not applicable | No HTML rendering; contract emits typed on-chain events only |
| Path traversal | Not applicable | No file system access |
| Command injection | Not applicable | No shell execution |
| HTTP parameter pollution | Not applicable | No HTTP layer; inputs are ABI-encoded by the Stellar SDK |
| SSRF | Not applicable | No outbound network calls from the contract |

---

## Output Encoding

All contract return values are Soroban XDR types (`u64`, `i128`, `Address`, `StreamStatus`, `Stream`). They are serialized by the Soroban host into XDR wire format. No manual encoding is required and no escaping is necessary for on-chain consumers.

Off-chain consumers (front-ends, indexers) are responsible for escaping contract output before rendering it in HTML or other contexts.

---

## Validation Entry Points

| Function | Validation call |
|---|---|
| `create_stream` | `validate_create_stream(deposit, min_deposit, rate, stop_time, now, employer, employee)` |
| `create_streams_batch` | `validate_create_stream(...)` per element |
| `top_up` | `validate_top_up(amount)` |
| All mutating functions | `Address::require_auth()` + ownership assertions |

The centralized `validate.rs` module (issue #72) is the canonical location for all sanitization logic. Do not duplicate checks inline in `lib.rs`.

---

## Security Review Checklist

- [ ] Any new numeric parameter has an explicit lower AND upper bound check in `validate.rs`
- [ ] Any new `Address` parameter calls `require_auth()` if the function is caller-restricted
- [ ] Any new timestamp parameter is compared against `env.ledger().timestamp()`
- [ ] Arithmetic on user-supplied values uses `checked_mul` / `checked_add` — never unchecked operators
- [ ] New batch operations validate every element before committing any state change
- [ ] Off-chain documentation notes any output fields that may be displayed in a UI (escaping responsibility)
