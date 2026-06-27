# Test Data Fixtures

This folder contains guidance and a small example fixture factory for generating consistent test data across suites.

## Goals
- Provide factory helpers for common domain objects
- Support randomized data with optional seeding for reproducibility
- Offer easy fixtures for common scenarios

## Example usage
- See `factory.js` for a minimal JS factory that supports seeding.
- Import factories in tests and call `factory.user({ seed: 123 })`.

## Next steps
1. Expand factories to cover domain models in `contracts/`.
2. Add TypeScript types if desired.

Document created to address issue #581.
