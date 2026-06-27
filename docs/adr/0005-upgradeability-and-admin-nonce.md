# ADR 0005: Support contract upgradeability with admin-controlled migration

## Status

Accepted

## Context

Smart contracts may need fixes or emergency recovery logic after deployment. The contract must preserve state across upgrades.

## Decision

We allow the admin to upgrade the contract WASM and keep a `migrate` entry point to verify the upgraded contract. Admin upgrade operations also require the current `admin_nonce`.

## Consequences

- Positive: The contract can evolve over time and respond to emergent issues.
- Positive: The migration hook verifies the new WASM before normal operation resumes.
- Negative: Upgrade authority is centralized to the admin key, so admin key management remains critical.
