# Customizable ERC721 NFT Template

Este template proporciona un contrato inteligente ERC721 (NFT) altamente personalizable con características modernas y seguras.

## Características

- **Minteable**: Nuevos NFTs pueden ser creados por direcciones con el rol MINTER_ROLE
- **Quemable**: Los poseedores de NFTs pueden destruir sus tokens
- **Pausable**: Las transferencias pueden ser pausadas por direcciones con el rol PAUSER_ROLE
- **Enumerable**: Permite enumerar todos los tokens y sus propietarios
- **Metadata URI**: Cada token puede tener su propia URI de metadata
- **Control de Acceso Basado en Roles**: Diferentes permisos para diferentes roles
- **Suministro Máximo Configurable**: Opción para establecer un límite máximo de NFTs

## Parámetros de Construcción

El contrato se inicializa con los siguientes parámetros:

- `name`: Nombre de la colección NFT (ej. "Mi Colección NFT")
- `symbol`: Símbolo de la colección (ej. "MCN")
- `maxSupply_`: Suministro máximo de tokens (0 para ilimitado)

## Roles

El contrato implementa los siguientes roles:

- `DEFAULT_ADMIN_ROLE`: Puede gestionar otros roles
- `MINTER_ROLE`: Puede crear nuevos NFTs
- `PAUSER_ROLE`: Puede pausar/reanudar transferencias

## Funciones Principales

### Administración de NFTs
- `safeMint(address to, string memory uri)`: Crea un nuevo NFT con metadata
- `burn(uint256 tokenId)`: Quema un NFT específico
- `tokenURI(uint256 tokenId)`: Obtiene la URI de metadata de un token

### Control de Pausado
- `pause()`: Pausa todas las transferencias
- `unpause()`: Reanuda las transferencias

### Información de la Colección
- `maxSupply()`: Retorna el suministro máximo configurado
- `totalMinted()`: Retorna el número total de NFTs acuñados
- `balanceOf(address owner)`: Retorna el número de NFTs de un propietario
- `ownerOf(uint256 tokenId)`: Retorna el propietario de un NFT específico

## Ejemplo de Uso

```solidity
// Despliegue del contrato
CustomizableERC721 nft = new CustomizableERC721(
    "Mi Colección NFT",    // nombre
    "MCN",                 // símbolo
    1000                   // suministro máximo (1000 NFTs)
);

// Acuñar un nuevo NFT (requiere MINTER_ROLE)
nft.safeMint(
    addressDestino,
    "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/1"
);

// Quemar un NFT
nft.burn(0);

// Pausar transferencias (requiere PAUSER_ROLE)
nft.pause();

// Reanudar transferencias (requiere PAUSER_ROLE)
nft.unpause();
```

## Metadata

El contrato soporta metadata siguiendo el estándar OpenSea, que debe tener el siguiente formato:

```json
{
    "name": "Nombre del NFT",
    "description": "Descripción del NFT",
    "image": "https://...",
    "attributes": [
        {
            "trait_type": "Característica 1",
            "value": "Valor 1"
        },
        {
            "trait_type": "Característica 2",
            "value": "Valor 2"
        }
    ]
}
```

## Seguridad

El contrato incluye:
- Control de roles para funciones críticas
- Comprobaciones de suministro máximo
- Protección contra reentrada
- Capacidad de pausa de emergencia
- Implementación segura de transferencias (safeMint)

## Consideraciones

1. El deployer del contrato recibe todos los roles inicialmente
2. El suministro máximo no puede ser modificado después del despliegue
3. Cada NFT debe tener una URI única para su metadata
4. Las URIs de metadata deberían apuntar a recursos inmutables (ej. IPFS)
5. Asegúrese de gestionar los roles de manera segura

## Licencia

Este contrato está bajo la licencia MIT. 