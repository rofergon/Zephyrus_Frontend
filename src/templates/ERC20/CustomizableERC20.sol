// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CustomizableERC20
 * @dev Implementation of a customizable ERC20 token with the following features:
 * - Mintable: New tokens can be created by addresses with MINTER_ROLE
 * - Burnable: Token holders can destroy their tokens
 * - Pausable: Token transfers can be paused by addresses with PAUSER_ROLE
 * - Role Based Access Control: Different permissions for different roles
 */
contract CustomizableERC20 is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint8 private _decimals;
    uint256 private _maxSupply;

    error InitialSupplyExceedsMaxSupply();
    error WouldExceedMaxSupply();

    /**
     * @dev Constructor that gives the msg.sender all available roles.
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param initialSupply The initial supply of tokens
     * @param tokenDecimals The number of decimals for the token
     * @param initialMaxSupply The maximum supply of tokens (0 for unlimited)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 tokenDecimals,
        uint256 initialMaxSupply
    ) ERC20(name, symbol) {
        if (initialMaxSupply != 0 && initialSupply > initialMaxSupply) revert InitialSupplyExceedsMaxSupply();
        
        _decimals = tokenDecimals;
        _maxSupply = initialMaxSupply;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    /**
     * @dev Creates new tokens.
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        if (_maxSupply != 0 && totalSupply() + amount > _maxSupply) revert WouldExceedMaxSupply();
        _mint(to, amount);
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
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Returns the max supply of tokens.
     * @return The maximum supply (0 means unlimited)
     */
    function maxSupply() public view returns (uint256) {
        return _maxSupply;
    }

    /**
     * @dev Required override for _beforeTokenTransfer used by multiple parent contracts
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 