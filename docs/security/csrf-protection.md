# CSRF Protection

**Version:** 1.0
**Scope:** `paystream-stream` Soroban smart contract + off-chain integrations

---

## Overview

Cross-Site Request Forgery (CSRF) is an attack where a malicious website tricks an authenticated user's browser into issuing state-changing requests to another site. CSRF is a browser/HTTP-session concern — it targets cookies and implicit credentials that browsers attach automatically to cross-origin requests.

PayStream is a Soroban smart contract on the Stellar blockchain. **The contract itself has no CSRF surface** because:

- There are no HTTP endpoints, cookies, or sessions in the contract layer
- Every state-changing call requires an explicit Ed25519 cryptographic signature from the caller's keypair
- The Stellar network rejects any transaction that lacks a valid signature — a malicious third-party site cannot forge a signature on behalf of a user
- Soroban's `Address::require_auth()` enforces this at the protocol level on every mutating function

This document explains the protections already in place at the contract layer and the CSRF mitigations that **integrators and front-ends must implement** when building on PayStream.

---

## Contract-Layer Protections

### Cryptographic Signature Requirement

Every state-changing contract invocation is a Stellar transaction signed with the caller's secret key. The Stellar network validates the signature before executing the contract. An unsigned or incorrectly-signed transaction is rejected by every validator — no contract code runs.

| Protection | Mechanism | Analogue |
|---|---|---|
| Identity binding | Ed25519 signature on the full transaction XDR | CSRF token bound to session |
| Replay prevention | Stellar sequence number, unique per account, monotonically increasing | CSRF token single-use |
| Scope limitation | `require_auth()` scope restricts what sub-invocations can be authorised | SameSite=Strict cookies |

### Admin Nonce (Replay Protection)

Admin operations (`pause_contract`, `unpause_contract`, `set_min_deposit`, `upgrade`) consume a monotonic nonce stored in contract state (E009). This prevents replay of a captured signed admin transaction even if the Stellar sequence number were somehow reused.

### `require_auth()` on All Mutating Functions

| Function | Auth required from |
|---|---|
| `create_stream` | `employer` |
| `create_streams_batch` | `employer` |
| `withdraw` | `employee` |
| `top_up` | `employer` |
| `pause_stream` | `employer` |
| `resume_stream` | `employer` |
| `cancel_stream` | `employer` |
| `pause_contract` | `admin` |
| `unpause_contract` | `admin` |
| `set_min_deposit` | `admin` |
| `upgrade` | `admin` |
| `propose_admin` | current `admin` |
| `accept_admin` | pending `admin` |

---

## Off-Chain / Front-End CSRF Mitigations

If you build a web application that constructs and submits Stellar transactions on behalf of users, apply the following controls.

### 1. Never Hold Secret Keys Server-Side

The correct architecture is wallet-based signing: the front-end constructs an unsigned transaction XDR, sends it to the user's wallet (Freighter, Albedo, Rabet, WalletConnect), and the wallet signs it locally. The server never sees the secret key. This eliminates the CSRF surface entirely — even if a malicious request reaches your server, it cannot produce a valid signed transaction.

### 2. CSRF Tokens for Any Server-Side Session Actions

If your back-end has authenticated sessions (e.g., for storing user preferences or off-chain data), apply standard CSRF protections:

- Generate a cryptographically random token per session (min 128 bits, e.g., `rand::random::<[u8; 16]>()` encoded as hex)
- Include the token in every state-changing form or API request (header: `X-CSRF-Token`)
- Validate the token server-side before processing the request
- Rotate the token on privilege changes (login, logout)
- Do **not** expose the token in URLs or logs

### 3. SameSite Cookie Attribute

For any session cookie your application sets:

```
Set-Cookie: session=<value>; HttpOnly; Secure; SameSite=Strict
```

- `SameSite=Strict` prevents the cookie from being sent on cross-origin navigations
- `HttpOnly` prevents JavaScript access to the cookie
- `Secure` restricts the cookie to HTTPS connections

### 4. Double-Submit Cookie Pattern (Stateless Alternative)

For stateless APIs, use the double-submit cookie pattern:

1. Set a random `csrf_token` cookie (not `HttpOnly`)
2. Require the same value in a request header (`X-CSRF-Token`)
3. Server compares cookie value to header value — mismatch = reject

This works because a cross-origin attacker can trigger a request but cannot read or set cookies on your origin.

### 5. CORS Policy

Restrict which origins may call your back-end API:

```
Access-Control-Allow-Origin: https://app.paystream.example
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, X-CSRF-Token
```

Do not use `Access-Control-Allow-Origin: *` on authenticated endpoints.

### 6. Content Security Policy

Serve a `Content-Security-Policy` header to limit what scripts can execute in your front-end, reducing the risk of XSS-then-CSRF chaining.

---

## Exception Handling

| Scenario | Behaviour |
|---|---|
| Missing CSRF token (server-side) | Return HTTP 403 Forbidden; log the attempt |
| Invalid / expired CSRF token | Return HTTP 403 Forbidden; do not reveal whether it expired or was never valid |
| Transaction with invalid signature (contract layer) | Stellar network rejects before contract runs; caller receives `txBAD_AUTH` error |
| Admin nonce mismatch | Contract panics with E009; transaction reverts |
| Replay of a used Stellar sequence number | Stellar network rejects with `txBAD_SEQ` |

---

## Security Review Checklist

- [ ] Front-end uses wallet-based signing (secret key never on server)
- [ ] All server-side session cookies set `HttpOnly; Secure; SameSite=Strict`
- [ ] CSRF token present and validated on every non-GET server endpoint
- [ ] CORS `Allow-Origin` is not a wildcard for authenticated endpoints
- [ ] Content-Security-Policy header is set
- [ ] Token rotation occurs on login, logout, and privilege change
- [ ] Any new admin contract function calls `consume_admin_nonce`
