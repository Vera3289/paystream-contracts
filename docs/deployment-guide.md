# Deployment Guide

## Prerequisites
- Install Node.js 18+ and npm
- Prepare a Stellar network account and funding for deployment
- Configure environment variables for local, testnet, and mainnet
- Ensure access to your secret management provider

## Local deployment
1. Copy the example environment file and fill in the required values.
2. Run `npm install`.
3. Start the API with `npm start`.
4. Verify the health endpoint at `/health`.

## Testnet deployment
1. Set `APP_ENV=testnet`.
2. Export the required network-specific variables.
3. Run the deployment script and verify the contract addresses.
4. Perform smoke tests against the deployed API.

## Mainnet deployment
1. Set `APP_ENV=production`.
2. Use production-grade secrets and restricted access controls.
3. Deploy using the approved release process.
4. Validate all health checks, metrics, and rollback readiness.

## Rollback
- Revert to the previous deployment artifact.
- Restore the previously active environment variables.
- Re-run health checks and smoke tests.

## Post-deployment checklist
- Confirm `/health` and `/ready` return success.
- Check logs and metrics for unexpected errors.
- Ensure secrets were loaded from the configured source.
