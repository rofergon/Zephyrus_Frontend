# ERC721 NFT Collection Contract

## Overview

This contract implements an NFT collection with the following features:

- Based on OpenZeppelin's ERC721 standard
- Includes roles for management and minting
- Support for metadata through tokenURI
- Includes minting, burning, and pausing capabilities
- Optional maximum supply limit

## Deployment Parameters

- `name`: Name of the NFT collection (e.g. "My Cool NFTs")
- `symbol`: Symbol of the collection (e.g. "MCN")
- `maxSupply_`: Maximum token supply (0 for unlimited)

## Roles

The contract implements the following roles:

- `DEFAULT_ADMIN_ROLE`: Can manage other roles
- `MINTER_ROLE`: Can create new NFTs
- `PAUSER_ROLE`: Can pause/resume transfers

## Main Functions

### NFT Management
- `safeMint(address to, string memory uri)`: Creates a new NFT with metadata
- `burn(uint256 tokenId)`: Burns a specific NFT

### Transfers and Approvals
- `approve(address to, uint256 tokenId)`: Approves another address to transfer a specific token
- `getApproved(uint256 tokenId)`: Returns the approved address for a token
- `setApprovalForAll(address operator, bool approved)`: Approves or revokes approval for an operator to manage all tokens
- `isApprovedForAll(address owner, address operator)`: Checks if an operator is approved for all tokens of an owner
- `transferFrom(address from, address to, uint256 tokenId)`: Transfers a token from one address to another
- `safeTransferFrom(address from, address to, uint256 tokenId)`: Safely transfers a token (checks if receiver can handle ERC721)

### Metadata
- `tokenURI(uint256 tokenId)`: Returns the URI with the metadata of a token
- `setBaseURI(string memory baseURI_)`: Changes the base URI for all tokens

### Supply and Pause
- `pause()`: Pauses all token transfers
- `unpause()`: Resumes token transfers
- `setMaxSupply(uint256 maxSupply_)`: Changes the maximum supply limit

## Events

The contract emits the following events:

- `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)`: When a token is transferred
- `Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)`: When a token approval is set
- `ApprovalForAll(address indexed owner, address indexed operator, bool approved)`: When approvals for all are set
- `Paused(address account)`: When the contract is paused
- `Unpaused(address account)`: When the contract is unpaused
- `MaxSupplyChanged(uint256 oldMaxSupply, uint256 newMaxSupply)`: When the maximum supply is changed

## Security Considerations

- The contract uses access control for sensitive operations
- Incorporates reentrancy protection through OpenZeppelin's ReentrancyGuard
- Burns are irreversible - tokens cannot be recovered
- The contract administrator should carefully manage role assignments

## Example Usage

```solidity
// Deploy the contract
CustomizableERC721 nft = new CustomizableERC721(
    "My Cool NFTs",    // name
    "MCN",             // symbol
    1000               // maximum supply (1000 NFTs)
);

// Mint a new NFT (requires MINTER_ROLE)
nft.safeMint(
    addressDestino,
    "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/1"
);

// Burn an NFT
nft.burn(0);

// Pause transfers (requires PAUSER_ROLE)
nft.pause();

// Resume transfers (requires PAUSER_ROLE)
nft.unpause();
```

## Metadata

The contract supports metadata following the OpenSea standard, which must have the following format:

```json
{
    "name": "NFT Name",
    "description": "NFT Description",
    "image": "https://...",
    "attributes": [
        {
            "trait_type": "Feature 1",
            "value": "Value 1"
        },
        {
            "trait_type": "Feature 2",
            "value": "Value 2"
        }
    ]
}
```

## License

This contract is under the MIT license. 