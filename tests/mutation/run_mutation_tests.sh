#!/usr/bin/env bash
# Run cargo-mutants against the stream contract.
# Usage: bash tests/mutation/run_mutation_tests.sh [extra cargo-mutants args]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${REPO_ROOT}/tests/mutation/mutation_config.toml"
THRESHOLD=80

cd "${REPO_ROOT}"

if ! command -v cargo-mutants &>/dev/null; then
    echo "cargo-mutants not found. Install with: cargo install cargo-mutants"
    exit 1
fi

echo "==> Running cargo-mutants (config: ${CONFIG})"
cargo mutants \
    --config "${CONFIG}" \
    --output "${REPO_ROOT}/mutants.out" \
    "$@"

# Parse summary from cargo-mutants output
SUMMARY="${REPO_ROOT}/mutants.out/mutants.json"
if [[ -f "${SUMMARY}" ]]; then
    CAUGHT=$(python3 -c "import json,sys; d=json.load(open('${SUMMARY}')); print(d.get('caught',0))" 2>/dev/null || echo 0)
    MISSED=$(python3 -c "import json,sys; d=json.load(open('${SUMMARY}')); print(d.get('missed',0))" 2>/dev/null || echo 0)
    TOTAL=$(( CAUGHT + MISSED ))
    if [[ "${TOTAL}" -gt 0 ]]; then
        KILL_RATE=$(( CAUGHT * 100 / TOTAL ))
        echo ""
        echo "==> Mutation score: ${KILL_RATE}% (caught ${CAUGHT}/${TOTAL})"
        if [[ "${KILL_RATE}" -lt "${THRESHOLD}" ]]; then
            echo "ERROR: Kill rate ${KILL_RATE}% is below threshold ${THRESHOLD}%"
            echo "Review missed mutants in: ${REPO_ROOT}/mutants.out/missed.txt"
            exit 1
        fi
    fi
fi

echo "==> Done. Full results in: ${REPO_ROOT}/mutants.out/"
