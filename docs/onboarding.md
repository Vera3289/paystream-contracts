# Contributor Onboarding Guide

Welcome to PayStream Contracts. This guide helps first-time contributors go from clone to first pull request quickly.

## 1. Choose a Setup Path

Pick one of these paths:

- Native toolchain: follow `CONTRIBUTING.md` for macOS/Linux/WSL.
- Docker-only: use `docker compose` commands with no local Rust install.

If you are unsure, use Docker first to avoid environment issues.

## 2. Fork, Clone, and Configure Remotes

```bash
git clone https://github.com/<your-username>/paystream-contracts.git
cd paystream-contracts
git remote add upstream https://github.com/Vera3289/paystream-contracts.git
git fetch upstream
git checkout -b docs/my-change upstream/main
```

Remote convention:

- `origin` points to your fork.
- `upstream` points to `Vera3289/paystream-contracts`.

## 3. Verify Your Environment

Run the baseline checks:

```bash
make fmt-check
make lint
make test
```

For Docker:

```bash
docker compose run --rm test
```

## 4. Understand the Repo Layout

- `contracts/stream`: core salary-streaming contract.
- `contracts/token`: SEP-41 token contract used by tests.
- `docs/`: protocol, architecture, and integration docs.
- `scripts/`: deploy and init helpers.

Read these first:

- `README.md`
- `CONTRIBUTING.md`
- `docs/quickstart.md`
- `docs/api-reference.md`

## 5. Pick an Issue and Create a Focused Branch

Branch naming:

- `fix/<short-topic>-<issue-number>`
- `feat/<short-topic>-<issue-number>`
- `docs/<short-topic>-<issue-number>`

Keep each pull request scoped to one problem (or one tightly related pair of changes).

## 6. Make Changes Safely

- Prefer small commits.
- Add tests for behavior changes.
- Update docs when public behavior changes.
- Avoid unrelated refactors in the same PR.

## 7. Open a Pull Request

Before opening:

```bash
make fmt-check
make lint
make test
```

PR description checklist:

- Start with `Closes #<issue-number>` when appropriate.
- Summarize what changed and why.
- Include test commands and outcomes.

## 8. Work with Review Feedback

- Push updates to the same branch.
- Re-run relevant checks.
- Keep discussion clear and respectful.

Thanks for contributing to PayStream.
