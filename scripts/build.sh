#!/usr/bin/env bash
set -euo pipefail
echo "Building PayStream contracts..."
stellar contract build
echo "Done. WASM files in target/wasm32-unknown-unknown/release/"
