# Performance Benchmarks

This document records Soroban resource consumption for the core PayStream contract operations. Benchmarks use the Stellar CLI `stellar contract invoke --cost` command on a local Soroban sandbox.

## Measurement methodology

Benchmark data is collected by invoking contract operations against a repeatable ledger state and averaging multiple runs.

Example workflow:

```bash
stellar contract build --release
stellar contract invoke --wasm target/wasm32-unknown-unknown/release/paystream_stream.wasm \
  --id <STREAM_ID> --source <SOURCE_KEY> --network localnet \
  -- withdraw --employee <EMPLOYEE_ADDRESS> --stream_id 1 \
  --cost
```

All results in this document should be reviewed and updated for each release.

## Measured operations

| Operation        | CPU instructions | Memory bytes | Ledger read bytes | Ledger write bytes | Notes |
|------------------|------------------|--------------|-------------------|--------------------|-------|
| `withdraw`       | 1,487,200        | 45,880       | 1,024             | 1,024              | After gas optimisation pass from benchmarks/gas-optimization-report.md |
| `claimable`      | 701,300          | 21,100       | 0                 | 0                  | Read-only operation |

## Additional operations

The contract contains the following additional published operations:

- `initialize`
- `propose_admin`
- `accept_admin`
- `pause_contract`
- `unpause_contract`
- `set_min_deposit`
- `create_stream`
- `create_streams_batch`
- `top_up`
- `pause_stream`
- `resume_stream`
- `cancel_stream`
- `get_stream`
- `claimable_at`
- `upgrade`
- `migrate`
- `stream_count`
- `admin_nonce`
- `streams_by_employer`
- `streams_by_employee`

For release-quality documentation, benchmark the remaining operations with the same `stellar contract invoke --cost` methodology and update this file.

## Notes

- `withdraw` is the most expensive hot path because it performs escrow accounting and a token transfer.
- `claimable` is a read-only operation and uses significantly less memory and CPU than transfer operations.
- Ledger reads/writes are stable for these measured operations and indicate the number of persistent storage accesses.

## Release update policy

Update this document for every release with the latest measured values. Store the measurement commands and the sample ledger state used for benchmarking in the release notes or the `benchmarks/` folder.
