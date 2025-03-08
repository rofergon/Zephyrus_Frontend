# API de Base de Datos - Documentación

Esta documentación describe los endpoints disponibles para interactuar con la base de datos de Zephyrus.

## Base URL

```
https://069c626bcc34.ngrok.app/api/db
```

## Endpoints

### Usuarios

#### Crear Usuario
```http
POST /users
Content-Type: application/json

{
    "walletAddress": "0x1234567890123456789012345678901234567890"
}
```

**Respuesta exitosa**
```json
{
    "success": true
}
```

#### Obtener Usuario
```http
GET /users/:walletAddress
```

**Respuesta exitosa**
```json
{
    "wallet_address": "0x1234567890123456789012345678901234567890",
    "created_at": "2024-03-20T12:00:00.000Z"
}
```

### Conversaciones

#### Crear Conversación
```http
POST /conversations
Content-Type: application/json

{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "name": "Mi Nueva Conversación"
}
```

**Respuesta exitosa**
```json
{
    "id": "uuid-de-la-conversacion"
}
```

#### Obtener Conversaciones de un Usuario
```http
GET /conversations/:walletAddress
```

**Respuesta exitosa**
```json
[
    {
        "id": "uuid-de-la-conversacion",
        "name": "Mi Nueva Conversación",
        "user_wallet": "0x1234567890123456789012345678901234567890",
        "created_at": "2024-03-20T12:00:00.000Z",
        "last_accessed": "2024-03-20T12:00:00.000Z"
    }
]
```

### Mensajes

#### Guardar Mensaje
```http
POST /messages
Content-Type: application/json

{
    "conversationId": "uuid-de-la-conversacion",
    "content": "Contenido del mensaje",
    "sender": "user",
    "metadata": {
        "key": "value"
    }
}
```

**Respuesta exitosa**
```json
{
    "success": true
}
```

#### Obtener Mensajes de una Conversación
```http
GET /messages/:conversationId
```

**Respuesta exitosa**
```json
[
    {
        "id": "uuid-del-mensaje",
        "conversation_id": "uuid-de-la-conversacion",
        "content": "Contenido del mensaje",
        "sender": "user",
        "metadata": {
            "key": "value"
        },
        "created_at": "2024-03-20T12:00:00.000Z"
    }
]
```

### Historial de Código

#### Guardar Historial de Código
```http
POST /code-history
Content-Type: application/json

{
    "conversationId": "uuid-de-la-conversacion",
    "code": "pragma solidity ^0.8.0;...",
    "language": "solidity",
    "version": "0.8.0",
    "metadata": {
        "key": "value"
    }
}
```

**Respuesta exitosa**
```json
{
    "success": true
}
```

#### Obtener Historial de Código
```http
GET /code-history/:conversationId
```

**Respuesta exitosa**
```json
[
    {
        "id": "uuid-del-codigo",
        "conversation_id": "uuid-de-la-conversacion",
        "code_content": "pragma solidity ^0.8.0;...",
        "language": "solidity",
        "version": "0.8.0",
        "metadata": {
            "key": "value"
        },
        "created_at": "2024-03-20T12:00:00.000Z"
    }
]
```

### Contratos

#### Guardar Contrato Desplegado
```http
POST /contracts
Content-Type: application/json

{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "conversationId": "uuid-de-la-conversacion",
    "contractAddress": "0xabcdef1234567890abcdef1234567890abcdef12",
    "name": "MiContrato",
    "abi": [...],
    "bytecode": "0x...",
    "sourceCode": "pragma solidity ^0.8.0;...",
    "compilerVersion": "0.8.0",
    "constructorArgs": [],
    "networkId": 57054
}
```

**Respuesta exitosa**
```json
{
    "success": true
}
```

#### Obtener Contratos por Wallet
```http
GET /contracts/:walletAddress
```

**Respuesta exitosa**
```json
[
    {
        "id": "uuid-del-contrato",
        "user_wallet": "0x1234567890123456789012345678901234567890",
        "conversation_id": "uuid-de-la-conversacion",
        "contract_address": "0xabcdef1234567890abcdef1234567890abcdef12",
        "name": "MiContrato",
        "abi": [...],
        "bytecode": "0x...",
        "source_code": "pragma solidity ^0.8.0;...",
        "compiler_version": "0.8.0",
        "constructor_args": [],
        "network_id": 57054,
        "deployed_at": "2024-03-20T12:00:00.000Z"
    }
]
```

#### Obtener Contratos por Conversación
```http
GET /contracts/conversation/:conversationId
```

**Respuesta exitosa**
```json
[
    {
        "id": "uuid-del-contrato",
        "user_wallet": "0x1234567890123456789012345678901234567890",
        "conversation_id": "uuid-de-la-conversacion",
        "contract_address": "0xabcdef1234567890abcdef1234567890abcdef12",
        "name": "MiContrato",
        "abi": [...],
        "bytecode": "0x...",
        "source_code": "pragma solidity ^0.8.0;...",
        "compiler_version": "0.8.0",
        "constructor_args": [],
        "network_id": 57054,
        "deployed_at": "2024-03-20T12:00:00.000Z"
    }
]
```

### Agentes

#### Crear Agente
```http
POST /agents
Content-Type: application/json

{
    "contractId": "uuid-del-contrato",
    "name": "Mi Agente",
    "description": "Descripción del agente",
    "status": "active",
    "gasLimit": "1000000",
    "maxPriorityFee": "2"
}
```

**Respuesta exitosa**
```json
{
    "agentId": "uuid-del-agente",
    "contractId": "uuid-del-contrato",
    "name": "Mi Agente",
    "description": "Descripción del agente",
    "status": "active",
    "gasLimit": "1000000",
    "maxPriorityFee": "2",
    "created_at": "2024-03-20T12:00:00.000Z",
    "updated_at": "2024-03-20T12:00:00.000Z"
}
```

#### Obtener Agentes por Contrato
```http
GET /agents/:contractId
```

**Respuesta exitosa**
```json
[
    {
        "agentId": "uuid-del-agente",
        "contractId": "uuid-del-contrato",
        "name": "Mi Agente",
        "description": "Descripción del agente",
        "status": "active",
        "gasLimit": "1000000",
        "maxPriorityFee": "2",
        "created_at": "2024-03-20T12:00:00.000Z",
        "updated_at": "2024-03-20T12:00:00.000Z"
    }
]
```

#### Actualizar Agente
```http
PATCH /agents/:agentId
Content-Type: application/json

{
    "status": "paused",
    "gasLimit": "2000000"
}
```

**Respuesta exitosa**
```json
{
    "agentId": "uuid-del-agente",
    "status": "paused",
    "gasLimit": "2000000",
    "updated_at": "2024-03-20T12:00:00.000Z"
}
```

### Funciones del Agente

#### Crear Función
```http
POST /agents/:agentId/functions
Content-Type: application/json

{
    "functionName": "transfer",
    "functionSignature": "transfer(address,uint256)",
    "functionType": "write",
    "isEnabled": true,
    "validationRules": {
        "minAmount": "0.1",
        "maxAmount": "10"
    }
}
```

**Respuesta exitosa**
```json
{
    "functionId": "uuid-de-la-funcion",
    "agentId": "uuid-del-agente",
    "functionName": "transfer",
    "functionSignature": "transfer(address,uint256)",
    "functionType": "write",
    "isEnabled": true,
    "validationRules": {
        "minAmount": "0.1",
        "maxAmount": "10"
    },
    "created_at": "2024-03-20T12:00:00.000Z",
    "updated_at": "2024-03-20T12:00:00.000Z"
}
```

#### Obtener Funciones del Agente
```http
GET /agents/:agentId/functions
```

**Respuesta exitosa**
```json
[
    {
        "functionId": "uuid-de-la-funcion",
        "agentId": "uuid-del-agente",
        "functionName": "transfer",
        "functionSignature": "transfer(address,uint256)",
        "functionType": "write",
        "isEnabled": true,
        "validationRules": {
            "minAmount": "0.1",
            "maxAmount": "10"
        },
        "created_at": "2024-03-20T12:00:00.000Z",
        "updated_at": "2024-03-20T12:00:00.000Z"
    }
]
```

### Programación del Agente

#### Crear Programación
```http
POST /agents/:agentId/schedules
Content-Type: application/json

{
    "scheduleType": "cron",
    "cronExpression": "0 * * * *",
    "isActive": true
}
```

**Respuesta exitosa**
```json
{
    "scheduleId": "uuid-de-la-programacion",
    "agentId": "uuid-del-agente",
    "scheduleType": "cron",
    "cronExpression": "0 * * * *",
    "isActive": true,
    "nextExecution": "2024-03-20T13:00:00.000Z",
    "created_at": "2024-03-20T12:00:00.000Z",
    "updated_at": "2024-03-20T12:00:00.000Z"
}
```

#### Obtener Programaciones
```http
GET /agents/:agentId/schedules
```

**Respuesta exitosa**
```json
[
    {
        "scheduleId": "uuid-de-la-programacion",
        "agentId": "uuid-del-agente",
        "scheduleType": "cron",
        "cronExpression": "0 * * * *",
        "isActive": true,
        "nextExecution": "2024-03-20T13:00:00.000Z",
        "lastExecution": "2024-03-20T12:00:00.000Z",
        "created_at": "2024-03-20T12:00:00.000Z",
        "updated_at": "2024-03-20T12:00:00.000Z"
    }
]
```

### Notificaciones del Agente

#### Crear Notificación
```http
POST /agents/:agentId/notifications
Content-Type: application/json

{
    "notificationType": "discord",
    "configuration": {
        "webhookUrl": "https://discord.com/api/webhooks/...",
        "channelId": "123456789"
    },
    "isEnabled": true
}
```

**Respuesta exitosa**
```json
{
    "notificationId": "uuid-de-la-notificacion",
    "agentId": "uuid-del-agente",
    "notificationType": "discord",
    "configuration": {
        "webhookUrl": "https://discord.com/api/webhooks/...",
        "channelId": "123456789"
    },
    "isEnabled": true,
    "created_at": "2024-03-20T12:00:00.000Z",
    "updated_at": "2024-03-20T12:00:00.000Z"
}
```

#### Obtener Notificaciones
```http
GET /agents/:agentId/notifications
```

**Respuesta exitosa**
```json
[
    {
        "notificationId": "uuid-de-la-notificacion",
        "agentId": "uuid-del-agente",
        "notificationType": "discord",
        "configuration": {
            "webhookUrl": "https://discord.com/api/webhooks/...",
            "channelId": "123456789"
        },
        "isEnabled": true,
        "created_at": "2024-03-20T12:00:00.000Z",
        "updated_at": "2024-03-20T12:00:00.000Z"
    }
]
```

### Registros de Ejecución

#### Crear Registro de Ejecución
```http
POST /agents/:agentId/logs
Content-Type: application/json

{
    "functionId": "uuid-de-la-funcion",
    "transactionHash": "0x...",
    "status": "success",
    "gasUsed": "50000",
    "gasPrice": "20000000000"
}
```

**Respuesta exitosa**
```json
{
    "logId": "uuid-del-registro",
    "agentId": "uuid-del-agente",
    "functionId": "uuid-de-la-funcion",
    "transactionHash": "0x...",
    "status": "success",
    "gasUsed": "50000",
    "gasPrice": "20000000000",
    "executionTime": "2024-03-20T12:00:00.000Z",
    "created_at": "2024-03-20T12:00:00.000Z"
}
```

#### Obtener Registros de Ejecución
```http
GET /agents/:agentId/logs
```

**Respuesta exitosa**
```json
[
    {
        "logId": "uuid-del-registro",
        "agentId": "uuid-del-agente",
        "functionId": "uuid-de-la-funcion",
        "transactionHash": "0x...",
        "status": "success",
        "gasUsed": "50000",
        "gasPrice": "20000000000",
        "executionTime": "2024-03-20T12:00:00.000Z",
        "created_at": "2024-03-20T12:00:00.000Z"
    }
]
```

## Códigos de Error

La API puede devolver los siguientes códigos de estado HTTP:

- `200 OK`: La solicitud se completó exitosamente
- `400 Bad Request`: La solicitud contiene datos inválidos
- `404 Not Found`: El recurso solicitado no existe
- `500 Internal Server Error`: Error interno del servidor

Los errores incluirán un mensaje descriptivo en el siguiente formato:

```json
{
    "error": "Descripción del error"
}
```

## Notas Adicionales

- Todos los timestamps están en formato ISO 8601
- Las direcciones de wallet deben ser direcciones Ethereum válidas (0x...)
- Los IDs de conversación son UUIDs v4
- Los metadatos son opcionales y pueden contener cualquier objeto JSON válido
- La red por defecto es Sonic (networkId: 57054) 