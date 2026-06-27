# Configuration Reference

**Version:** 1.0
**Scope:** `paystream-stream` contract + deployment scripts

---

## Overview

PayStream has two categories of configuration:

1. **On-chain contract settings** — stored in Soroban contract instance storage; changed via admin contract calls
2. **Deployment environment variables** — shell variables read by the deploy and init scripts

There is no config file, `.env` file, or external secrets service. All sensitive values (admin key, contract IDs) are kept in the operator's environment and never committed to this repository.

---

## On-Chain Contract Settings

These values live in the contract's instance storage on the Stellar ledger. They persist across transactions and can only be changed by the admin.

### `MinDeposit`

| Property | Value |
|---|---|
| Storage key | `DataKey::MinDeposit` |
| Type | `i128` (token base units, e.g. stroops) |
| Default | `10_000` (defined as `DEFAULT_MIN_DEPOSIT` in `storage.rs`) |
| Set via | `set_min_deposit(admin, nonce, amount)` |
| Read via | `get_min_deposit` (internal); no public read endpoint — use `create_stream` error to detect |
| Security | Only the admin can change this; requires a valid nonce (replay protection) |

**Purpose:** Prevents spam streams with negligible deposits that would bloat storage indexes. Every `create_stream` call requires `deposit >= MinDeposit`.

**Tuning guidance:**
- Set too low: spam risk; storage index growth
- Set too high: barrier to legitimate small-scale streaming
- Recommended starting point: 10,000 stroops (0.001 XLM equivalent) for testnet; calibrate for mainnet based on token price

**CLI:**
```bash
stellar contract invoke --id <STREAM_ID> --source <ADMIN_KEY> --network testnet \
  -- set_min_deposit --admin <ADMIN_ADDRESS> --nonce <NONCE> --amount 10000
```

---

### `Admin`

| Property | Value |
|---|---|
| Storage key | `DataKey::Admin` |
| Type | `Address` (Ed25519 public key or contract address) |
| Default | None — must be set via `initialize` on first deploy |
| Set via | `initialize(admin)` (one-time) or two-step transfer: `propose_admin` → `accept_admin` |
| Security | **Critical.** Controls pause, min-deposit, and upgrade. Compromise = full contract control. Consider a multisig admin for production. |

**Two-step admin rotation:**
```bash
# Step 1: current admin proposes new admin
stellar contract invoke --id <STREAM_ID> --source <CURRENT_ADMIN_KEY> --network testnet \
  -- propose_admin --new_admin <NEW_ADMIN_ADDRESS>

# Step 2: new admin accepts
stellar contract invoke --id <STREAM_ID> --source <NEW_ADMIN_KEY> --network testnet \
  -- accept_admin --new_admin <NEW_ADMIN_ADDRESS>
```

---

### `AdminNonce`

| Property | Value |
|---|---|
| Storage key | `DataKey::AdminNonce` |
| Type | `u64` |
| Default | `0` |
| Incremented by | Every admin call: `pause_contract`, `unpause_contract`, `set_min_deposit`, `upgrade` |
| Read via | `admin_nonce()` public function |
| Security | Prevents replay of a captured signed admin transaction |

**How to use:**
```bash
# Get current nonce before any admin call
NONCE=$(stellar contract invoke --id <STREAM_ID> --network testnet -- admin_nonce)

# Use it in the next admin call
stellar contract invoke --id <STREAM_ID> --source <ADMIN_KEY> --network testnet \
  -- pause_contract --nonce "$NONCE"
```

The nonce is consumed atomically. If two admin transactions are submitted concurrently with the same nonce, only the first will succeed.

---

### `Paused`

| Property | Value |
|---|---|
| Storage key | `DataKey::Paused` |
| Type | `bool` |
| Default | `false` |
| Set via | `pause_contract(nonce)` / `unpause_contract(nonce)` |
| Security | Admin-only; requires nonce |

When `true`, `create_stream`, `create_streams_batch`, and `withdraw` revert. All other functions (top-up, cancel, read-only queries) continue to work.

---

### Storage TTL Constants

These are compile-time constants in `storage.rs` (not configurable at runtime):

| Constant | Value | Meaning |
|---|---|---|
| `TTL_THRESHOLD` | `6_307_200` ledgers (~1 year) | Minimum remaining TTL before extension is triggered |
| `TTL_EXTEND_TO` | `12_614_400` ledgers (~2 years) | TTL is extended to this value on every read/write |

Stellar produces approximately 1 ledger every 5 seconds. These values are extended on every `save_stream`, `load_stream`, and stream-index write, ensuring active streams never expire from persistent storage.

To change these, update the constants in `contracts/stream/src/storage.rs` and redeploy.

---

### Validation Constants

Compile-time constants in `validate.rs`:

| Constant | Value | Type | Description |
|---|---|---|---|
| `MAX_RATE_PER_SECOND` | `1_000_000_000` | `i128` | Upper bound on `rate_per_second` for any stream; prevents arithmetic overflow in `claimable_amount` |

To change, update `contracts/stream/src/validate.rs` and redeploy.

---

## Deployment Environment Variables

These variables are read by the shell scripts in `scripts/`. They are never stored in the repository.

### `deploy-testnet.sh` / `deploy-local.sh`

| Variable | Required | Default | Description |
|---|---|---|---|
| `STELLAR_SOURCE_ACCOUNT` | No | `default` | Stellar CLI account name used to sign the deploy transactions. Must have XLM for fees. |

**Example:**
```bash
export STELLAR_SOURCE_ACCOUNT=my-deployer-account
./scripts/deploy-testnet.sh
```

---

### `init-testnet.sh`

| Variable | Required | Default | Description | Security |
|---|---|---|---|---|
| `STELLAR_ADMIN_ADDRESS` | **Yes** | — | Stellar public key that becomes the contract admin after `initialize` | Keep the corresponding secret key offline or in a hardware wallet for production |
| `TOKEN_CONTRACT_ID` | **Yes** | — | Contract ID of the deployed `paystream-token` contract (output of `deploy-testnet.sh`) | Not sensitive — public ledger data |
| `STREAM_CONTRACT_ID` | **Yes** | — | Contract ID of the deployed `paystream-stream` contract (output of `deploy-testnet.sh`) | Not sensitive — public ledger data |
| `STELLAR_SOURCE_ACCOUNT` | No | `default` | Stellar CLI account name used to sign the init transactions | — |
| `INITIAL_SUPPLY` | No | `1000000000` | Initial token supply minted to `STELLAR_ADMIN_ADDRESS` during token initialization | — |

**Example:**
```bash
export STELLAR_ADMIN_ADDRESS=GABC...XYZ
export TOKEN_CONTRACT_ID=CABC...XYZ
export STREAM_CONTRACT_ID=CABC...XYZ
export INITIAL_SUPPLY=1000000000
./scripts/init-testnet.sh
```

---

## Example Configurations

### Minimal Testnet Setup

```bash
# 1. Build
make build

# 2. Deploy
export STELLAR_SOURCE_ACCOUNT=testnet-deployer
./scripts/deploy-testnet.sh
# → prints TOKEN_CONTRACT_ID and STREAM_CONTRACT_ID

# 3. Initialise
export STELLAR_ADMIN_ADDRESS=<YOUR_PUBLIC_KEY>
export TOKEN_CONTRACT_ID=<FROM_STEP_2>
export STREAM_CONTRACT_ID=<FROM_STEP_2>
./scripts/init-testnet.sh

# 4. Set minimum deposit (optional — default is 10_000)
NONCE=$(stellar contract invoke --id "$STREAM_CONTRACT_ID" --network testnet -- admin_nonce)
stellar contract invoke --id "$STREAM_CONTRACT_ID" --source <ADMIN_KEY> --network testnet \
  -- set_min_deposit --admin "$STELLAR_ADMIN_ADDRESS" --nonce "$NONCE" --amount 10000
```

### Local Development Setup

```bash
make deploy-local
# Prints TOKEN_CONTRACT_ID and STREAM_CONTRACT_ID for a local Stellar node
```

### Docker (no local tools required)

```bash
docker compose run --rm test    # build + test
docker compose run --rm build stellar contract build   # WASM only
```

---

## Performance Tuning

| Setting | Effect | Recommendation |
|---|---|---|
| `MinDeposit` | Higher value → fewer streams → less storage index growth | Increase if stream indexes become large; balance against UX |
| `rate_per_second` (per stream) | Higher rates increase claimable precision but approach `MAX_RATE_PER_SECOND` overflow limit | Keep well below 1,000,000,000; typical values are 1–10,000 |
| `INITIAL_SUPPLY` (token) | Does not affect stream contract performance | Set to the amount needed for testing |
| Storage TTL | Longer TTL → more frequent `extend_ttl` Stellar resource charges | Current defaults (~2-year max) are appropriate for production; reduce for test environments to save fees |

---

## Security Notes

- **Never commit secret keys.** The Stellar source account secret key is used only by the Stellar CLI locally — it is not read by the contract.
- **Admin key protection.** The admin address controls all privileged operations. For production, use a hardware wallet or multisig admin. See [SECURITY.md](../SECURITY.md).
- **Nonce must be fetched fresh.** Always call `admin_nonce()` immediately before constructing an admin transaction to avoid E009 failures.
- **Contract IDs are public.** `TOKEN_CONTRACT_ID` and `STREAM_CONTRACT_ID` are not secrets — they are visible on the public Stellar ledger.
- **Pausing is reversible.** `pause_contract` and `unpause_contract` are both admin-only and nonce-protected. A captured pause transaction cannot be replayed.
