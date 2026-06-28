# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues by email to: **security@paystream.example**

Please include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested mitigations (optional)

---

## Disclosure Process

1. **Submit** — Email `security@paystream.example` with details.
2. **Acknowledgement** — You will receive confirmation within **48 hours**.
3. **Assessment** — We evaluate severity and scope within **5 business days**.
4. **Resolution timeline** — A fix target date is communicated within **7 days** of receipt.
5. **Patch & disclosure** — We release a fix, then coordinate public disclosure with you.
6. **Credit** — With your permission, we acknowledge your contribution in the Hall of Fame.

---

## Response Time SLA

| Severity | Acknowledgement | Resolution Target |
|----------|----------------|-------------------|
| Critical | 24 hours       | 7 days            |
| High     | 48 hours       | 14 days           |
| Medium   | 72 hours       | 30 days           |
| Low      | 5 business days | 90 days          |

---

## Responsible Disclosure Guidelines

- Give us reasonable time to address the issue before public disclosure.
- Do not exploit the vulnerability beyond what is necessary to demonstrate the issue.
- Do not access, modify, or delete data that does not belong to you.
- Do not disrupt production services or degrade user experience.
- Do not use social engineering, phishing, or physical attacks.
- Act in good faith throughout the process.

We commit to:
- Respond promptly and keep you informed of progress.
- Not pursue legal action against researchers acting in good faith.
- Work with you on an appropriate disclosure timeline.

---

## Scope

**In scope:**
- Smart contracts in `contracts/`
- Deployment and initialization scripts
- GitHub Actions workflows

**Out of scope:**
- Third-party dependencies (report to the respective maintainer)
- Stellar network protocol issues (report to the [Stellar Development Foundation](https://stellar.org/security))
- Issues requiring physical access to infrastructure

---

## Reward Program

We currently operate a **goodwill recognition program** (not a paid bug bounty).

- Critical/High severity findings: Public acknowledgement + Hall of Fame listing
- Paid bounties may be introduced in a future program — watch this file for updates

---

## Hall of Fame

We thank the following researchers for responsibly disclosing vulnerabilities:

| Researcher | Finding | Date |
|------------|---------|------|
| *(be the first!)* | — | — |

---

## Security Design Notes

- All state-changing functions require explicit `require_auth()` from the relevant party
- Employer cannot withdraw employee funds; employee cannot access unearned funds
- Claimable amount is always capped at `deposit - withdrawn` — no over-payment possible
- Cancel pays employee their earned share first, then refunds employer the remainder
- Paused time is excluded from accrual — `last_withdraw_time` is reset on resume
- All token amounts use `i128` — no floating-point arithmetic
- Stop time is validated to be in the future at stream creation
- Wallet addresses are validated at the Soroban SDK level via the `Address` type
