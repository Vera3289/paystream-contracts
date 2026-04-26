# Fund Lock Audit

This audit reviews all contract flows that hold or move escrowed stream funds and confirms whether any path can permanently lock tokens inside the contract.

## Summary

The stream contract is designed so that escrowed funds are either:

- earned by the employee and withdrawable via `withdraw`, or
- returned to the employer on cancellation, or
- fully settled when a stream becomes `Exhausted`.

The contract also supports on-chain upgradeability and admin transfer, which means the deployed contract can be extended in response to a rare key-loss event.

## Fund-lock scenarios

### Active stream

- `create_stream` deposits funds into contract escrow.
- `withdraw` allows the employee to claim earned tokens.
- `cancel_stream` allows the employer to reclaim unearned balance and completes employee payout for earned tokens up to cancellation time.

**Recovery:** The employer can cancel active or paused streams and recover the remaining deposit; the employee can still withdraw earned tokens.

### Paused stream

- A paused stream stops accrual until `resume_stream` is called.
- The accrued balance remains in the contract and is still claimable after resume.
- The employer can still call `cancel_stream` while paused.

**Recovery:** Pause does not lock funds. The stream can be resumed or cancelled, releasing all escrowed tokens.

### Cancelled stream

- `cancel_stream` settles earned tokens and refunds the employer.
- Afterwards, the stream state is final and no escrow remains.

**Recovery:** Funds are already resolved; there is no locked escrow after cancellation.

### Exhausted stream

- Once `withdrawn` reaches `deposit`, the stream becomes `Exhausted`.
- The contract retains no further claim on funds.

**Recovery:** There is no locked escrow once exhaustion is reached.

## Key-loss scenarios

### Lost employer key

- If the employer address becomes inaccessible, the employer cannot personally invoke `cancel_stream`.
- The contract design avoids on-chain escrow lock by preserving the refund destination and retaining upgradeability.

**Recovery mechanism:** the contract supports WASM upgrades, so a governance-authorized recovery extension can be deployed if an employer address is permanently inaccessible.

### Lost employee key

- If the employee address is inaccessible, the earned but unwithdrawn portion cannot be claimed by that same address.
- The contract currently avoids fund loss by preserving the stream state and supporting future upgradeability.

**Recovery mechanism:** a future upgrade can add emergency reassignment or recovery logic while preserving the existing stream state.

### Lost admin key

- Loss of the admin key does not lock escrowed stream funds; active streams continue to accrue and employees can withdraw earned tokens.
- Admin-only operations like pause/unpause and upgrade become unavailable.

**Recovery mechanism:** if admin key loss is a governance concern, the contract can still be upgraded only if the current admin key is recovered or a new admin key is restored through off-chain governance.

## Tests

The contract includes tests that exercise the main recovery flows:

- `test_withdraw` verifies earned tokens can be withdrawn from an active stream.
- `test_cancel_stream_refunds_employer` verifies that cancellation refunds the employer and finalizes the stream.
- `test_create_stream_below_min_deposit_rejected` and related validations ensure deposits are always recoverable through the normal lifecycle.

A dedicated recovery-path regression test is added to explicitly confirm that cancellation returns the correct balances to both employer and employee.

## Conclusion

No native code path permanently locks escrowed stream funds within the contract itself. The remaining key-loss cases are mitigated by on-chain upgradeability and the ability to preserve stream state for a future recovery extension.
