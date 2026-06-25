# PayStream REST API Integration

This document describes the REST API wrapper that provides HTTP access to PayStream smart contracts for teams that cannot use the JavaScript SDK directly.

## Overview

The REST API is implemented as a separate Node.js/Express service that wraps all contract functions, enabling teams to interact with PayStream via standard HTTP requests instead of direct blockchain calls.

## Location

The REST API implementation is located in the parent directory:
```
../paystream-rest-api/
```

## Features

✅ **Complete Contract Coverage**
- All stream contract functions
- All token contract functions  
- Admin and governance operations

✅ **OpenAPI Specification**
- Auto-generated documentation at `/api-docs`
- Interactive Swagger UI
- Complete request/response schemas

✅ **API Key Authentication**
- Secure access via `X-API-Key` header
- Configurable multiple API keys
- Proper error handling for auth failures

✅ **Rate Limiting**
- Configurable request limits
- IP-based protection
- Abuse prevention

## Quick Start

1. Navigate to REST API directory:
```bash
cd ../paystream-rest-api/
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your contract IDs and API keys
```

4. Start the server:
```bash
npm start
```

5. Access API documentation:
```
http://localhost:3000/api-docs
```

## API Endpoints

### Streams
- `POST /api/streams/create` - Create new stream
- `POST /api/streams/create-batch` - Create multiple streams
- `POST /api/streams/{id}/withdraw` - Withdraw earnings
- `POST /api/streams/{id}/top-up` - Add funds
- `POST /api/streams/{id}/pause` - Pause stream
- `POST /api/streams/{id}/resume` - Resume stream
- `POST /api/streams/{id}/cancel` - Cancel stream
- `POST /api/streams/{id}/update-rate` - Update rate
- `GET /api/streams/{id}` - Get stream info
- `GET /api/streams/{id}/claimable` - Get claimable amount
- `GET /api/streams/by-employer/{address}` - Get employer streams
- `GET /api/streams/by-employee/{address}` - Get employee streams
- `GET /api/streams/count` - Get total streams

### Tokens
- `GET /api/tokens/total-supply` - Get total supply
- `GET /api/tokens/balance/{address}` - Get balance
- `POST /api/tokens/transfer` - Transfer tokens
- `POST /api/tokens/approve` - Approve spending
- `POST /api/tokens/mint` - Mint tokens
- `POST /api/tokens/burn` - Burn tokens

### Admin
- `POST /api/admin/initialize` - Initialize contract
- `POST /api/admin/pause-contract` - Pause contract
- `POST /api/admin/set-min-deposit` - Set minimum deposit
- `POST /api/admin/upgrade` - Upgrade contract

### Governance
- `POST /api/governance/propose` - Propose parameter change
- `POST /api/governance/vote` - Vote on proposal
- `GET /api/governance/proposal/{id}` - Get proposal info

## Authentication

All endpoints require an API key:
```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3000/api/streams/count
```

## Example Usage

### Create a Stream
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "employer": "GD5...",
    "employee": "GB7...",
    "token_address": "CC7...",
    "deposit": "1000000",
    "rate_per_second": "100",
    "stop_time": 0,
    "cooldown_period": 0,
    "cliff_time": 0
  }' \
  http://localhost:3000/api/streams/create
```

### Get Stream Information
```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3000/api/streams/1
```

## Deployment

### Docker
```bash
cd ../paystream-rest-api/
docker build -t paystream-api .
docker run -p 3000:3000 --env-file .env paystream-api
```

### Docker Compose
```bash
cd ../paystream-rest-api/
docker-compose up
```

## Security

- API key authentication required for all endpoints
- Rate limiting prevents abuse
- Input validation on all requests
- HTTPS recommended for production

## Support

For REST API issues, see the main repository documentation or create issues in the REST API project.

## Contract Compatibility

The REST API maintains full compatibility with all existing contract functions and does not require any changes to the smart contracts themselves.
