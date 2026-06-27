# Contract Mutation Testing

Mutation testing validates test suite quality by introducing small code changes ("mutants") and verifying that tests catch them. A surviving mutant means a test gap.

## Tool

[cargo-mutants](https://mutants.rs/) — zero-config Rust mutation testing.

## Quick Start

```bash
# Install (once)
cargo install cargo-mutants

# Run against stream contract (from repo root)
bash tests/mutation/run_mutation_tests.sh
```

Results are written to `mutants.out/` in the repo root.

## Configuration

`mutation_config.toml` controls:
- **timeout** — seconds per mutant test run (default: 60)
- **jobs** — parallel workers
- **minimum_test_coverage** — required kill rate % (failing threshold)
- **[[file]]** — source files under mutation

Targets: `contracts/stream/src/lib.rs`, `storage.rs`, `validate.rs`, `events.rs`.

## Interpreting Results

| Outcome | Meaning |
|---|---|
| **Caught** | Mutant killed by a test — good |
| **Missed** | Mutant survived — test gap, write a test |
| **Timeout** | Test hung — investigate infinite loop risk |
| **Unviable** | Mutant did not compile — ignored |

`cargo-mutants` exits non-zero if any mutants are missed, making it CI-friendly.

Summary report: `mutants.out/caught.txt`, `mutants.out/missed.txt`.

## Thresholds

The CI workflow fails if the **missed mutant rate** exceeds 20% (i.e., kill rate < 80%).

## CI

`.github/workflows/mutation-testing.yml` runs weekly on `main` and on PRs that touch `contracts/stream/src/**`. Results are posted as a PR comment.
