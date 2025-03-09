// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyToken
 * @dev Un contrato ERC20 con funcionalidad de quemado y control de ownership
 */
contract MyToken is ERC20, ERC20Burnable, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name, symbol) Ownable() {
        // Transfer ownership to initialOwner if different from msg.sender
        if (initialOwner != msg.sender) {
            transferOwnership(initialOwner);
        }
        
        // Mint initial tokens to the initial owner
        _mint(initialOwner, initialSupply * (10 ** decimals()));
    }

    /**
     * @dev Creates `amount` new tokens and assigns them to `account`.
     * @param account The address to receive the minted tokens
     * @param amount The amount of tokens to mint
     * 
     * Requirements:
     * - Only the owner can call this function
     */
    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    /**
     * @dev Transfiere la propiedad del contrato a una nueva dirección.
     * @param newOwner La dirección del nuevo propietario
     * 
     * Requirements:
     * - Solo puede ser llamado por el propietario actual
     * - La nueva dirección no puede ser la dirección cero
     * 
     * Nota: Esta función se hereda de Ownable, pero se reimplementa aquí
     * con documentación explícita para mayor claridad.
     * 
     * Emite un evento OwnershipTransferred cuando se completa la transferencia.
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }
} 