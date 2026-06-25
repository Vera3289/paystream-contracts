# Token Contract Access Control

## Roles

### Admin
The contract admin controls core token governance for the token contract.

Capabilities:
- Initialize the contract
- Grant and revoke minter roles
- Mint tokens directly when acting as the admin

### Minter
The minter role allows authorized addresses to mint new tokens.

Capabilities:
- Mint new tokens to any address up to the supply cap

## Authorization rules

- The admin is always authorized to mint.
- Authorized minters may mint tokens even if they are not the admin.
- Only the admin may grant or revoke the minter role.

## Functions

- `mint(caller, to, amount)`
  - Requires `caller` to be the admin or an authorized minter.

- `add_minter(admin, minter)`
  - Requires `admin` to match the stored admin.
  - Grants the minter role to `minter`.

- `remove_minter(admin, minter)`
  - Requires `admin` to match the stored admin.
  - Revokes the minter role from `minter`.

- `is_minter(address)`
  - Returns whether `address` currently has the minter role.
