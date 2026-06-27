# PayStream Demo App

Minimal React demo showing: connect Freighter wallet, create a stream, view streams with real-time claimable balance, and withdraw.

## Quick start

```bash
cp .env.example .env
# Edit .env and set VITE_CONTRACT_ID to your deployed stream contract ID

npm install
npm start
```

Open http://localhost:5173

## Features

- **Connect wallet** — Freighter browser extension
- **Create stream** — employer locks deposit, sets rate per second
- **View streams** — load any stream by ID, see live claimable balance (polls every 5 s)
- **Withdraw** — employee claims all earned tokens in one click

## Deploy to GitHub Pages

```bash
npm run build
# Push the dist/ folder to gh-pages branch
```

## Environment

| Variable | Description |
|---|---|
| `VITE_CONTRACT_ID` | Deployed PayStream stream contract ID on testnet |
