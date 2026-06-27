# User Onboarding Guide

Welcome to **PayStream** — real-time salary streaming on Stellar. This guide walks you through everything from understanding core concepts to managing your first payment stream.

---

## Glossary

| Term | Definition |
|------|------------|
| **Stream** | An on-chain arrangement where an employer continuously transfers salary to an employee per second |
| **Deposit** | The total amount of tokens an employer locks into a stream upfront |
| **Rate per second** | How many tokens the employee earns each second |
| **Claimable** | The amount of tokens an employee can withdraw right now |
| **Stop time** | Optional timestamp at which a stream automatically stops accruing |
| **Stream ID** | Unique integer identifier for a stream |
| **Employer** | The Stellar account that creates and funds the stream |
| **Employee** | The Stellar account that receives streamed salary |
| **Token contract** | The fungible token used as payment currency |
| **Soroban** | Stellar's smart contract platform |
| **Testnet** | Stellar's public test network — free to use, no real value |
| **Mainnet** | Stellar's live production network — real value |

---

## Getting Started

### What you need

- A Stellar wallet (e.g., [Freighter](https://www.freighter.app/))
- Some XLM for transaction fees (~0.01 XLM per transaction)
- Payment tokens (the token your employer configured for your stream)
- Stellar CLI (for command-line users): `cargo install --locked stellar-cli --features opt`

### Network selection

All examples below use **Testnet** for safety. Replace `--network testnet` with `--network mainnet` for production.

Get a free Testnet account and tokens at [Stellar Laboratory](https://laboratory.stellar.org/).

---

## Tutorial: Create Your First Stream (Employer)

This tutorial creates a stream paying an employee 1 token per second for 1 hour.

### Step 1 — Deploy and initialize contracts

If you have not deployed yet, follow the [Development Environment Setup](dev-environment-setup.md) guide. You will need your `STREAM_CONTRACT_ID` and `TOKEN_CONTRACT_ID`.

```bash
source .env.staging   # or .env with your contract IDs and keys
```

### Step 2 — Mint tokens to your employer account

```bash
stellar contract invoke \
  --id $TOKEN_CONTRACT_ID \
  --network testnet \
  --source-account $STELLAR_ADMIN_ADDRESS \
  -- mint \
  --to $EMPLOYER_ADDRESS \
  --amount 10000
```

### Step 3 — Create the stream

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  --source-account $EMPLOYER_ADDRESS \
  -- create_stream \
  --employer $EMPLOYER_ADDRESS \
  --employee $EMPLOYEE_ADDRESS \
  --token $TOKEN_CONTRACT_ID \
  --deposit 3600 \
  --rate_per_second 1 \
  --stop_time null
```

**Output:** a `stream_id` (e.g., `1`). Save this — you will use it for all future operations on this stream.

### Step 4 — Verify the stream was created

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  -- get_stream --stream_id 1
```

Expected output includes `status: Active`, `deposit: 3600`, `rate_per_second: 1`.

---

## Tutorial: Withdraw Earnings (Employee)

### Check what you can claim now

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  -- claimable --stream_id 1
```

### Withdraw all claimable earnings

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  --source-account $EMPLOYEE_ADDRESS \
  -- withdraw \
  --employee $EMPLOYEE_ADDRESS \
  --stream_id 1
```

You can run `withdraw` as many times as you like — each call pays out everything accrued since your last withdrawal.

---

## Stream Management Guide (Employer)

### Top up a stream

Add more funds to an active stream so it does not exhaust:

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  --source-account $EMPLOYER_ADDRESS \
  -- top_up \
  --employer $EMPLOYER_ADDRESS \
  --stream_id 1 \
  --amount 3600
```

### Pause a stream

Stop accrual temporarily (e.g., unpaid leave):

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  --source-account $EMPLOYER_ADDRESS \
  -- pause_stream \
  --employer $EMPLOYER_ADDRESS \
  --stream_id 1
```

No tokens accrue while paused.

### Resume a stream

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  --source-account $EMPLOYER_ADDRESS \
  -- resume_stream \
  --employer $EMPLOYER_ADDRESS \
  --stream_id 1
```

### Cancel a stream

Pays the employee all earned tokens to date and refunds the unearned remainder to the employer:

```bash
stellar contract invoke \
  --id $STREAM_CONTRACT_ID \
  --network testnet \
  --source-account $EMPLOYER_ADDRESS \
  -- cancel_stream \
  --employer $EMPLOYER_ADDRESS \
  --stream_id 1
```

### Stream status lifecycle

```
Active → Paused → Active
Active → Cancelled
Active → Exhausted  (deposit fully streamed)
```

---

## Troubleshooting

### "Unauthorized" error on withdraw

**Cause:** You are calling `withdraw` from a different account than the `employee` address in the stream.

**Fix:** Ensure `--source-account` matches the `employee` address you used in `create_stream`.

---

### "Unauthorized" error on pause/cancel

**Cause:** Only the employer can pause, resume, top-up, or cancel a stream.

**Fix:** Use `--source-account $EMPLOYER_ADDRESS`.

---

### Claimable returns 0 right after creation

**Cause:** The stream just started; very few seconds have elapsed.

**Fix:** Wait a moment and query again. At 1 token/second, after 60 seconds you can claim 60 tokens.

---

### Stream status is "Exhausted"

**Cause:** All deposited tokens have been streamed to the employee.

**Fix:** The employer can no longer `top_up` an exhausted stream. Create a new stream.

---

### Transaction fails with "insufficient balance"

**Cause:** Employer does not have enough tokens to cover the deposit.

**Fix:** Mint or transfer tokens to the employer account before calling `create_stream`.

---

### "Entry not found" or "contract not initialized"

**Cause:** Querying a stream ID that does not exist, or the contract was not initialized.

**Fix:** Run `stream_count` to see how many streams exist. Ensure `initialize(admin)` was called after deployment.

```bash
stellar contract invoke --id $STREAM_CONTRACT_ID --network testnet -- stream_count
```

---

## Video Tutorials

> Video walkthroughs are planned for the following topics. Links will be updated as they are published.

| Topic | Link |
|-------|------|
| Setting up a Stellar wallet and getting Testnet tokens | _coming soon_ |
| Deploying PayStream contracts to Testnet | _coming soon_ |
| Creating your first salary stream | _coming soon_ |
| Withdrawing earnings as an employee | _coming soon_ |
| Pausing, resuming, and cancelling streams | _coming soon_ |
| Upgrading contracts on Mainnet | _coming soon_ |

To request a specific tutorial topic, open an issue with the label `documentation`.
