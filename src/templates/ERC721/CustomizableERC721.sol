// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CustomizableERC721
 * @dev Implementation of a customizable NFT (ERC721) token with the following features:
 * - Mintable: New tokens can be created by addresses with MINTER_ROLE
 * - Burnable: Token holders can destroy their tokens
 * - Pausable: Token transfers can be paused by addresses with PAUSER_ROLE
 * - Enumerable: Tokens can be enumerated
 * - URI Storage: Each token can have its own metadata URI
 * - Role Based Access Control: Different permissions for different roles
 */
contract CustomizableERC721 is ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 private _nextTokenId;
    uint256 private _maxSupply;

    error MaxSupplyExceeded();
    error TokenDoesNotExist();
    error CallerNotOwnerNorApproved();

    /**
     * @dev Constructor that gives the msg.sender all available roles.
     * @param name The name of the NFT collection
     * @param symbol The symbol of the NFT collection
     * @param maxSupply_ The maximum supply of tokens (0 for unlimited)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 maxSupply_
    ) ERC721(name, symbol) {
        _maxSupply = maxSupply_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new token with metadata.
     * @param to The address that will receive the minted token
     * @param uri The token URI for metadata
     */
    function safeMint(address to, string memory uri) public onlyRole(MINTER_ROLE) {
        if (_maxSupply != 0 && _nextTokenId >= _maxSupply) revert MaxSupplyExceeded();
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @dev Burns a token.
     * @param tokenId The ID of the token to burn
     */
    function burn(uint256 tokenId) public {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (!_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId)) revert CallerNotOwnerNorApproved();
        _burn(tokenId);
    }

    /**
     * @dev Pauses all token transfers.
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Returns the max supply of tokens.
     * @return The maximum supply (0 means unlimited)
     */
    function maxSupply() public view returns (uint256) {
        return _maxSupply;
    }

    /**
     * @dev Returns the total number of tokens minted.
     */
    function totalMinted() public view returns (uint256) {
        return _nextTokenId;
    }

    // Required overrides for inherited contracts
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
} 