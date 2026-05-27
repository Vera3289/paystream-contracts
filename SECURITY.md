# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: `security@paystream.example`

Please encrypt your report using our PGP key (published at `https://paystream.example/.well-known/security.txt`).

Include in your report:
- A clear description of the vulnerability
- Steps to reproduce or a proof-of-concept
- Affected contract(s) and function(s)
- Potential impact assessment

### Disclosure Timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgement | Within 48 hours of receipt |
| Triage & severity assessment | Within 5 business days |
| Resolution timeline communicated | Within 7 business days |
| Patch released (critical/high) | Within 30 days |
| Patch released (medium/low) | Within 90 days |
| Public disclosure | After patch is deployed and verified |

We follow a coordinated disclosure model. We ask that you give us the time above to resolve the issue before any public disclosure.

---

## Scope

The following are **in scope** for security reports:

### Contracts
- `contracts/stream` — salary streaming and escrow logic
- `contracts/token` — fungible payment token

### Vulnerability Classes
- Loss or theft of user funds (deposits, withdrawals, refunds)
- Unauthorised access to admin functions
- Reentrancy or cross-contract call vulnerabilities
- Integer overflow / underflow leading to incorrect token amounts
- Replay attacks on admin operations
- Denial-of-service attacks that permanently lock funds
- Storage manipulation or data corruption
- Logic errors in claimable amount calculation
- Bypass of `require_auth()` checks

---

## Out of Scope

The following are **not eligible** for bug bounty rewards:

- Issues in third-party dependencies (Soroban SDK, Stellar core) — report those upstream
- Theoretical attacks with no practical exploit path
- Issues requiring physical access to a validator node
- Social engineering or phishing attacks
- Bugs in testnet deployments that do not affect mainnet logic
- Front-end or off-chain tooling (scripts, deploy helpers)
- Gas / resource fee optimisations (not a security issue)
- Issues already reported or known (see [audits/remediation.md](audits/remediation.md))
- Spam or denial-of-service via normal transaction volume

---

## Bug Bounty

PayStream operates a **pre-mainnet bug bounty programme**.

| Severity | Reward |
|----------|--------|
| Critical (funds at risk, full exploit) | Up to $10,000 USDC |
| High (partial fund loss, auth bypass) | Up to $3,000 USDC |
| Medium (degraded functionality, no fund loss) | Up to $500 USDC |
| Low / Informational | Recognition in CHANGELOG |

Severity is assessed by the PayStream security team using the [CVSS v3.1](https://www.first.org/cvss/v3.1/specification-document) framework. Rewards are paid after a fix is deployed and verified on testnet.

> **Note:** The bug bounty programme is active for the contracts at the commit hashes listed in the latest audit report. Rewards are at the sole discretion of the PayStream team.

---

## Security Audits

| Date | Auditor | Report | Remediation |
|------|---------|--------|-------------|
| 2026-04 | Trail of Bits | [2026-04-trail-of-bits.md](audits/2026-04-trail-of-bits.md) | [remediation.md](audits/remediation.md) |

All high and medium findings from the April 2026 audit have been resolved. One low-severity finding (LOW-02: re-initialisation guard) remains open and must be resolved before mainnet deployment. See [audits/remediation.md](audits/remediation.md) for the full status breakdown.

---

## Security Design Notes

- All state-changing functions require explicit `require_auth()` from the relevant party
- Employer cannot withdraw employee funds; employee cannot access unearned funds
- Claimable amount is always capped at `deposit - withdrawn` — no over-payment possible
- Cancel pays employee their earned share first, then refunds employer the remainder
- Paused time is excluded from accrual — `last_withdraw_time` is reset on resume
- All token amounts use `i128` — no floating-point arithmetic
- Stop time is validated to be in the future at stream creation
- Admin operations are protected by a monotonically-increasing nonce (replay protection)
- Two-step admin transfer prevents accidental loss of admin access
- Reentrancy guard (`locked` flag) on `withdraw` as defence-in-depth

For the full threat model see [docs/security/threat-model.md](docs/security/threat-model.md).
