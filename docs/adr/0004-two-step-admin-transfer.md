# ADR 0004: Use two-step admin transfer and nonce-based admin operations

## Status

Accepted

## Context

Administrative control must be secure and recoverable without introducing replay vulnerabilities.

## Decision

The contract uses a two-step admin transfer with `propose_admin` and `accept_admin`. Administrative operations also consume a monotonically increasing `admin_nonce` to prevent replay of paused/unpaused and upgrade transactions.

## Consequences

- Positive: Admin transfer requires both nomination and acceptance, reducing accidental takeover risk.
- Positive: Nonce-based admin operations prevent replay attacks on privileged contract actions.
- Negative: Admin callers must track and supply the current nonce for each operation.
