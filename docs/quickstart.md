# PayStream Developer Quickstart

Get from zero to a running local salary stream in under 30 minutes.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | latest stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Stellar CLI | ≥ 22.0 | [docs.stellar.org/tools/developer-tools/cli/stellar-cli](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| Docker (optional) | any | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |

---

## 1. Clone and set up

```bash
git clone https://github.com/Vera3289/paystream-contracts.git
cd paystream-contracts
rustup target add wasm32-unknown-unknown
```

---

## 2. Build the contracts

```bash
make build
# or: stellar contract build
```

Compiled WASM files land in `target/wasm32v1-none/release/`.

---

## 3. Run the test suite

```bash
make test
# or: cargo test
```

All tests should pass. If you see a compile error, make sure you have the `wasm32-unknown-unknown` target installed (step 1).

---

## 4. Start a local Stellar node

```bash
stellar network start local
```

This spins up a local Stellar node with a funded test account. Keep this terminal open.

---

## 5. Generate test accounts

Open a new terminal:

```bash
# Create employer and employee key pairs
stellar keys generate employer --network local
stellar keys generate employee --network local

# Fund them from the local friendbot
stellar keys fund employer --network local
stellar keys fund employee --network local

# Export addresses for use in later commands
EMPLOYER=$(stellar keys address employer)
EMPLOYEE=$(stellar keys address employee)
echo "Employer: $EMPLOYER"
echo "Employee: $EMPLOYEE"
```

---

## 6. Deploy the token contract

```bash
TOKEN_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/paystream_token.wasm \
  --source employer \
  --network local)
echo "Token contract: $TOKEN_ID"

# Initialize the token (mint 1 000 000 tokens to employer)
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source employer \
  --network local \
  -- initialize \
  --admin "$EMPLOYER" \
  --supply 1000000
```

---

## 7. Deploy the stream contract

```bash
STREAM_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/paystream_stream.wasm \
  --source employer \
  --network local)
echo "Stream contract: $STREAM_ID"

# Set the admin
stellar contract invoke \
  --id "$STREAM_ID" \
  --source employer \
  --network local \
  -- initialize \
  --admin "$EMPLOYER"
```

---

## 8. Approve the stream contract to spend tokens

The stream contract pulls the deposit from the employer's token balance on `create_stream`. Approve it first:

```bash
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source employer \
  --network local \
  -- approve \
  --from "$EMPLOYER" \
  --spender "$STREAM_ID" \
  --amount 10000 \
  --expiration_ledger 999999
```

---

## 9. Create a stream

Stream 1 token per second to the employee, depositing 3 600 tokens (1 hour of pay):

```bash
NOW=$(stellar ledger timestamp --network local)
stellar contract invoke \
  --id "$STREAM_ID" \
  --source employer \
  --network local \
  -- create_stream \
  --employer "$EMPLOYER" \
  --employee "$EMPLOYEE" \
  --token_address "$TOKEN_ID" \
  --deposit 3600 \
  --rate_per_second 1 \
  --stop_time 0 \
  --cooldown_period 0
```

Note the returned stream ID (e.g. `1`). Set it:

```bash
STREAM_ID_NUM=1
```

---

## 10. Check claimable balance

Wait a few seconds, then query how much the employee can withdraw:

```bash
stellar contract invoke \
  --id "$STREAM_ID" \
  --network local \
  -- claimable \
  --stream_id "$STREAM_ID_NUM"
```

---

## 11. Withdraw earnings

```bash
stellar contract invoke \
  --id "$STREAM_ID" \
  --source employee \
  --network local \
  -- withdraw \
  --employee "$EMPLOYEE" \
  --stream_id "$STREAM_ID_NUM"
```

The employee's token balance increases by the claimable amount.

---

## 12. Inspect stream state

```bash
stellar contract invoke \
  --id "$STREAM_ID" \
  --network local \
  -- get_stream \
  --stream_id "$STREAM_ID_NUM"
```

---

## Docker alternative (no local Rust/Stellar CLI required)

If you prefer not to install Rust or the Stellar CLI locally:

```bash
# Run all tests
docker compose run --rm test

# Build contracts only
docker compose run --rm build stellar contract build
```

---

## Next steps

- [API Reference](api-reference.md) — full parameter and error documentation
- [Testnet deployment](testnet.md) — deploy to Stellar testnet
- [FAQ](faq.md) — common integration questions
- [Frontend integration guide](integration/frontend.md) — TypeScript SDK examples
