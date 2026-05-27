# Mainnet Deployment Runbook

Step-by-step guide for deploying PayStream contracts to Stellar mainnet.

---

## Pre-Deployment Checklist

Complete every item before running any deploy command.

- [ ] All tests pass: `make test`
- [ ] Contract WASM built from a tagged release commit (not a dirty working tree)
- [ ] `git status` is clean; commit SHA recorded
- [ ] Security audit completed or waived with written justification
- [ ] Admin key is a hardware wallet or multisig — **never a hot key**
- [ ] Admin key has sufficient XLM for deployment fees (≥ 10 XLM recommended)
- [ ] `STELLAR_ADMIN_ADDRESS` is set and verified
- [ ] Testnet deployment tested end-to-end (see [testnet.md](../testnet.md))
- [ ] Upgrade/rollback WASM prepared and uploaded to network in advance
- [ ] Team notified; maintenance window scheduled if applicable

---

## Environment Setup

```bash
export NETWORK="mainnet"
export SOURCE="admin"          # stellar CLI key name for the admin account
export STELLAR_ADMIN_ADDRESS="G..."   # admin public key

# Verify the key is accessible
stellar keys show "$SOURCE"
```

---

## Step-by-Step Deployment

### 1. Build release WASM

```bash
make build
# Artifacts: target/wasm32-unknown-unknown/release/paystream_token.wasm
#            target/wasm32-unknown-unknown/release/paystream_stream.wasm
```

Record the SHA256 of each WASM for audit trail:

```bash
sha256sum target/wasm32-unknown-unknown/release/paystream_token.wasm
sha256sum target/wasm32-unknown-unknown/release/paystream_stream.wasm
```

### 2. Deploy token contract

```bash
TOKEN_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/paystream_token.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "TOKEN_CONTRACT_ID=$TOKEN_CONTRACT_ID"
```

### 3. Deploy stream contract

```bash
STREAM_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/paystream_stream.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "STREAM_CONTRACT_ID=$STREAM_CONTRACT_ID"
```

### 4. Initialize stream contract

```bash
stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$STELLAR_ADMIN_ADDRESS"
```

### 5. Set minimum deposit (optional)

```bash
NONCE=$(stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- admin_nonce)

stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- set_min_deposit \
  --admin "$STELLAR_ADMIN_ADDRESS" \
  --nonce "$NONCE" \
  --amount 1000000   # adjust to desired minimum
```

---

## Post-Deploy Verification

Run each check and confirm the expected output before declaring the deployment complete.

```bash
# 1. stream_count should be 0 (no streams yet)
stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- stream_count
# Expected: 0

# 2. admin_nonce should be 0 (or 1 if set_min_deposit was called)
stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- admin_nonce

# 3. Smoke-test: create a stream with a small deposit, then cancel it
stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- create_stream \
  --employer "$STELLAR_ADMIN_ADDRESS" \
  --employee "G<EMPLOYEE_TEST_ADDRESS>" \
  --token_address "$TOKEN_CONTRACT_ID" \
  --deposit 100 \
  --rate_per_second 1 \
  --stop_time 0
# Record the returned stream ID, then cancel:
stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- cancel_stream \
  --employer "$STELLAR_ADMIN_ADDRESS" \
  --stream_id <ID_FROM_ABOVE>
```

Record contract IDs and deployment transaction hashes in your team's deployment log.

---

## Rollback Procedure

If a critical issue is found post-deploy:

### Option A — Pause and fix (preferred)

```bash
NONCE=$(stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- admin_nonce)

stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- pause_contract \
  --nonce "$NONCE"
```

This blocks new streams and withdrawals while preserving all existing stream state. Fix the issue, deploy a new WASM via `upgrade`, then unpause.

### Option B — Upgrade to previous WASM

```bash
# Upload the known-good WASM first
stellar contract upload \
  --wasm path/to/previous/paystream_stream.wasm \
  --source "$SOURCE" \
  --network "$NETWORK"
# Note the returned wasm_hash

NONCE=$(stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- admin_nonce)

stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- upgrade \
  --new_wasm_hash "<WASM_HASH>" \
  --nonce "$NONCE"

# Confirm new WASM is live
stellar contract invoke \
  --id "$STREAM_CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- migrate \
  --admin "$STELLAR_ADMIN_ADDRESS"
```

See [upgrade-guide.md](../upgrade-guide.md) for full upgrade documentation.
