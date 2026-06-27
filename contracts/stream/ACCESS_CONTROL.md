# Access Control Module Documentation

## Overview

The `access_control` module provides centralized authorization and permission checks for the stream contract. All role-based access control is managed through this module to ensure consistent security enforcement across the codebase.

## Location

- **Module**: `contracts/stream/src/access_control.rs`
- **Integration**: Imported and used in `contracts/stream/src/lib.rs`

## Roles

### 1. Admin

The contract administrator with system-wide privileges.

**Permissions:**
- Initialize the contract
- Transfer admin role (two-step process via `propose_admin` → `accept_admin`)
- Pause/unpause the entire contract
- Set protocol parameters:
  - Minimum deposit amount
  - Protocol fees (basis points and recipient)
  - Maximum streams per employer
- Upgrade contract WASM
- Execute migrations

**Functions Using Admin Role:**
- `initialize()`
- `propose_admin()`
- `accept_admin()`
- `pause_contract()`
- `unpause_contract()`
- `set_min_deposit()`
- `set_protocol_fee()`
- `set_max_streams_per_employer()`
- `upgrade()`
- `migrate()`

### 2. Employer

The party that creates and funds salary streams.

**Permissions:**
- Create individual streams via `create_stream()`
- Create multiple streams via `create_streams_batch()`
- Top up stream deposits
- Pause/resume their own streams
- Cancel their own streams
- Update rate for their own streams
- Transfer stream ownership (two-step process via `propose_employer_transfer` → `accept_employer_transfer`)

**Functions Using Employer Role:**
- `create_stream()`
- `create_streams_batch()`
- `top_up()`
- `pause_stream()`
- `resume_stream()`
- `cancel_stream()`
- `update_rate()`
- `propose_employer_transfer()`
- `accept_employer_transfer()`

**Important:** Employers can only control streams they own. After transferring ownership, the old employer loses all control.

### 3. Employee

The beneficiary of a salary stream.

**Permissions:**
- Withdraw earned funds from their streams
- View their stream details

**Functions Using Employee Role:**
- `withdraw()`

**Important:** Employees can only withdraw from streams where they are the designated employee.

### 4. Proposer/Voter

Any address can participate in governance (no special role required).

**Permissions:**
- Create governance proposals
- Vote on active proposals
- Tally votes
- Execute passed proposals (after timelock)

**Functions:**
- `propose_parameter()`
- `vote()`
- `tally()`
- `execute_proposal()`

## API Reference

### Admin Authorization Functions

#### `require_admin(env: &Env, caller: &Address)`

Verifies that the caller is the current admin.

**Panics:** With "not the admin" if the caller doesn't match the stored admin.

**Example:**
```rust
require_admin(&env, &admin);
// Proceed with admin operation
```

#### `require_pending_admin(env: &Env, caller: &Address)`

Verifies that the caller is the pending admin (for two-step admin transfer).

**Panics:** With "not the pending admin" if:
- No pending admin is set
- The caller doesn't match the pending admin

**Example:**
```rust
require_pending_admin(&env, &new_admin);
// Complete admin transfer
```

### Employer Authorization Functions

#### `require_employer(caller: &Address, stream: &Stream)`

Verifies that the caller is the employer of the specified stream.

**Panics:** With "not the employer" if the caller doesn't match the stream's employer.

**Example:**
```rust
let stream = load_stream(&env, stream_id).expect("stream not found");
require_employer(&caller, &stream);
// Proceed with employer operation
```

#### `require_employer_by_id(env: &Env, caller: &Address, stream_id: u64) -> Stream`

Convenience function that loads the stream and checks employer in one call.

**Returns:** The loaded stream if authorization succeeds.

**Panics:** If stream not found or caller is not the employer.

**Example:**
```rust
let stream = require_employer_by_id(&env, &employer, stream_id);
// Proceed with employer operation using the loaded stream
```

#### `require_pending_employer(env: &Env, caller: &Address, stream_id: u64)`

Verifies that the caller is the pending employer for a stream transfer.

**Panics:** With ERR_UNAUTHORIZED_TRANSFER if:
- No pending employer transfer exists for this stream
- The caller doesn't match the pending employer

**Example:**
```rust
require_pending_employer(&env, &new_employer, stream_id);
// Complete employer transfer
```

### Employee Authorization Functions

#### `require_employee(caller: &Address, stream: &Stream)`

Verifies that the caller is the employee of the specified stream.

**Panics:** With "not the employee" if the caller doesn't match the stream's employee.

**Example:**
```rust
let stream = load_stream(&env, stream_id).expect("stream not found");
require_employee(&caller, &stream);
// Proceed with employee operation
```

#### `require_employee_by_id(env: &Env, caller: &Address, stream_id: u64) -> Stream`

Convenience function that loads the stream and checks employee in one call.

**Returns:** The loaded stream if authorization succeeds.

**Panics:** If stream not found or caller is not the employee.

**Example:**
```rust
let stream = require_employee_by_id(&env, &employee, stream_id);
// Proceed with employee operation using the loaded stream
```

### Query Functions (Non-Panicking)

These functions return boolean values and are useful for conditional logic.

#### `is_admin(env: &Env, address: &Address) -> bool`

Checks if an address is the current admin.

**Returns:** `true` if the address matches the stored admin, `false` otherwise.

#### `is_employer(address: &Address, stream: &Stream) -> bool`

Checks if an address is the employer of a specific stream.

**Returns:** `true` if the address matches the stream's employer, `false` otherwise.

#### `is_employee(address: &Address, stream: &Stream) -> bool`

Checks if an address is the employee of a specific stream.

**Returns:** `true` if the address matches the stream's employee, `false` otherwise.

## Error Messages

The module defines consistent error messages:

- `ERR_NOT_ADMIN`: "not the admin"
- `ERR_NOT_PENDING_ADMIN`: "not the pending admin"
- `ERR_NOT_EMPLOYER`: "not the employer"
- `ERR_NOT_EMPLOYEE`: "not the employee"
- `ERR_UNAUTHORIZED_TRANSFER`: "E013: not the pending employer for this stream" (from types.rs)

## Security Features

### 1. Nonce-Based Replay Protection

Admin operations that modify critical parameters require a sequential nonce to prevent replay attacks:

```rust
pub fn set_min_deposit(env: Env, admin: Address, nonce: u64, amount: i128) {
    admin.require_auth();
    require_admin(&env, &admin);
    consume_admin_nonce(&env, nonce);  // Validates and increments nonce
    // ... rest of function
}
```

### 2. Two-Step Transfers

Both admin and employer transfers use a two-step process to prevent accidental transfers:

**Admin Transfer:**
1. Current admin calls `propose_admin(new_admin)`
2. New admin calls `accept_admin()` to complete transfer

**Employer Transfer:**
1. Current employer calls `propose_employer_transfer(stream_id, new_employer)`
2. New employer calls `accept_employer_transfer(stream_id)` to complete transfer

### 3. Stream Isolation

The access control module ensures users can only control their own streams:

- Employers can only modify streams they own
- Employees can only withdraw from streams where they are the beneficiary
- After ownership transfer, the old employer loses all control

### 4. Reentrancy Protection

The withdraw function uses a locking mechanism (handled in the main contract logic):

```rust
assert!(!stream.locked, "{}", ERR_REENTRANT);
stream.locked = true;
save_stream(&env, &stream);
// ... perform transfer ...
stream.locked = false;
save_stream(&env, &stream);
```

## Migration Guide

### Before (Ad-hoc Checks)

```rust
pub fn pause_stream(env: Env, employer: Address, stream_id: u64) {
    employer.require_auth();
    let mut stream = load_stream(&env, stream_id).expect("stream not found");
    assert_eq!(stream.employer, employer, "not the employer");
    // ... rest of function
}
```

### After (Centralized Access Control)

```rust
pub fn pause_stream(env: Env, employer: Address, stream_id: u64) {
    employer.require_auth();
    let mut stream = require_employer_by_id(&env, &employer, stream_id);
    // ... rest of function
}
```

## Benefits

1. **Consistency**: All authorization checks use the same logic and error messages
2. **Maintainability**: Changes to authorization logic only need to be made in one place
3. **Testability**: Authorization logic can be tested independently
4. **Readability**: Intent is clearer with named functions like `require_employer()`
5. **Security**: Reduces risk of missing or inconsistent authorization checks

## Testing

The module includes comprehensive unit tests covering:

- ✅ Admin authorization (success and failure cases)
- ✅ Pending admin authorization
- ✅ Employer authorization (by reference and by ID)
- ✅ Employee authorization (by reference and by ID)
- ✅ Pending employer authorization
- ✅ Query functions (is_admin, is_employer, is_employee)

Run tests with:
```bash
cargo test --package paystream-stream --lib access_control::tests
```

## Integration

The module is integrated into the main contract via:

1. **Module declaration** in `lib.rs`:
   ```rust
   mod access_control;
   ```

2. **Import statements**:
   ```rust
   use access_control::{
       require_admin, require_employee, require_employee_by_id, require_employer,
       require_employer_by_id, require_pending_admin, require_pending_employer,
   };
   ```

3. **Usage in contract functions**: All restricted functions now use the centralized access control functions.

## Acceptance Criteria

✅ **AccessControl module created**: `contracts/stream/src/access_control.rs`

✅ **All auth checks use the module**: All functions in `lib.rs` now use centralized access control functions instead of ad-hoc checks

✅ **Roles documented**: 
- Admin role and permissions documented
- Employer role and permissions documented
- Employee role and permissions documented
- Proposer/Voter role documented

## Additional Documentation

- See `AUTH_TESTS_SUMMARY.md` for comprehensive authorization test coverage
- See inline documentation in `access_control.rs` for detailed API docs
- See `lib.rs` for usage examples in the main contract
