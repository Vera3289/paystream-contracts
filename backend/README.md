# PayStream Backend

Off-chain backend services for PayStream.

## Modules

### Notification Preferences (`src/notifications.rs`)

CRUD API for employer notification preferences.

#### Endpoints (to be wired into your HTTP framework)

| Method | Path | Description |
|---|---|---|
| `POST` | `/employers/:address/notifications` | Create a preference |
| `GET` | `/employers/:address/notifications` | List preferences |
| `GET` | `/employers/:address/notifications/:id` | Get a preference |
| `PUT` | `/employers/:address/notifications/:id` | Update a preference |
| `DELETE` | `/employers/:address/notifications/:id` | Delete a preference |
| `GET` | `/notifications/unsubscribe/:token` | Unsubscribe via email link |

#### Channels
- `email` — destination is an email address; unsubscribe token included in email footer
- `webhook` — destination is an HTTPS URL; payload is the event JSON

#### Per-event toggles
Each preference has a map of `StreamEvent → bool`. Supported events:
`stream_created`, `withdrawn`, `paused`, `resumed`, `cancelled`, `topped_up`, `stream_transferred`

#### Example request body
```json
{
  "channel": "email",
  "destination": "payroll@company.com",
  "events": {
    "stream_created": true,
    "withdrawn": false,
    "cancelled": true
  }
}
```
