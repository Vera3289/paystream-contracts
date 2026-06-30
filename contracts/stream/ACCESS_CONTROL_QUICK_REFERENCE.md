# Access Control Quick Reference

## Import Statement

```rust
use access_control::{
    require_admin, 
    require_employee, 
    require_employee_by_id, 
    require_employer,
    require_employer_by_id, 
    require_pending_admin, 
    require_pending_employer,
    is_admin,
    is_employer,
    is_employee,
};
```

## Common Patterns

### Admin Authorization

```rust
pub fn admin_function(env: Env, admin: Address, nonce: u64) {
    admin.require_auth();                    // Soroban auth check
    require_admin(&env, &admin);             // Role verification
    consume_admin_nonce(&env, nonce);        // Replay protection
    // ... admin operation
}
```

### Employer Authorization (Load Stream)

```rust
pub fn employer_function(env: Env, employer: Address, stream_id: u64) {
    employer.require_auth();                                    // Soroban auth check
    let mut stream = require_employer_by_id(&env, &employer, stream_id);  // Load + verify
    // ... employer operation using stream
    save_stream(&env, &stream);
}
```

### Employer Authorization (Already Have Stream)

```rust
pub fn employer_function(env: Env, employer: Address, stream_id: u64) {
    employer.require_auth();                                    // Soroban auth check
    let stream = load_stream(&env, stream_id).expect("stream not found");
    require_employer(&employer, &stream);                       // Verify only
    // ... employer operation
}
```

### Employee Authorization

```rust
pub fn employee_function(env: Env, employee: Address, stream_id: u64) {
    employee.require_auth();                                    // Soroban auth check
    let mut stream = require_employee_by_id(&env, &employee, stream_id);  // Load + verify
    // ... employee operation using stream
    save_stream(&env, &stream);
}
```

### Two-Step Admin Transfer

```rust
// Step 1: Propose
pub fn propose_admin(env: Env, current_admin: Address, new_admin: Address) {
    current_admin.require_auth();
    require_admin(&env, &current_admin);
    set_pending_admin(&env, &new_admin);
}

// Step 2: Accept
pub fn accept_admin(env: Env, new_admin: Address) {
    new_admin.require_auth();
    require_pending_admin(&env, &new_admin);
    set_admin(&env, &new_admin);
    clear_pending_admin(&env);
}
```

### Two-Step Employer Transfer

```rust
// Step 1: Propose
pub fn propose_employer_transfer(env: Env, employer: Address, stream_id: u64, new_employer: Address) {
    employer.require_auth();
    let stream = require_employer_by_id(&env, &employer, stream_id);
    set_pending_employer(&env, stream_id, &new_employer);
}

// Step 2: Accept
pub fn accept_employer_transfer(env: Env, new_employer: Address, stream_id: u64) {
    new_employer.require_auth();
    require_pending_employer(&env, &new_employer, stream_id);
    let mut stream = load_stream(&env, stream_id).expect("stream not found");
    stream.employer = new_employer.clone();
    save_stream(&env, &stream);
    clear_pending_employer(&env, stream_id);
}
```

### Conditional Authorization (Non-Panicking)

```rust
pub fn query_function(env: Env, address: Address, stream_id: u64) -> bool {
    let stream = load_stream(&env, stream_id).expect("stream not found");
    
    if is_admin(&env, &address) {
        // Admin can do anything
        return true;
    }
    
    if is_employer(&address, &stream) {
        // Employer can do this
        return true;
    }
    
    if is_employee(&address, &stream) {
        // Employee can do that
        return true;
    }
    
    false
}
```

## Function Reference

### Panicking Functions (Use for Authorization)

| Function | Use Case | Panics With |
|----------|----------|-------------|
| `require_admin(env, caller)` | Verify admin role | "not the admin" |
| `require_pending_admin(env, caller)` | Verify pending admin | "not the pending admin" |
| `require_employer(caller, stream)` | Verify employer (have stream) | "not the employer" |
| `require_employer_by_id(env, caller, id)` | Verify employer (load stream) | "not the employer" |
| `require_pending_employer(env, caller, id)` | Verify pending employer | "E013: not the pending employer..." |
| `require_employee(caller, stream)` | Verify employee (have stream) | "not the employee" |
| `require_employee_by_id(env, caller, id)` | Verify employee (load stream) | "not the employee" |

### Non-Panicking Functions (Use for Queries)

| Function | Use Case | Returns |
|----------|----------|---------|
| `is_admin(env, address)` | Check if admin | `bool` |
| `is_employer(address, stream)` | Check if employer | `bool` |
| `is_employee(address, stream)` | Check if employee | `bool` |

## Error Messages

All error messages are consistent:

```rust
pub const ERR_NOT_ADMIN: &str = "not the admin";
pub const ERR_NOT_PENDING_ADMIN: &str = "not the pending admin";
pub const ERR_NOT_EMPLOYER: &str = "not the employer";
pub const ERR_NOT_EMPLOYEE: &str = "not the employee";
```

## Best Practices

### ✅ DO

- Always call `require_auth()` before role verification
- Use `require_*_by_id()` when you need to load the stream anyway
- Use `require_*()` when you already have the stream loaded
- Use `is_*()` for conditional logic that doesn't require authorization
- Keep error messages consistent with the module constants

### ❌ DON'T

- Don't mix ad-hoc checks with centralized functions
- Don't skip `require_auth()` - it's the Soroban-level check
- Don't create custom error messages for authorization failures
- Don't load the stream twice (once for auth, once for operation)

## Testing Pattern

```rust
#[test]
#[should_panic(expected = "not the employer")]
fn test_unauthorized_access() {
    let env = Env::default();
    env.mock_all_auths();  // Mock Soroban auth
    
    let employer = Address::generate(&env);
    let attacker = Address::generate(&env);
    let stream = create_test_stream(&env, 1, &employer, &employee);
    
    // This should panic
    require_employer(&attacker, &stream);
}
```

## Migration Checklist

When adding a new restricted function:

- [ ] Import the appropriate `require_*` function
- [ ] Call `caller.require_auth()` first
- [ ] Call the appropriate `require_*` function
- [ ] Use `require_*_by_id()` if you need to load the stream
- [ ] Write a negative test that verifies unauthorized access is rejected
- [ ] Document the function's authorization requirements

## Examples from Codebase

### Before Refactoring

```rust
pub fn pause_stream(env: Env, employer: Address, stream_id: u64) {
    employer.require_auth();
    let mut stream = load_stream(&env, stream_id).expect("stream not found");
    assert_eq!(stream.employer, employer, "not the employer");
    assert_eq!(stream.status, StreamStatus::Active, "stream not active");
    // ... rest of function
}
```

### After Refactoring

```rust
pub fn pause_stream(env: Env, employer: Address, stream_id: u64) {
    employer.require_auth();
    let mut stream = require_employer_by_id(&env, &employer, stream_id);
    assert_eq!(stream.status, StreamStatus::Active, "stream not active");
    // ... rest of function
}
```

**Benefits:**
- 1 line instead of 2 for authorization
- Consistent error message
- Clearer intent
- Easier to audit

## Quick Decision Tree

```
Need to authorize?
│
├─ Admin operation?
│  └─ Use: require_admin(env, caller)
│
├─ Employer operation?
│  ├─ Already have stream?
│  │  └─ Use: require_employer(caller, stream)
│  └─ Need to load stream?
│     └─ Use: require_employer_by_id(env, caller, stream_id)
│
├─ Employee operation?
│  ├─ Already have stream?
│  │  └─ Use: require_employee(caller, stream)
│  └─ Need to load stream?
│     └─ Use: require_employee_by_id(env, caller, stream_id)
│
├─ Two-step transfer?
│  ├─ Admin transfer?
│  │  ├─ Propose: require_admin(env, current_admin)
│  │  └─ Accept: require_pending_admin(env, new_admin)
│  └─ Employer transfer?
│     ├─ Propose: require_employer_by_id(env, employer, stream_id)
│     └─ Accept: require_pending_employer(env, new_employer, stream_id)
│
└─ Conditional check (no panic)?
   ├─ Admin? Use: is_admin(env, address)
   ├─ Employer? Use: is_employer(address, stream)
   └─ Employee? Use: is_employee(address, stream)
```

## See Also

- `ACCESS_CONTROL.md` - Full documentation
- `REFACTORING_SUMMARY.md` - Refactoring details
- `AUTH_TESTS_SUMMARY.md` - Test coverage
- `src/access_control.rs` - Source code
