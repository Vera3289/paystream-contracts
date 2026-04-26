# Stream Contract Event Reference

This reference documents all on-chain events emitted by the PayStream contract, including event topics, data fields, and example JSON payloads.

## Event structure

Soroban events are published with a topic tuple and an event payload. For PayStream events, the topic is typically:

- `(symbol_short!("event_name"), stream_id)` for stream-specific events
- `(symbol_short!("paused"),)` for contract-level pause changes

The event data payload is a tuple or single value depending on event type.

## Events

### `created`

- Topic: `("created", stream_id)`
- Data: `(employer_address, employee_address, rate_per_second)`

Example payload:

```json
{
  "topic": ["created", 1],
  "data": [
    "G...EMPLOYERADDRESS...",
    "G...EMPLOYEEADDRESS...",
    10
  ]
}
```

### `withdraw`

- Topic: `("withdraw", stream_id)`
- Data: `(employee_address, amount)`

Example payload:

```json
{
  "topic": ["withdraw", 1],
  "data": [
    "G...EMPLOYEEADDRESS...",
    2000
  ]
}
```

### `status`

- Topic: `("status", stream_id)`
- Data: `StreamStatus`

`StreamStatus` values:

- `Active`
- `Paused`
- `Cancelled`
- `Exhausted`

Example payload:

```json
{
  "topic": ["status", 1],
  "data": "Paused"
}
```

### `topup`

- Topic: `("topup", stream_id)`
- Data: `(employer_address, amount)`

Example payload:

```json
{
  "topic": ["topup", 1],
  "data": [
    "G...EMPLOYERADDRESS...",
    5000
  ]
}
```

### `paused`

- Topic: `("paused",)`
- Data: `bool`

This contract-level event is emitted by both `pause_contract` and `unpause_contract`.

Example payload:

```json
{
  "topic": ["paused"],
  "data": true
}
```

## Notes

- Event topics are stable symbols and should be indexed by off-chain listeners.
- `stream_id` identifies the stream for stream-specific lifecycle events.
- `paused` is a contract-wide event and does not include a stream ID.
