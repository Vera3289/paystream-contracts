# Storage Audit — No PII in Contract Storage

**Date:** 2026-04-26
**Auditor:** PayStream Engineering
**Issue:** #67
**Scope:** All persistent, instance, and temporary storage keys in `contracts/stream` and `contracts/token`

---

## Methodology

Every `DataKey` and `TokenDataKey` variant was enumerated from source. For each key, the stored value type was identified and assessed for the presence of personally identifiable information (PII) or sensitive off-chain data.

PII is defined as any data that could identify a natural person: name, email address, phone number, physical address, government ID, biometric data, or any combination of pseudonymous identifiers that could be linked to a real-world identity.

---

## Stream Contract — `contracts/stream/src/types.rs`

Storage tier: `env.storage().persistent()` for stream data and indexes; `env.storage().instance()` for global config.

| Key | Storage Tier | Value Type | PII? | Notes |
|-----|-------------|------------|------|-------|
| `Stream(u64)` | Persistent | `Stream` struct | ❌ No | Contains `employer: Address`, `employee: Address`, `token: Address`, `deposit: i128`, `withdrawn: i128`, `rate_per_second: i128`, `start_time: u64`, `stop_time: u64`, `last_withdraw_time: u64`, `cooldown_period: u64`, `status: StreamStatus`, `locked: bool`. All fields are on-chain cryptographic addresses or numeric values. No names, emails, or off-chain identifiers. |
| `StreamCount` | Instance | `u64` | ❌ No | Global counter. |
| `Admin` | Instance | `Address` | ❌ No | Cryptographic public key. |
| `MinDeposit` | Instance | `i128` | ❌ No | Numeric threshold. |
| `AdminNonce` | Instance | `u64` | ❌ No | Replay-protection counter. |
| `Paused` | Instance | `bool` | ❌ No | Contract pause flag. |
| `PendingAdmin` | Instance | `Address` | ❌ No | Cryptographic public key. |
| `EmployerStreams(Address)` | Persistent | `Vec<u64>` | ❌ No | List of stream IDs keyed by employer address. No off-chain data. |
| `EmployeeStreams(Address)` | Persistent | `Vec<u64>` | ❌ No | List of stream IDs keyed by employee address. No off-chain data. |

---

## Token Contract — `contracts/token/src/types.rs`

Storage tier: `env.storage().persistent()` for balances; `env.storage().temporary()` for allowances; `env.storage().instance()` for supply and admin.

| Key | Storage Tier | Value Type | PII? | Notes |
|-----|-------------|------------|------|-------|
| `Balance(Address)` | Persistent | `i128` | ❌ No | Token balance for an address. Numeric only. |
| `Allowance(Address, Address)` | Temporary | `i128` | ❌ No | Approved spend amount between two addresses. Numeric only. |
| `TotalSupply` | Instance | `i128` | ❌ No | Aggregate token supply. |
| `Admin` | Instance | `Address` | ❌ No | Cryptographic public key. |

---

## Findings

**No PII or sensitive off-chain data was found in any storage key or value.**

All stored values are one of:
- Cryptographic public key addresses (`Address`) — pseudonymous by design on Stellar; not PII under the contract's data model
- Numeric amounts (`i128`, `u64`, `u32`) — token quantities, timestamps, counters
- Boolean flags
- Enumerations (`StreamStatus`)
- Collections of the above (`Vec<u64>`)

No free-text fields, no email addresses, no names, no off-chain identifiers, and no encrypted blobs are stored anywhere in contract storage.

### Note on Address Pseudonymity

Stellar `Address` values are cryptographic public keys. While they are pseudonymous (not directly tied to a real-world identity in the contract), they are public on-chain. This is expected and inherent to all public blockchain systems. No additional PII is attached to these addresses within the contract storage.

---

## Recommendations

1. **No remediation required** — storage is clean of PII.
2. **Future changes** — any new storage key that stores user-supplied string data (e.g., a stream label or memo) must be reviewed before merging to ensure it does not introduce PII.
3. **Off-chain indexers** — if an off-chain indexer or API layer is built on top of these contracts, that layer must be assessed separately for PII handling and GDPR/privacy compliance.

---

## Conclusion

The storage audit is complete. All storage keys and values in both `contracts/stream` and `contracts/token` contain only cryptographic addresses and numeric/boolean data. No PII is stored on-chain.
