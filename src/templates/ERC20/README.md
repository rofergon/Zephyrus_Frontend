# Customizable ERC20 Token Template

Este template proporciona un contrato inteligente ERC20 altamente personalizable con características modernas y seguras.

## Características

- **Minteable**: Nuevos tokens pueden ser creados por direcciones con el rol MINTER_ROLE
- **Quemable**: Los poseedores de tokens pueden destruir sus tokens
- **Pausable**: Las transferencias pueden ser pausadas por direcciones con el rol PAUSER_ROLE
- **Control de Acceso Basado en Roles**: Diferentes permisos para diferentes roles
- **Suministro Máximo Configurable**: Opción para establecer un límite máximo de tokens
- **Decimales Personalizables**: Flexibilidad en la precisión del token

## Parámetros de Construcción

El contrato se inicializa con los siguientes parámetros:

- `name`: Nombre del token (ej. "Mi Token")
- `symbol`: Símbolo del token (ej. "MTK")
- `initialSupply`: Cantidad inicial de tokens a crear
- `tokenDecimals`: Número de decimales para el token (típicamente 18)
- `maxSupply`: Suministro máximo de tokens (0 para ilimitado)

## Roles

El contrato implementa los siguientes roles:

- `DEFAULT_ADMIN_ROLE`: Puede gestionar otros roles
- `MINTER_ROLE`: Puede crear nuevos tokens
- `PAUSER_ROLE`: Puede pausar/reanudar transferencias

## Funciones Principales

### Administración de Tokens
- `mint(address to, uint256 amount)`: Crea nuevos tokens
- `burn(uint256 amount)`: Quema tokens del remitente
- `burnFrom(address account, uint256 amount)`: Quema tokens de una cuenta específica

### Control de Pausado
- `pause()`: Pausa todas las transferencias
- `unpause()`: Reanuda las transferencias

### Información del Token
- `decimals()`: Retorna el número de decimales del token
- `maxSupply()`: Retorna el suministro máximo configurado
- `totalSupply()`: Retorna el suministro actual
- `balanceOf(address account)`: Retorna el balance de una dirección

## Ejemplo de Uso

```solidity
// Despliegue del contrato
CustomizableERC20 token = new CustomizableERC20(
    "Mi Token",    // nombre
    "MTK",         // símbolo
    1000000,       // suministro inicial (1 millón)
    18,            // decimales
    2000000        // suministro máximo (2 millones)
);

// Acuñar nuevos tokens (requiere MINTER_ROLE)
token.mint(addressDestino, 1000);

// Quemar tokens
token.burn(500);

// Pausar transferencias (requiere PAUSER_ROLE)
token.pause();

// Reanudar transferencias (requiere PAUSER_ROLE)
token.unpause();
```

## Seguridad

El contrato incluye:
- Control de roles para funciones críticas
- Comprobaciones de suministro máximo
- Protección contra reentrada
- Capacidad de pausa de emergencia

## Consideraciones

1. El deployer del contrato recibe todos los roles inicialmente
2. El suministro máximo no puede ser modificado después del despliegue
3. Los decimales son fijos después del despliegue
4. Asegúrese de gestionar los roles de manera segura

## Licencia

Este contrato está bajo la licencia MIT. 