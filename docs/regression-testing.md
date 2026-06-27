# Regression Test Suite

## Scope
The regression suite protects the critical stream lifecycle and token transfer flows that should remain stable across future changes.

## Coverage
- stream creation, withdrawal, and lifecycle transitions
- token transfer and balance accounting

## Execution
Run the suite locally with:

```bash
cargo test -p paystream-stream --test regression_suite
```
