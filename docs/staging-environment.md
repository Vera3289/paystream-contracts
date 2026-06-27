# Staging Environment

The staging environment mirrors production and is used to validate deployments, run integration tests, and perform data-migration dry-runs before promoting to mainnet.

---

## Infrastructure

| Component | Staging | Production |
|-----------|---------|------------|
| Stellar network | Testnet | Mainnet |
| RPC endpoint | `https://soroban-testnet.stellar.org` | `https://soroban-mainnet.stellar.org` |
| Deployment domain | `staging.paystream.example` | `paystream.example` |
| Contract source | same WASM artifacts as prod | same WASM artifacts as prod |

Staging uses the Stellar **Testnet** — a public, free-to-use network that is reset periodically. It shares no state with Mainnet.

---

## Deployment Process

The staging deployment process is identical to production. The only difference is the target network.

### 1. Build contracts

```bash
make build
```

### 2. Deploy to staging (Testnet)

```bash
export STELLAR_NETWORK=testnet
export STELLAR_RPC_URL=https://soroban-testnet.stellar.org
export STELLAR_ADMIN_ADDRESS=<STAGING_ADMIN_KEY>

./scripts/deploy-testnet.sh
```

### 3. Initialize contracts

```bash
export TOKEN_CONTRACT_ID=<FROM_DEPLOY>
export STREAM_CONTRACT_ID=<FROM_DEPLOY>

./scripts/init-testnet.sh
```

Contract IDs for staging should be recorded in `.env.staging`.

---

## Environment Variables

```bash
# .env.staging
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_ADMIN_ADDRESS=<STAGING_ADMIN_PUBLIC_KEY>
TOKEN_CONTRACT_ID=<STAGING_TOKEN_CONTRACT_ID>
STREAM_CONTRACT_ID=<STAGING_STREAM_CONTRACT_ID>
```

Load before running staging scripts:

```bash
source .env.staging
```

---

## Data Migration Testing

Before applying any data migration or contract upgrade to production:

1. Deploy the new contract version to staging.
2. Run migration scripts against staging state.
3. Verify contract state is consistent using `get_stream` and `claimable` queries.
4. Only promote to mainnet after staging validation passes.

```bash
# Example: verify a stream after migration
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  -- get_stream --stream_id 1
```

---

## Performance Testing

Run load scenarios against staging before production releases:

```bash
# Install k6 (https://k6.io)
k6 run scripts/perf/load-test.js --env RPC_URL=$STELLAR_RPC_URL
```

Key metrics to validate:
- Transaction submission latency < 5 s
- `claimable` query latency < 500 ms
- No ledger errors under sustained stream creation

---

## Cleanup Policies

Stellar Testnet is reset roughly every 3 months. After each reset:

1. Redeploy contracts to Testnet using `./scripts/deploy-testnet.sh`.
2. Update `.env.staging` with new contract IDs.
3. Re-run `./scripts/init-testnet.sh`.

To manually clean up staging contract state (e.g., after a test run), cancel all open test streams via:

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  -- cancel_stream --employer $STAGING_ADMIN_ADDRESS --stream_id <ID>
```

There is no shared staging database beyond on-chain ledger entries, so cleanup is limited to cancelling/expiring streams.
