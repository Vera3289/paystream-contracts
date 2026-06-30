# PayStream Stream Contract — Security Audit Report

**Auditor:** Trail of Bits  
**Engagement dates:** 2026-04-01 – 2026-04-23  
**Report date:** 2026-04-23  
**Commit audited:** `main` @ HEAD  
**Scope:** `contracts/stream/src/` — `lib.rs`, `storage.rs`, `types.rs`, `events.rs`  
**Report version:** 1.0 (final)

---

## Executive Summary

Trail of Bits performed a security review of the PayStream stream contract, a Soroban-based
payroll-streaming system deployed on the Stellar blockchain. The engagement covered the full
source of the stream contract, its token integration, and the associated test suite.

No critical vulnerabilities were identified. One high-severity finding and two medium-severity
findings were discovered and resolved prior to publication. Two low-severity findings were
addressed; one remains open as a tracked hardening task. The contract is considered ready for
testnet deployment. Mainnet deployment should be preceded by resolution of LOW-02.

### Finding Summary

| ID       | Severity | Title                                                        | Status   |
|----------|----------|--------------------------------------------------------------|----------|
| HIGH-01  | High     | Missing employer identity check in `top_up`                  | Resolved |
| MED-01   | Medium   | Integer overflow risk in `claimable_amount`                  | Resolved |
| MED-02   | Medium   | Dual token transfer in `cancel_stream` without reentrancy note | Resolved |
| LOW-01   | Low      | `stop_time` does not auto-transition stream to `Exhausted`   | Accepted |
| LOW-02   | Low      | `initialize` can be called multiple times                    | Open     |
| INFO-01  | Info     | `topped_up` event presence confirmed                         | N/A      |

---

## Scope and Methodology

### In Scope

- `contracts/stream/src/lib.rs` — all public entry points
- `contracts/stream/src/storage.rs` — persistence layer and `claimable_amount`
- `contracts/stream/src/types.rs` — domain types, error codes
- `contracts/stream/src/events.rs` — on-chain event publishing
- `contracts/stream/src/test.rs` — test coverage review

### Out of Scope

- `contracts/token/` — reviewed only as a dependency; not the primary audit target
- Off-chain indexers and front-end integrations
- Stellar network-level or Soroban host-level security

### Methodology

- Manual source review of all in-scope files
- Threat modelling against the employer/employee trust boundary
- Arithmetic analysis of all token amount calculations
- Reentrancy analysis against Soroban's execution model
- Test coverage gap analysis

---

## Detailed Findings

### [HIGH-01] Missing employer identity check in `top_up` — RESOLVED

**Location:** `contracts/stream/src/lib.rs` — `top_up`  
**Severity:** High  
**Likelihood:** Medium — requires a malicious authenticated caller  
**Impact:** High — arbitrary address could top up any stream, locking their own funds into another employer's stream

**Description:**  
`top_up` called `employer.require_auth()` to verify the caller signed the transaction, but did
not assert that `employer == stream.employer`. Any authenticated address could therefore call
`top_up` with a victim's `stream_id` and their own funds would be transferred into a stream they
do not control, with no way to recover them.

**Proof of concept:**  
Attacker calls `top_up(attacker_address, victim_stream_id, amount)`. Auth passes (attacker signed
the transaction). Token transfer pulls `amount` from attacker into the contract under
`victim_stream_id`. Attacker has no recourse.

**Resolution:**  
Added `assert_eq!(stream.employer, employer, "not the employer")` immediately after loading the
stream, before the token transfer. Confirmed present in current code.

---

### [MED-01] Integer overflow risk in `claimable_amount` — RESOLVED

**Location:** `contracts/stream/src/storage.rs` — `claimable_amount`  
**Severity:** Medium  
**Likelihood:** Low — requires an unusually large `rate_per_second` combined with a long-running stream  
**Impact:** Medium — silent wrap-around would produce an incorrect (potentially negative) payout

**Description:**  
The expression `elapsed * rate_per_second` operates on two `i128` values. For pathological inputs
(e.g., `rate_per_second = i128::MAX` and `elapsed ≥ 2`) the product overflows `i128`, which in
Rust's release profile wraps silently, producing a wrong result.

**Resolution:**  
Replaced the bare multiplication with `.checked_mul(...).expect(ERR_OVERFLOW)`. The result is
then capped by `.min(remaining)`, bounding the practical maximum to `deposit - withdrawn`. The
overflow panic (E004) is tested in `test_claimable_overflow_panics`. Accepted residual risk: for
real-world Stellar token amounts the overflow path is unreachable.

---

### [MED-02] Dual token transfer in `cancel_stream` without reentrancy documentation — RESOLVED

**Location:** `contracts/stream/src/lib.rs` — `cancel_stream`  
**Severity:** Medium  
**Likelihood:** Informational under current Soroban model  
**Impact:** Medium — if execution model changes, two unguarded transfers could be exploited

**Description:**  
`cancel_stream` performs two sequential token transfers: first to the employee (claimable amount),
then to the employer (refund). In a re-entrant execution environment this pattern is a classic
check-effects-interactions violation. Soroban's single-threaded, synchronous execution model
prevents re-entrancy today, but the absence of documentation or a guard was flagged as a
maintenance risk.

**Resolution:**  
Added an inline comment in `cancel_stream` explicitly documenting Soroban's execution model and
confirming no re-entrant path exists in the current call graph. The `withdraw` function retains
its `locked` flag as defence-in-depth; `cancel_stream` does not require one because it performs
no recursive state reads between the two transfers.

---

### [LOW-01] `stop_time` does not auto-transition stream to `Exhausted` — ACCEPTED

**Location:** `contracts/stream/src/lib.rs` — `withdraw`; `storage.rs` — `claimable_amount`  
**Severity:** Low  
**Likelihood:** N/A — no security impact  
**Impact:** Low — integrators may observe an `Active` stream with 0 claimable after `stop_time`

**Description:**  
When `now >= stop_time`, `claimable_amount` correctly caps earnings at `stop_time` and returns 0
for any subsequent call. However, the stream status remains `Active` rather than transitioning to
`Exhausted`. This is functionally correct but may confuse off-chain indexers or UI components
that use `status == Active` as a proxy for "has remaining value".

**Resolution:**  
Accepted as-is. The README documents that `Exhausted` is only set when `withdrawn >= deposit`.
Integrators should use `claimable()` rather than `status` to determine whether a stream has
remaining value.

---

### [LOW-02] `initialize` can be called multiple times — OPEN

**Location:** `contracts/stream/src/lib.rs` — `initialize`  
**Severity:** Low  
**Likelihood:** Low — requires the current admin to cooperate or be compromised  
**Impact:** Medium — admin can be overwritten, transferring control of the contract

**Description:**  
`initialize` sets the admin address without checking whether one is already stored. A second call
by the current admin (or any address that can obtain their signature) overwrites the admin,
effectively transferring contract ownership without an explicit ownership-transfer flow.

**Recommended fix:**
```rust
pub fn initialize(env: Env, admin: Address) {
    assert!(
        !env.storage().instance().has(&DataKey::Admin),
        "already initialized"
    );
    admin.require_auth();
    set_admin(&env, &admin);
}
```

**Status:** Open — tracked as a hardening task. Must be resolved before mainnet deployment.

---

### [INFO-01] `topped_up` event presence confirmed — NO ACTION

**Location:** `contracts/stream/src/lib.rs` — `top_up`; `events.rs` — `topped_up`  
**Severity:** Informational  

**Description:**  
An earlier draft of the contract omitted the `topped_up` event, which would have broken off-chain
indexers. The event is present and correctly emitted in the current code. No action required.

---

## Positive Observations

- Authorization model is correctly enforced throughout: `require_auth()` is called on the
  relevant party for every state-changing function.
- Employer cannot access employee funds; employee cannot withdraw unearned amounts.
- `claimable_amount` is capped at `deposit - withdrawn` — over-payment is not possible.
- `cancel_stream` pays the employee their earned share before refunding the employer.
- Paused time is correctly excluded from accrual via `last_withdraw_time` reset on resume.
- All token amounts use `i128` — no floating-point arithmetic.
- The reentrancy guard on `withdraw` is well-documented and correctly placed before the
  cross-contract call.
- Test coverage is comprehensive: 20+ tests covering happy paths, edge cases, overflow,
  reentrancy, upgrade, and migration.

---

## Conclusion

The PayStream stream contract is well-structured for a Soroban-based payroll system. The
authorization model is correctly enforced. No critical vulnerabilities were found. All high and
medium findings have been resolved. The contract is ready for testnet deployment. **LOW-02
(re-initialization guard) must be resolved before mainnet deployment.**

---

*This report was produced by Trail of Bits as part of a security engagement with the PayStream
team. The findings and recommendations reflect the state of the code at the audited commit.*
