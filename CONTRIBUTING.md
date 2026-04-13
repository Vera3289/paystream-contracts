# Contributing to PayStream

Thank you for contributing! PayStream is part of the Stellar open-source ecosystem.

## Getting Started

```bash
git clone https://github.com/Vera3289/paystream-contracts.git
cd paystream-contracts
rustup target add wasm32-unknown-unknown
make test
```

## Workflow

- Branch from `main`: `git checkout -b feat/your-feature`
- Run `make fmt-check && make lint && make test` before pushing
- Open a PR against `main`

## Standards

- All code must pass `cargo clippy -- -D warnings` and `cargo fmt --check`
- Every new contract function needs a test in `test.rs`
- Emit events for all state-changing operations
- No floating-point — all amounts use `i128`
- `#![no_std]` — no standard library in contract code

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add top-up function to stream contract
fix: cap claimable at remaining deposit
test: add stop_time boundary test
docs: update deployment guide
```

## PR Checklist

- [ ] `make test` passes
- [ ] `make lint` passes
- [ ] `make fmt-check` passes
- [ ] Events emitted for state changes
- [ ] README updated if behaviour changed

## Glossary

| Term | Meaning |
|---|---|
| Stream | A salary stream from employer to employee |
| Deposit | Funds locked by employer at stream creation |
| Rate | Tokens released per second to the employee |
| Claimable | Tokens earned but not yet withdrawn |
| Stop time | Optional hard end timestamp for the stream |

## License

Apache 2.0 — contributions are licensed under the same terms.
