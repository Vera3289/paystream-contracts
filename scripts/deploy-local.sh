#!/usr/bin/env bash
set -euo pipefail
NETWORK="local"
SOURCE="default"

echo "Deploying PayStream contracts to local network..."

TOKEN_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/paystream_token.wasm \
  --source "$SOURCE" --network "$NETWORK")
echo "Token:  $TOKEN_ID"

STREAM_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/paystream_stream.wasm \
  --source "$SOURCE" --network "$NETWORK")
echo "Stream: $STREAM_ID"

echo "TOKEN_CONTRACT_ID=$TOKEN_ID"
echo "STREAM_CONTRACT_ID=$STREAM_ID"
