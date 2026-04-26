# ADR 0003: Use explicit storage keys with TTL extension

## Status

Accepted

## Context

Soroban storage costs and lifetime behavior must be managed carefully for long-lived payroll streams.

## Decision

We store each stream under an explicit `DataKey::Stream(id)` key and maintain employer/employee indexes separately. Every persistent stream entry extends its TTL on access to keep long-lived streams alive.

## Consequences

- Positive: Stream lookups are O(1) by ID and indexes are efficient for owner queries.
- Positive: TTL extension prevents active streams from expiring while still allowing stale data to eventually clean up.
- Negative: The contract incurs additional storage writes on access due to TTL extension.
