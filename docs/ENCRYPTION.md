# Encryption & Key Management Policy

This document describes the encryption strategy and key management practices for PayStream.

---

## 1. Data Encryption at Rest

### On-Chain Contract State
Smart contract storage on the Stellar/Soroban ledger is **publicly visible by design** — this is a
property of all public blockchains. No personally identifiable information (PII) or secret material
is stored in contract state. Only the following types of data exist in contract storage:

| Field | Type | Sensitivity |
|-------|------|-------------|
| Wallet addresses | Public key | Public |
| Token amounts | i128 integer | Public |
| Stream timestamps | u64 | Public |
| Stream status | Enum | Public |

### Off-Chain Components
Any off-chain service (frontend, indexer, notification service) that stores sensitive data **must**:

- Use **AES-256-GCM** for data at rest.
- Store encryption keys in a dedicated secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault)
  — never in environment variable files committed to source control.
- Encrypt database backups with the same standard before writing to object storage.

---

## 2. Data Encryption in Transit (TLS/SSL)

All network communication involving PayStream services must use **TLS 1.2 or higher**.

| Connection | Requirement |
|---|---|
| Client ↔ Frontend | TLS 1.3 preferred; TLS 1.2 minimum |
| Frontend ↔ Stellar Horizon API | HTTPS (TLS enforced by Stellar) |
| Backend ↔ Database | TLS with certificate verification |
| CI/CD pipelines | GitHub Actions secrets; never plain-text credentials in logs |

Certificates must be issued by a trusted CA (Let's Encrypt is acceptable) and renewed before
expiry. HSTS must be enforced on all public endpoints (see `docs/SECURITY_HEADERS.md`).

---

## 3. Key Management System

### Signing Keys (Stellar Keypairs)
Stellar keypairs (Ed25519) used for contract deployment and admin operations:

- **Development**: Use throwaway testnet keypairs. Never reuse testnet keys on mainnet.
- **Staging/Testnet**: Keys stored in CI/CD secrets (GitHub Actions encrypted secrets).
- **Production (Mainnet)**: Keys stored in HSM or cloud KMS (e.g., AWS KMS, GCP Cloud HSM).
  Direct private key material must never appear in logs, environment files, or source code.

### Application Secrets (off-chain services)
- Store in a secrets manager, not in `.env` files in version control.
- Secrets are injected at runtime via environment variables or a secrets sidecar.
- Access to the secrets manager is restricted by IAM role and audited.

---

## 4. Encryption Algorithm Documentation

| Purpose | Algorithm | Key Size | Notes |
|---------|-----------|----------|-------|
| Stellar transaction signing | Ed25519 | 256-bit | Enforced by Stellar protocol |
| Data at rest (off-chain) | AES-256-GCM | 256-bit | Authenticated encryption |
| TLS (data in transit) | TLS 1.3 / AES-256-GCM | — | Per TLS handshake |
| Password hashing (if applicable) | Argon2id | — | Min: 64 MiB memory, 3 iterations |
| Backup encryption | AES-256-GCM | 256-bit | Same keys as data-at-rest |

---

## 5. Key Rotation Policy

| Key Type | Rotation Frequency | Trigger for Immediate Rotation |
|---|---|---|
| Stellar admin keypair | Annually | Suspected compromise, personnel change |
| Application encryption keys (AES) | Every 90 days | Suspected compromise |
| TLS certificates | Before expiry (auto-renew) | Revocation or CA compromise |
| CI/CD secrets | On team member offboarding | Suspected exposure |

Key rotation procedure:
1. Generate new key material in the secrets manager.
2. Update all services to use the new key (rolling deployment where possible).
3. Re-encrypt existing data at rest with the new key (re-encryption job).
4. Revoke and archive the old key; retain for decryption of old backups per the retention policy.

---

## 6. Encrypted Backups

Off-chain databases must be backed up with the following requirements:

- Backups are encrypted with AES-256-GCM **before** being written to object storage.
- Backup encryption keys are stored separately from the backup data.
- Backups are tested for restorability at least monthly.
- Retention: 30-day rolling window for daily backups; 12-month retention for monthly snapshots.
- Backup access is restricted to authorised operations personnel only.

---

## 7. Secure Key Storage

| Environment | Storage Mechanism |
|---|---|
| Local development | Local keystore file (never committed); `~/.config/stellar/identity/` |
| CI/CD (testnet) | GitHub Actions encrypted secrets |
| Production | HSM or cloud KMS (AWS KMS / GCP Cloud HSM / HashiCorp Vault) |

**Never:**
- Commit private key material to source control.
- Log private key material or raw secret values.
- Store secrets in Docker images or container environment variables in plain text.

---

## 8. Relevant Files

| File | Purpose |
|---|---|
| `SECURITY.md` | Vulnerability disclosure policy |
| `docs/ENCRYPTION.md` | This document |
| `docs/SECURITY_HEADERS.md` | HTTP security headers configuration |
| `.github/workflows/ci.yml` | CI pipeline (uses GitHub secrets for credentials) |
