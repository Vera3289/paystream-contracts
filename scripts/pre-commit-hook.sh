#!/usr/bin/env bash
# Pre-commit hook: scan staged files for secrets with gitleaks.
# Install: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -euo pipefail

if ! command -v gitleaks &>/dev/null; then
  echo "gitleaks not found — skipping secret scan (install from https://github.com/gitleaks/gitleaks/releases)"
  exit 0
fi

gitleaks protect --staged --config .gitleaks.toml --redact
