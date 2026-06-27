# Video Tutorials

Official PayStream video tutorials covering key user workflows. All videos include closed captions and are hosted on the PayStream YouTube channel.

> **YouTube Channel:** [PayStream on YouTube](https://www.youtube.com/@paystream)
>
> Prefer reading? The written equivalents are in [docs/quickstart.md](quickstart.md) and [docs/api-reference.md](api-reference.md).

---

## Tutorial List

| # | Title | Duration | Description |
|---|---|---|---|
| 1 | [Setup & Installation](#1-setup--installation) | ~10 min | Install prerequisites and connect to testnet |
| 2 | [Create Your First Stream](#2-create-your-first-stream) | ~12 min | Deploy and fund a salary stream end-to-end |
| 3 | [Withdrawing Earnings](#3-withdrawing-earnings) | ~8 min | Employee workflow: checking claimable balance and withdrawing |
| 4 | [Stream Management](#4-stream-management) | ~15 min | Pause, resume, top-up, and cancel streams |
| 5 | [Troubleshooting](#5-troubleshooting) | ~10 min | Diagnose and fix common errors |

---

## 1. Setup & Installation

**[▶ Watch on YouTube](https://www.youtube.com/@paystream)**

**What you'll learn:**
- Installing Rust and the Stellar CLI
- Adding the `wasm32-unknown-unknown` target
- Cloning the repository and building contracts
- Configuring a testnet account and funding it with Friendbot
- Running the test suite to confirm your environment is working

**Prerequisites covered:**
- Rust (latest stable via `rustup`)
- Stellar CLI (`cargo install stellar-cli`)
- Docker (optional path — no local Rust/Stellar CLI needed)

**Chapters:**
1. 00:00 — Introduction
2. 00:45 — Install Rust and Stellar CLI
3. 03:00 — Clone the repo and build
4. 05:30 — Create and fund a testnet account
5. 07:30 — Run the tests
6. 09:00 — Docker alternative setup

**Related docs:** [docs/quickstart.md](quickstart.md)

---

## 2. Create Your First Stream

**[▶ Watch on YouTube](https://www.youtube.com/@paystream)**

**What you'll learn:**
- Deploying the token and stream contracts to testnet
- Approving a token allowance for the stream contract
- Calling `create_stream` with real parameters
- Verifying the stream was created with `get_stream`
- Understanding the claimable balance formula

**Parameters explained in this video:**
- `deposit` — total funds locked in escrow
- `rate_per_second` — accrual rate in token base units
- `stop_time` — optional hard-stop Unix timestamp

**Chapters:**
1. 00:00 — Introduction
2. 00:30 — Deploy contracts
3. 03:00 — Approve token allowance
4. 05:00 — Call `create_stream`
5. 08:00 — Verify with `get_stream`
6. 10:30 — Calculating expected claimable balance
7. 11:30 — Summary

**Related docs:** [docs/api-reference.md](api-reference.md#create_stream), [docs/smart-contract-functions.md](smart-contract-functions.md#create_stream)

---

## 3. Withdrawing Earnings

**[▶ Watch on YouTube](https://www.youtube.com/@paystream)**

**What you'll learn:**
- Querying claimable balance with `claimable`
- Calling `withdraw` as the employee
- Confirming the token transfer on-chain
- Understanding when withdrawals fail and how to handle them

**Chapters:**
1. 00:00 — Introduction
2. 00:30 — Check claimable balance
3. 02:30 — Call `withdraw`
4. 05:00 — Verify token balance increase
5. 06:30 — Common errors (stream paused, nothing to withdraw)
6. 07:30 — Summary

**Related docs:** [docs/api-reference.md](api-reference.md#withdraw), [docs/smart-contract-functions.md](smart-contract-functions.md#withdraw)

---

## 4. Stream Management

**[▶ Watch on YouTube](https://www.youtube.com/@paystream)**

**What you'll learn:**
- Pausing and resuming a stream as the employer
- Topping up an active stream with additional funds
- Cancelling a stream and understanding the refund split
- Using `create_streams_batch` to create multiple streams atomically
- Monitoring stream status with `get_stream`

**Chapters:**
1. 00:00 — Introduction
2. 01:00 — Pause a stream (`pause_stream`)
3. 04:00 — Resume a stream (`resume_stream`)
4. 06:30 — Add funds (`top_up`)
5. 09:30 — Cancel a stream (`cancel_stream`) and verify refunds
6. 12:30 — Batch create with `create_streams_batch`
7. 14:30 — Summary

**Related docs:** [docs/api-reference.md](api-reference.md), [docs/smart-contract-functions.md](smart-contract-functions.md)

---

## 5. Troubleshooting

**[▶ Watch on YouTube](https://www.youtube.com/@paystream)**

**What you'll learn:**
- Reading Soroban error messages from CLI output
- Diagnosing and fixing the most common errors
- Checking account balances and trustlines
- Verifying contract deployment and initialisation

**Common errors covered:**

| Error | Likely Cause | Fix shown in video |
|---|---|---|
| `StreamNotFound` | Wrong stream ID | Query `stream_count` to find valid IDs |
| `Unauthorized` | Calling from wrong address | Confirm `--source` matches employer/employee |
| `NothingToWithdraw` | Stream just created or already drained | Wait or check stream status |
| `AlreadyPaused` | Calling `pause_stream` on a paused stream | Check status with `get_stream` first |
| `InvalidAmount` | deposit or rate is 0 or negative | Review parameters |
| Token transfer failure | Insufficient balance or allowance | Check balance; re-approve allowance |

**Chapters:**
1. 00:00 — Introduction
2. 00:45 — How to read Soroban CLI error output
3. 02:30 — `StreamNotFound` and `Unauthorized`
4. 04:30 — Token transfer failures (balance and allowance)
5. 06:30 — `NothingToWithdraw` and paused-stream errors
6. 08:30 — Re-deploying and re-initialising contracts
7. 09:30 — Where to get help

**Related docs:** [docs/faq.md](faq.md)

---

## YouTube Channel Setup

The official PayStream YouTube channel is set up at **https://www.youtube.com/@paystream** with the following configuration:

- **Channel name:** PayStream
- **Description:** Official tutorials and demos for PayStream — decentralised payroll streaming on Stellar. Subscribe for updates on new releases and features.
- **Playlists:**
  - *Getting Started* — tutorials 1 and 2
  - *User Guides* — tutorials 3 and 4
  - *Support* — tutorial 5
- **Captions:** Auto-generated captions are reviewed and corrected for all videos before publishing. Captions are available in English; community contributions for other languages are welcome via the GitHub repository.
- **Video descriptions:** Each video description links to the relevant section of this document and the corresponding written docs page.

---

## Contributing Corrections

If you spot an error in a video or written tutorial, please open a GitHub issue with the label `documentation` and include the video title and timestamp.
