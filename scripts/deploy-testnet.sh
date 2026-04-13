#!/usr/bin/env bash
set -euo pipefail
NETWORK="testnet"
SOURCE="${STELLAR_SOURCE_ACCOUNT:-default}"

echo "Deploying PayStream contracts to Stellar testnet..."

TOKEN_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/paystream_token.wasm \
  --source "$SOURCE" --network "$NETWORK")
echo "Token:  $TOKEN_ID"

STREAM_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/paystream_stream.wasm \
  --source "$SOURCE" --network "$NETWORK")
echo "Stream: $STREAM_ID"

echo ""
echo "Save these for init-testnet.sh:"
echo "TOKEN_CONTRACT_ID=$TOKEN_ID"
echo "STREAM_CONTRACT_ID=$STREAM_ID"
