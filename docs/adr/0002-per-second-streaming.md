# ADR 0002: Use per-second streaming semantics

## Status

Accepted

## Context

Salary flows can be paid in periodic lumps or continuous streams. The contract should support fine-grained accrual and predictable employee access.

## Decision

We model streams using a per-second rate and a deposit-based escrow. Claimable balance grows continuously between withdrawals.

## Consequences

- Positive: Employees can withdraw earned pay at any time, avoiding pay-period lockups.
- Positive: The model simplifies accrual calculations and aligns with streaming payroll expectations.
- Negative: Per-second accounting requires careful handling of timestamps and stop times.
