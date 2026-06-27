# PayStream API Documentation

Welcome to the PayStream smart contract API reference. PayStream is a real-time salary streaming protocol built on Stellar (Soroban).

---

## Contents

- [Authentication](#authentication)
- [Getting Started](#getting-started)
- [Contract Functions](#contract-functions)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Code Examples](#code-examples)
- [Changelog](#changelog)

---

## Authentication

PayStream contracts run on Stellar's Soroban VM. All write operations require a valid Stellar keypair signature.

**Signing a transaction:**

```bash
# Using Stellar CLI
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account <YOUR_SECRET_KEY> \
  --network testnet \
  -- create_stream \
  --employer <EMPLOYER_ADDRESS> \
  --employee <EMPLOYEE_ADDRESS> \
  --token <TOKEN_CONTRACT_ID> \
  --deposit 2592000000000 \
  --rate_per_second 1000000
```

Authentication is handled by the Stellar network — each invocation is signed with your account's secret key. No API keys or JWTs are required.

---

## Getting Started

### 1. Deploy the contract (testnet)

```bash
git clone https://github.com/Vera3289/paystream-contracts.git
cd paystream-contracts
./scripts/build.sh
./scripts/deploy-testnet.sh
```

### 2. Initialize

```bash
stellar contract invoke --id $STREAM_CONTRACT_ID --source $ADMIN_SECRET --network testnet \
  -- initialize --admin $ADMIN_ADDRESS
```

### 3. Create a stream

```bash
stellar contract invoke --id $STREAM_CONTRACT_ID --source $EMPLOYER_SECRET --network testnet \
  -- create_stream \
  --employer $EMPLOYER_ADDRESS \
  --employee $EMPLOYEE_ADDRESS \
  --token $TOKEN_CONTRACT_ID \
  --deposit 2592000000000 \
  --rate_per_second 1000000
```

---

## Contract Functions

See [openapi.yaml](./openapi.yaml) for the full machine-readable spec.

### `initialize(admin)`
Sets the contract admin. Can only be called once.

| Parameter | Type | Description |
|---|---|---|
| `admin` | `Address` | Stellar address of the admin |

---

### `create_stream(employer, employee, token, deposit, rate_per_second, stop_time?)`
Creates a new salary stream and locks the deposit in escrow.

| Parameter | Type | Description |
|---|---|---|
| `employer` | `Address` | Funding party |
| `employee` | `Address` | Recipient |
| `token` | `Address` | SEP-41 token contract |
| `deposit` | `i128` | Total tokens to escrow |
| `rate_per_second` | `i128` | Tokens streamed per second |
| `stop_time` | `Option<u64>` | Optional hard stop timestamp |

Returns: `stream_id: u64`

---

### `create_streams_batch(employer, params)`
Creates multiple streams atomically. All succeed or all revert.

Returns: `Vec<u64>` (list of stream IDs)

---

### `withdraw(employee, stream_id)`
Transfers all currently claimable tokens to the employee.

Claimable formula:
```
claimable = min(
    (now - last_withdraw_time) * rate_per_second,
    deposit - withdrawn
)
```
Time is capped at `stop_time` if set. Paused intervals are excluded.

---

### `top_up(employer, stream_id, amount)`
Adds more tokens to an active stream's escrow balance.

---

### `pause_stream(employer, stream_id)`
Pauses accrual. Elapsed time while paused does not accumulate claimable balance.

---

### `resume_stream(employer, stream_id)`
Resumes a paused stream.

---

### `cancel_stream(employer, stream_id)`
Cancels the stream: pays the employee their earned share and refunds the remainder to the employer.

---

### `get_stream(stream_id)` → `Stream`
Returns the full stream state object.

### `claimable(stream_id)` → `i128`
Returns the amount the employee can withdraw right now.

### `stream_count()` → `u64`
Returns total number of streams ever created.

---

## Error Codes

| Code | Description | Resolution |
|---|---|---|
| `AlreadyInitialized` | `initialize` called more than once | Deploy a fresh contract instance |
| `Unauthorized` | Caller is not the expected party | Use the correct keypair (employer/employee/admin) |
| `StreamNotFound` | `stream_id` does not exist | Verify the stream ID |
| `InvalidState` | Operation not valid for current stream status | Check stream status with `get_stream` |
| `NothingToWithdraw` | Claimable balance is zero | Wait for time to elapse or check stream is active |
| `InsufficientDeposit` | Deposit too small for at least one second of streaming | Increase `deposit` or decrease `rate_per_second` |
| `InvalidStopTime` | `stop_time` is in the past | Provide a future Unix timestamp |

---

## Rate Limiting

PayStream contracts are on-chain — rate limits are governed by **Stellar network fees**, not an application layer.

- Each transaction costs a small [Stellar fee](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering)
- Soroban resource limits apply per transaction (instructions, read/write bytes)
- For bulk operations, prefer `create_streams_batch` over N individual `create_stream` calls

There are no application-level rate limits.

---

## Code Examples

### JavaScript (stellar-sdk)

```js
import { Contract, SorobanRpc, TransactionBuilder, Networks, Keypair, nativeToScVal } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const keypair = Keypair.fromSecret(process.env.EMPLOYER_SECRET);
const contract = new Contract(process.env.STREAM_CONTRACT_ID);

const account = await server.getAccount(keypair.publicKey());
const tx = new TransactionBuilder(account, { fee: '1000', networkPassphrase: Networks.TESTNET })
  .addOperation(contract.call('create_stream',
    nativeToScVal(keypair.publicKey(), { type: 'address' }),  // employer
    nativeToScVal(process.env.EMPLOYEE_ADDRESS, { type: 'address' }),
    nativeToScVal(process.env.TOKEN_CONTRACT_ID, { type: 'address' }),
    nativeToScVal(2592000000000n, { type: 'i128' }),           // deposit
    nativeToScVal(1000000n, { type: 'i128' }),                 // rate_per_second
  ))
  .setTimeout(30)
  .build();

const prepared = await server.prepareTransaction(tx);
prepared.sign(keypair);
const result = await server.sendTransaction(prepared);
console.log('Stream ID:', result);
```

### Python (stellar-sdk)

```python
from stellar_sdk import Keypair, Network, SorobanServer, TransactionBuilder
from stellar_sdk.soroban_rpc import SendTransactionStatus

server = SorobanServer("https://soroban-testnet.stellar.org")
keypair = Keypair.from_secret(os.environ["EMPLOYER_SECRET"])
account = server.load_account(keypair.public_key)

tx = (
    TransactionBuilder(account, network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE, base_fee=1000)
    .append_invoke_contract_function_op(
        contract_id=os.environ["STREAM_CONTRACT_ID"],
        function_name="create_stream",
        parameters=[
            # employer, employee, token, deposit, rate_per_second
        ],
    )
    .set_timeout(30)
    .build()
)
tx = server.prepare_transaction(tx)
tx.sign(keypair)
response = server.send_transaction(tx)
print("Status:", response.status)
```

### Rust

```rust
use soroban_sdk::{Address, Env};

// Within a Soroban test or integration context:
let stream_id = client.create_stream(
    &employer,
    &employee,
    &token,
    &2_592_000_000_000_i128,
    &1_000_000_i128,
    &None,
);
```

---

## Changelog

See [upgrade-guide.md](./upgrade-guide.md) for migration instructions between versions.

### v1.0.0
- Initial release: `create_stream`, `withdraw`, `top_up`, `pause_stream`, `resume_stream`, `cancel_stream`
- Batch stream creation via `create_streams_batch`
- SEP-41 multi-token support
