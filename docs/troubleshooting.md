# Troubleshooting Guide

This guide covers common errors, debugging techniques, and recovery procedures for PayStream contract operations.

---

## Table of Contents

1. [Common Error Codes](#common-error-codes)
2. [FAQ](#faq)
3. [Known Issues](#known-issues)
4. [Recovery Procedures](#recovery-procedures)
5. [Debug Logging](#debug-logging)
6. [Performance Troubleshooting](#performance-troubleshooting)
7. [Support](#support)

---

## Common Error Codes

### Contract Errors

| Error Code | Cause | Resolution |
|---|---|---|
| `AlreadyInitialized` | `initialize()` called on a contract that already has an admin set | Deploy a new contract instance; initialization is a one-time operation |
| `Unauthorized` | The signing account does not match the required role (employer/employee/admin) | Ensure you are signing with the correct keypair for the operation |
| `StreamNotFound` | The `stream_id` passed does not exist in contract storage | Verify the stream ID; use `stream_count()` to check valid range |
| `InvalidState` | Operation is not valid for the stream's current status | Check stream status with `get_stream()`; see state machine below |
| `NothingToWithdraw` | Claimable balance is zero at time of call | Wait for time to elapse, or verify the stream is `Active` and not fully exhausted |
| `InsufficientDeposit` | Deposit is less than one second of streaming at the given rate | Increase `deposit` or decrease `rate_per_second` |
| `InvalidStopTime` | `stop_time` is in the past or before `start_time` | Provide a future Unix timestamp |
| `ZeroRate` | `rate_per_second` is zero | Provide a positive streaming rate |

### State Machine Quick Reference

```
Active    → can: withdraw, top_up, pause, cancel
Paused    → can: resume, cancel
Cancelled → terminal state, no further operations
Exhausted → terminal state (deposit fully streamed), employee can still withdraw remainder
```

### Stellar / Soroban Network Errors

| Error | Cause | Resolution |
|---|---|---|
| `txInsufficientFee` | Fee too low for network conditions | Increase base fee; try `--fee 10000` with Stellar CLI |
| `txBadSeq` | Transaction sequence number is stale | Reload the account and rebuild the transaction |
| `opNoAccount` | Source account does not exist on the ledger | Fund the account first (testnet: use [Stellar Friendbot](https://friendbot.stellar.org)) |
| `HOST_OBJECT_NO_SUCH_OBJECT` | Contract ID does not exist | Verify the contract ID is correct for the active network |
| `ExceededLimit` | Transaction exceeded Soroban resource limits | Reduce batch size for `create_streams_batch`, or increase resource budget |
| `opInnerTransactionFailed` | Inner Soroban operation failed | Check `resultXdr` for the inner contract error code |

---

## FAQ

**Q: My `withdraw` call succeeded but the employee received 0 tokens. Why?**

The claimable amount is calculated at the moment of the transaction. If the stream was just created or just resumed, the elapsed time may be very small (sub-second). Wait at least one second and retry. Also check that the stream status is `Active`.

---

**Q: Can the employer reclaim tokens from an active stream?**

Only via `cancel_stream`. Cancellation pays the employee their earned share (all claimable up to the moment of cancellation) and refunds the remainder to the employer. There is no mechanism to reclaim tokens from an active stream without cancellation.

---

**Q: What happens when the deposit runs out?**

The stream transitions to `Exhausted`. The employee can still call `withdraw` to collect any remaining tokens that have not been withdrawn yet, but no new balance accrues. To continue streaming, the employer must cancel and create a new stream with a fresh deposit.

---

**Q: `create_streams_batch` reverted — did any streams get created?**

No. `create_streams_batch` is atomic — either all streams are created or none are. Check the error in the transaction result and fix the invalid parameters before retrying.

---

**Q: I get `Unauthorized` when calling `top_up`. What's wrong?**

`top_up` must be called by the same address that was set as `employer` when the stream was created. Verify you are signing with the employer keypair, not the admin or another account.

---

**Q: How do I find all streams for a given employer/employee?**

The contract does not maintain an index by address. You need to iterate from `0` to `stream_count() - 1` and filter by `get_stream(id).employer` or `.employee`. For production use, index stream creation events off-chain.

---

**Q: Can I use any token?**

Any [SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) compliant token. The token contract must implement `transfer` and `transfer_from`. USDC on Stellar is SEP-41 compliant.

---

## Known Issues

| ID | Description | Status | Workaround |
|---|---|---|---|
| KI-001 | `claimable()` query result may differ slightly from actual `withdraw` amount if called in the same ledger close | Known / by design | The difference is at most `rate_per_second` tokens; ignore or query after settlement |
| KI-002 | `create_streams_batch` gas cost grows linearly with batch size; very large batches (>50 streams) may hit Soroban resource limits | Known | Split into multiple batches of ≤50 streams |
| KI-003 | Testnet contract state is wiped on Stellar testnet resets (~quarterly) | Known | Re-deploy contracts after each testnet reset using `./scripts/deploy-testnet.sh` |

---

## Recovery Procedures

### Stream stuck in Paused state

If an employer loses access to their keypair after pausing a stream:

1. Contact the PayStream admin (set during `initialize`)
2. The admin can cancel the stream and arrange off-chain settlement
3. There is no on-chain forced-resume by a third party

### Deposit exhausted unexpectedly

If a stream reaches `Exhausted` before expected:

1. Call `get_stream(stream_id)` to check `deposit`, `withdrawn`, and `rate_per_second`
2. Verify the rate was set correctly — `deposit / rate_per_second` gives the total streaming seconds
3. Cancel the exhausted stream and create a new one with a larger deposit

### Wrong employee address

If a stream was created with the wrong employee address:

1. Call `cancel_stream` — the claimable amount goes to the originally specified employee address
2. Arrange off-chain recovery with the unintended recipient
3. Create a new stream with the correct employee address

### Accidental cancellation

Cancellation is irreversible. The employee receives their earned share and the employer receives the remainder automatically. Create a new stream if streaming should continue.

---

## Debug Logging

### Enable Soroban diagnostic events

Diagnostic events give detailed contract execution traces. Enable them on testnet:

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --source $EMPLOYER_SECRET \
  --network testnet \
  --diagnostic-events \
  -- get_stream --stream_id 42
```

### Decode transaction result XDR

If a transaction fails, inspect the raw result:

```bash
stellar tx result <TX_HASH> --network testnet
```

For human-readable output:

```bash
stellar tx result <TX_HASH> --network testnet | stellar xdr decode --type TransactionResult
```

### Inspect contract storage

Read raw contract state:

```bash
stellar contract read \
  --id $STREAM_CONTRACT_ID \
  --network testnet
```

### Common diagnostic patterns

**Check if stream exists:**
```bash
stellar contract invoke --id $STREAM_CONTRACT_ID --network testnet -- get_stream --stream_id 0
# Error: StreamNotFound → stream doesn't exist yet
```

**Check claimable balance:**
```bash
stellar contract invoke --id $STREAM_CONTRACT_ID --network testnet -- claimable --stream_id 42
```

**Check total streams:**
```bash
stellar contract invoke --id $STREAM_CONTRACT_ID --network testnet -- stream_count
```

---

## Performance Troubleshooting

### Transaction fees are high

- Use `create_streams_batch` instead of N individual `create_stream` calls — one base fee vs N
- Set `stop_time` on streams that have a known end date to avoid unnecessary state reads
- Batch `withdraw` calls — call once per period rather than multiple times per day

### Contract invocations are slow

Soroban execution time is bounded by the Stellar ledger close interval (~5–6 seconds on mainnet). There is no contract-level optimization available for latency. For time-sensitive applications:

- Pre-sign transactions and submit them as close to the desired ledger as possible
- Use `fee_bump` transactions to reprioritize if a transaction is stuck in the queue

### `create_streams_batch` hitting resource limits

Soroban imposes per-transaction limits on CPU instructions, read/write bytes, and events. For large batches:

1. Start with a batch of 10 and measure resource consumption
2. Increase batch size until you approach the limit (visible in diagnostic events)
3. Keep a safety margin of ~20% below the limit

Current tested safe batch size: **≤50 streams per transaction** (see [KI-002](#known-issues)).

---

## Support

| Channel | Use For |
|---|---|
| [GitHub Issues](https://github.com/Vera3289/paystream-contracts/issues) | Bug reports, feature requests |
| [GitHub Discussions](https://github.com/Vera3289/paystream-contracts/discussions) | Questions, ideas, community support |
| `security@paystream.example` | Vulnerability disclosures — **not** public issues |

When filing a bug report, please include:
- Network (testnet / mainnet / local)
- Contract ID
- Transaction hash (if applicable)
- Full error message or result XDR
- Steps to reproduce
