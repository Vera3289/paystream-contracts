# Contract Upgrade Guide

PayStream uses Soroban's native WASM upgrade mechanism. The contract address never changes — only the executable bytecode is replaced. All persistent storage (streams, indices, admin) survives the upgrade untouched.

## How it works

1. **Build** the new contract version
2. **Upload** the new WASM to the ledger (produces a WASM hash)
3. **Call `upgrade`** on the deployed contract with the new WASM hash (admin only)
4. **Call `migrate`** if the new version requires data-model changes (admin only, no-op in base version)

---

## Step-by-step upgrade procedure

### 1. Build the new contract

```bash
stellar contract build
```

### 2. Upload the new WASM

```bash
stellar contract upload \
  --source-account <ADMIN_IDENTITY> \
  --wasm target/wasm32v1-none/release/paystream_stream.wasm \
  --network testnet
# outputs: <NEW_WASM_HASH>
```

### 3. Upgrade the deployed contract

```bash
stellar contract invoke \
  --id <STREAM_CONTRACT_ID> \
  --source-account <ADMIN_IDENTITY> \
  --network testnet \
  -- upgrade \
  --new_wasm_hash <NEW_WASM_HASH>
```

### 4. Run migration (if needed)

```bash
stellar contract invoke \
  --id <STREAM_CONTRACT_ID> \
  --source-account <ADMIN_IDENTITY> \
  --network testnet \
  -- migrate \
  --admin <ADMIN_ADDRESS>
```

---

## Data migration script

Use this script when an upgrade introduces new storage keys or renames existing ones. It reads all active streams and re-writes them under the new key schema.

```bash
#!/usr/bin/env bash
# scripts/migrate.sh
# Usage: ADMIN_IDENTITY=<identity> STREAM_CONTRACT_ID=<id> NETWORK=testnet ./scripts/migrate.sh
set -euo pipefail

ADMIN_IDENTITY="${ADMIN_IDENTITY:?set ADMIN_IDENTITY}"
STREAM_CONTRACT_ID="${STREAM_CONTRACT_ID:?set STREAM_CONTRACT_ID}"
NETWORK="${NETWORK:-testnet}"

echo "==> Fetching stream count..."
STREAM_COUNT=$(stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --network "$NETWORK" \
  -- stream_count)

echo "    $STREAM_COUNT streams found"

echo "==> Running on-chain migrate..."
stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --network "$NETWORK" \
  -- migrate \
  --admin "$(stellar keys address "$ADMIN_IDENTITY")"

echo "==> Verifying stream count post-migration..."
POST_COUNT=$(stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --network "$NETWORK" \
  -- stream_count)

if [ "$STREAM_COUNT" != "$POST_COUNT" ]; then
  echo "ERROR: stream count changed ($STREAM_COUNT -> $POST_COUNT). Investigate before proceeding." >&2
  exit 1
fi

echo "Migration complete. Stream count unchanged: $POST_COUNT"
```

### Storage compatibility notes

- New keys with `unwrap_or` defaults are safe — they return the default until explicitly set.
- Renamed or removed keys require a `migrate` implementation to transform existing data.
- The `DataKey` enum is `#[contracttype]` — adding new variants is backward-compatible.

---

## Rollback procedure

Soroban does not support automatic rollback, but you can re-upgrade to the previous WASM hash at any time.

### 1. Locate the previous WASM hash

The previous hash is visible in the Stellar network's upgrade event for the contract. Retrieve it with:

```bash
stellar events \
  --id <STREAM_CONTRACT_ID> \
  --network testnet \
  --type system \
  --limit 10
```

Look for the `contract_upgraded` system event — it contains both the old and new WASM hashes.

Alternatively, if you recorded the hash before upgrading (recommended), use that value directly.

### 2. Re-upload the previous WASM (if not already on-ledger)

```bash
stellar contract upload \
  --source-account <ADMIN_IDENTITY> \
  --wasm target/wasm32v1-none/release/paystream_stream_v<PREV_VERSION>.wasm \
  --network testnet
# outputs: <PREV_WASM_HASH>
```

### 3. Upgrade back to the previous version

```bash
stellar contract invoke \
  --id <STREAM_CONTRACT_ID> \
  --source-account <ADMIN_IDENTITY> \
  --network testnet \
  -- upgrade \
  --new_wasm_hash <PREV_WASM_HASH>
```

### 4. Verify rollback

```bash
stellar contract invoke \
  --id <STREAM_CONTRACT_ID> \
  --source-account <ADMIN_IDENTITY> \
  --network testnet \
  -- stream_count
```

Confirm the stream count and a sample stream match pre-upgrade state.

> **Note:** If the forward migration wrote new storage keys that the old WASM does not understand, those keys are silently ignored by the old code. No data is lost, but the old WASM will not read the new keys. A compensating `migrate` call may be needed if you re-upgrade forward again.

---

## Security

- Only the contract admin can call `upgrade` and `migrate`.
- The admin address is stored in instance storage under `DataKey::Admin`.
- Soroban emits a `SYSTEM` event on every upgrade containing the old and new WASM hashes, providing an on-chain audit trail.
- Always test upgrades on testnet before applying to mainnet.
