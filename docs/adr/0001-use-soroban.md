# ADR 0001: Use Soroban for the smart contract platform

## Status

Accepted

## Context

PayStream is a Stellar-based salary streaming system. We needed a contract platform that supports native Stellar asset handling, predictable fees, and an interoperable execution environment.

## Decision

We chose Soroban as the smart contract platform for PayStream.

## Consequences

- Positive: Native Stellar integration simplifies token transfers and contract deployment.
- Positive: Soroban offers a predictable cost model and a growing developer ecosystem.
- Negative: The platform is still evolving, so we must monitor runtime changes and maintain compatibility.
