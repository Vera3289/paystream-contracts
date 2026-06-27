# Security Best Practices

A guide for PayStream users covering wallet security, phishing prevention, credential management, and how to report suspicious activity.

---

## Table of Contents

- [Wallet Security](#wallet-security)
- [Phishing Prevention](#phishing-prevention)
- [Password Best Practices](#password-best-practices)
- [Recovery Key Storage](#recovery-key-storage)
- [Detecting and Reporting Suspicious Activity](#detecting-and-reporting-suspicious-activity)
- [Verified Sources](#verified-sources)
- [Security Contacts](#security-contacts)

---

## Wallet Security

**Use a hardware wallet for significant funds.**
Hardware wallets (Ledger, Trezor) keep your private key offline. Use one if your streams hold more than a small test amount.

**Never share your secret key.**
Your Stellar secret key (starts with `S`) gives full control of your account. No PayStream service, support agent, or third-party tool will ever need it.

**Use dedicated keypairs.**
Create a separate Stellar keypair for PayStream instead of reusing a keypair tied to other assets or services. Limit blast radius if a key is ever compromised.

**Set appropriate trustlines only.**
Only add trustlines for tokens you intentionally use. A rogue trustline cannot move your XLM, but it can expose you to unwanted token transfers.

**Review signers regularly.**
If you use multisig, audit your account signers with:
```bash
stellar account show --address <YOUR_ADDRESS> --network testnet
```
Remove signers you no longer recognise.

**Revoke token allowances when done.**
After finishing a session, revoke any token allowances granted to the stream contract if you no longer need them:
```bash
stellar contract invoke --id $TOKEN_ADDRESS --source $YOUR_KEY --network testnet \
  -- approve --from $YOUR_ADDRESS --spender $STREAM_CONTRACT_ID --amount 0 --expiration_ledger 0
```

---

## Phishing Prevention

**Always verify the URL before connecting your wallet.**
The official PayStream frontend domain is listed in [Verified Sources](#verified-sources). Check for typosquatting (e.g., `paystr3am`, `paystream-app`).

**Check the contract ID before approving any transaction.**
Before signing, confirm the contract address matches the official deployed contract IDs published in [docs/testnet.md](testnet.md) (testnet) or the mainnet release notes.

**Be suspicious of unsolicited contact.**
The PayStream team will never DM you on Discord, Telegram, or Twitter asking you to sign a transaction, share a key, or visit an external link.

**Do not click links in unexpected emails or messages.**
Navigate to the PayStream app directly via bookmarks or the official GitHub repository — never from a link in an email or chat.

**Check transaction details before signing.**
On your hardware wallet or browser wallet confirmation screen, verify:
- The contract being invoked is correct
- The token and amount match what you expect
- You are not signing a `transfer` or `approve` you did not initiate

---

## Password Best Practices

**Use a password manager.**
Store your wallet backup passphrase and any web-app passwords in a reputable password manager (Bitwarden, 1Password, etc.). Do not store them in plain text files or browser notes.

**Use a strong, unique passphrase for wallet encryption.**
If your wallet file is encrypted with a passphrase, use at least 16 characters combining upper/lower case, digits, and symbols. Do not reuse it anywhere else.

**Enable two-factor authentication (2FA).**
Enable 2FA on your email, GitHub account, and any exchange you use to fund your wallet. Use an authenticator app (not SMS).

**Do not auto-save passwords in shared browsers.**
If you access the PayStream UI on a shared or work machine, do not save credentials in the browser.

---

## Recovery Key Storage

**Write your seed phrase on paper — not digitally.**
Your 12/24-word seed phrase should be written on paper (or engraved on metal for durability) and stored offline. Never photograph it, paste it into a notes app, or send it over any messaging platform.

**Store copies in separate physical locations.**
Keep at least two copies of your seed phrase in different secure locations (e.g., home safe + bank safety deposit box) to protect against fire or theft.

**Test your recovery before you need it.**
After writing down your seed phrase, restore the wallet from it on a spare device to confirm it is correct. Do this before moving significant funds.

**Protect against physical access.**
Store paper backups in a locked location. Anyone with physical access to your seed phrase controls your wallet.

**Do not store secret keys in `.env` files committed to version control.**
If you run scripts or automation, use a secrets manager (AWS Secrets Manager, HashiCorp Vault) or environment-level secrets — never hardcoded keys in source files.

---

## Detecting and Reporting Suspicious Activity

### Signs of suspicious activity

- Transactions on your account you did not initiate
- Unexpected token transfers or allowance approvals
- Streams created under your employer address without your knowledge
- Login alerts from unfamiliar locations or devices

### How to check your account activity

```bash
# List recent transactions on your account
stellar transactions --account <YOUR_ADDRESS> --network testnet --limit 20
```

Or use [Stellar Expert](https://stellar.expert/explorer/testnet) to inspect your account history in a browser.

### Immediate steps if you suspect a compromise

1. **Stop using the affected keypair immediately.**
2. **Transfer funds to a new keypair** from a clean device if any remain.
3. **Cancel any active streams** funded by the compromised key using `cancel_stream`.
4. **Revoke all token allowances** granted by the compromised address.
5. **Report to the PayStream security team** (see [Security Contacts](#security-contacts)).

### Reporting suspicious smart contract behaviour

If you observe unexpected contract behaviour (e.g., incorrect claimable amounts, unauthorised state changes), open a report with:
- Your account address
- The stream ID(s) involved
- Transaction hash(es)
- A description of what you expected vs. what occurred

---

## Verified Sources

Only interact with PayStream through these official channels:

| Source | URL / Address |
|---|---|
| GitHub repository | https://github.com/PrincessnJoy/paystream-contracts |
| Testnet stream contract | See [docs/testnet.md](testnet.md) |
| Mainnet stream contract | Published in release notes on GitHub Releases |
| Stellar USDC (testnet) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Stellar USDC (mainnet) | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Circle USDC source | https://developers.circle.com/stablecoins/stellar-usdc |

If a contract address, domain, or social account does not appear in this list, treat it as unverified until confirmed by the team via the official GitHub repository.

---

## Security Contacts

**To report a vulnerability:**
Email `security@paystream.example` with a description, steps to reproduce, and any relevant transaction hashes. Do **not** open a public GitHub issue for security vulnerabilities.

See [SECURITY.md](../SECURITY.md) for the full responsible disclosure policy, including PGP key and expected response SLAs.

**For general security questions:**
Open a discussion in the GitHub repository under the Security category, or reach out via the official Discord server linked in the repository README.
