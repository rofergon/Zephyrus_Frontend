# ERC20 Token Contract

## Overview

This contract implements an ERC20 token with the following features:

- Based on OpenZeppelin's ERC20 standard
- Includes roles for management and minting
- Optional maximum supply limit
- Built-in pause functionality for emergencies
- Burning capability
- Snapshot functionality for governance purposes

## Deployment Parameters

The contract is initialized with the following parameters:

- `name`: Name of the token (e.g. "My Token")
- `symbol`: Token symbol (e.g. "MTK")
- `initialSupply`: Initial amount of tokens to create
- `tokenDecimals`: Number of decimals for the token (typically 18)
- `maxSupply`: Maximum token supply (0 for unlimited)

## Roles

The contract implements the following roles:

- `DEFAULT_ADMIN_ROLE`: Can manage other roles
- `MINTER_ROLE`: Can create new tokens
- `PAUSER_ROLE`: Can pause/resume transfers

## Main Functions

### Token Management
- `mint(address to, uint256 amount)`: Creates new tokens
- `burn(uint256 amount)`: Burns tokens from the caller's balance
- `burnFrom(address account, uint256 amount)`: Burns tokens from a specific account (requires allowance)

### Transfer Control
- `pause()`: Pauses all token transfers
- `unpause()`: Resumes token transfers

### Snapshots
- `snapshot()`: Takes a snapshot of all balances
- `balanceOfAt(address account, uint256 snapshotId)`: Gets balance of an account at a specific snapshot
- `totalSupplyAt(uint256 snapshotId)`: Gets total supply at a specific snapshot

### Information
- `maxSupply()`: Returns the configured maximum supply
- `totalMinted()`: Returns the total number of tokens minted
- `decimals()`: Returns the number of decimals
- `totalSupply()`: Returns the current total supply
- `balanceOf(address account)`: Returns the balance of an account

## Example Usage

```solidity
// Deploy the contract
CustomizableERC20 token = new CustomizableERC20(
    "My Token",     // name
    "MTK",          // symbol
    1000000,        // initial supply (1 million tokens)
    18,             // decimals
    10000000        // maximum supply (10 million tokens)
);

// Mint new tokens (requires MINTER_ROLE)
token.mint(destinationAddress, 100000);

// Burn tokens
token.burn(50000);

// Pause transfers (requires PAUSER_ROLE)
token.pause();

// Resume transfers (requires PAUSER_ROLE)
token.unpause();

// Take a snapshot
uint256 snapshotId = token.snapshot();

// Get balance at a specific snapshot
uint256 balanceAtSnapshot = token.balanceOfAt(userAddress, snapshotId);
```

## Security

The contract includes:
- Role-based access control for critical functions
- Maximum supply checks
- Emergency pause capability
- Snapshot functionality for governance
- Safe math operations

## Considerations

1. The contract deployer receives all roles initially
2. Carefully manage role assignments for security
3. The maximum supply cannot be changed after deployment
4. Snapshots are permanent and accumulate in the contract storage

## License

This contract is under the MIT license. 