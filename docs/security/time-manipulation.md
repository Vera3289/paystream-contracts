# Time Manipulation Resistance Analysis

**Status:** Reviewed  
**Last updated:** 2026-04-29  
**Related issue:** [#66](https://github.com/Vera3289/paystream-contracts/issues/66)

---

## Overview

PayStream uses `env.ledger().timestamp()` (Soroban ledger close time) as its
sole time source.  This document analyses what happens when that timestamp is
skewed or non-monotonic, and what mitigations are in place.

---

## How Soroban Ledger Time Works

- Each Stellar ledger has a `close_time` field set by validator consensus.
- Soroban exposes this as `env.ledger().timestamp()` — an unsigned 64-bit
  Unix timestamp (seconds).
- Validators must agree on `close_time`; a single validator cannot unilaterally
  set an arbitrary value.
- The Stellar protocol requires `close_time ≥ previous_close_time` at the
  network level, so **strict monotonicity is enforced by consensus**.

---

## Attack Scenarios

### 1. Timestamp Skew (small drift)

**Scenario:** Validators agree on a `close_time` that is a few seconds ahead
of or behind wall-clock time.

**Impact on PayStream:**
- `claimable_amount` is proportional to elapsed seconds.  A ±30 s drift on a
  stream with `rate_per_second = 1` causes at most ±30 tokens of error.
- For typical salary streams (rate in the range of cents per second) this is
  negligible.

**Mitigation:** No special handling required.  The error is bounded and
economically insignificant for realistic rates.

### 2. Non-Monotonic / Rolled-Back Timestamp

**Scenario:** A ledger is produced with `close_time < previous_close_time`
(e.g., due to a network partition or a hypothetical consensus bug).

**Impact on PayStream:**
- `claimable_amount` uses `effective_end.saturating_sub(stream.last_withdraw_time)`.
  If `now < last_withdraw_time`, `saturating_sub` returns **0** — no tokens
  are claimable and no transfer occurs.
- The contract **cannot be drained** by a rolled-back timestamp.
- A paused stream's `paused_at` field is also a stored timestamp; a rollback
  would make `paused_at > now`, but the pause/resume logic only reads
  `paused_at` to record history — it does not compute elapsed time from it
  directly in the claimable path.

**Mitigation:** `saturating_sub` in `claimable_amount` is the primary defence.
No additional guard is needed because the worst outcome is zero claimable, not
over-payment.

### 3. Far-Future Timestamp (leap forward)

**Scenario:** Validators agree on a `close_time` far in the future (e.g., a
clock misconfiguration).

**Impact on PayStream:**
- `claimable_amount` is capped by `deposit - withdrawn` (the `remaining`
  variable), so the employee can never withdraw more than the deposited amount
  regardless of how large `elapsed` becomes.
- `stop_time` (if set) further caps `effective_end`, limiting accrual to the
  intended stream duration.

**Mitigation:** The `min(earned, remaining)` cap in `claimable_amount` is the
primary defence.  Employers should set `stop_time` for fixed-duration streams.

### 4. Cliff / Stop Time Bypass

**Scenario:** Timestamp manipulation to skip past `cliff_time` or `stop_time`.

**Impact:**
- A far-future timestamp could make `now >= cliff_time` earlier than intended,
  allowing early withdrawal.
- Because ledger time is consensus-controlled, this requires a network-level
  attack, not a contract-level one.

**Mitigation:** Document that `cliff_time` and `stop_time` are advisory
relative to ledger time.  For high-value streams, employers should set
`stop_time` and monitor ledger time via a trusted RPC node.

---

## Summary of Mitigations

| Threat | Mitigation | Location |
|---|---|---|
| Rolled-back timestamp | `saturating_sub` → claimable = 0 | `storage.rs: claimable_amount` |
| Far-future timestamp | `min(earned, remaining)` cap | `storage.rs: claimable_amount` |
| Timestamp skew | Economically negligible for realistic rates | N/A |
| Cliff/stop bypass | Consensus-level protection; use `stop_time` | Employer responsibility |

---

## Recommendations

1. **Employers** setting time-sensitive streams should use `stop_time` to bound
   maximum payout regardless of timestamp drift.
2. **Monitoring** — off-chain indexers should alert if ledger `close_time`
   deviates more than 60 s from wall-clock time.
3. **No contract changes required** — the existing `saturating_sub` and
   `min(earned, remaining)` guards are sufficient.
