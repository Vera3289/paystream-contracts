# Contract Upgrade Guide

PayStream uses Soroban's native WASM upgrade mechanism. The contract address never changes — only the executable bytecode is replaced. All persistent storage (streams, indices, admin) survives the upgrade untouched.

## How it works

1. **Build** the new contract version
2. **Upload** the new WASM to the ledger (produces a WASM hash)
3. **Call `upgrade`** on the deployed contract with the new WASM hash (admin only)
4. **Call `migrate`** if the new version requires data-model changes (admin only, no-op in base version)

## Step-by-step

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

## Storage compatibility

Soroban's upgrade replaces only the WASM bytecode. All `persistent` and `instance` storage entries remain intact. When adding new storage keys in an upgrade:

- New keys with `unwrap_or` defaults are safe — they return the default until explicitly set
- Renamed or removed keys require a `migrate` implementation to transform existing data
- The `DataKey` enum is `#[contracttype]` — adding new variants is backward-compatible

## Security

- Only the contract admin can call `upgrade` and `migrate`
- The admin address is stored in instance storage under `DataKey::Admin`
- Soroban emits a `SYSTEM` event on every upgrade containing the old and new WASM hashes, providing an on-chain audit trail
