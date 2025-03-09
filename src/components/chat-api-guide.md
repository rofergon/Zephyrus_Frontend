# API de Chats y Usuarios - Guía de Uso

Esta guía describe las rutas disponibles para manejar usuarios, conversaciones y mensajes en la API de Zephyrus.

## Base URL
```
http://localhost:3000/api/db
```

## Usuarios

### Crear Usuario
Registra un nuevo usuario en el sistema.

```http
POST /users
Content-Type: application/json

{
    "walletAddress": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
}
```

**Respuesta Exitosa (200 OK)**
```json
{
    "success": true
}
```

### Obtener Usuario
Obtiene la información de un usuario específico.

```http
GET /users/:walletAddress
```

**Respuesta Exitosa (200 OK)**
```json
{
    "wallet_address": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
    "created_at": "2024-03-20T12:00:00.000Z"
}
```

## Conversaciones

### Crear Conversación
Crea una nueva conversación para un usuario.

```http
POST /conversations
Content-Type: application/json

{
    "walletAddress": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
    "name": "Mi Nueva Conversación"
}
```

**Respuesta Exitosa (200 OK)**
```json
{
    "id": "uuid-de-la-conversacion"
}
```

### Obtener Conversaciones
Obtiene todas las conversaciones de un usuario.

```http
GET /conversations/:walletAddress
```

**Respuesta Exitosa (200 OK)**
```json
[
    {
        "id": "uuid-de-la-conversacion",
        "name": "Mi Nueva Conversación",
        "user_wallet": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
        "created_at": "2024-03-20T12:00:00.000Z",
        "last_accessed": "2024-03-20T12:00:00.000Z"
    }
]
```

### Actualizar Nombre de Conversación
Actualiza el nombre de una conversación existente.

```http
PATCH /conversations/:conversationId/name
Content-Type: application/json

{
    "name": "Nuevo Nombre de la Conversación"
}
```

**Respuesta Exitosa (200 OK)**
```json
{
    "success": true
}
```

## Mensajes

### Crear Mensaje
Añade un nuevo mensaje a una conversación.

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

**Respuesta Exitosa (200 OK)**
```json
{
    "success": true
}
```

### Obtener Mensajes
Obtiene todos los mensajes de una conversación.

```http
GET /messages/:conversationId
```

**Respuesta Exitosa (200 OK)**
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

## Manejo de Errores

La API devuelve errores en el siguiente formato:

```json
{
    "error": "Descripción del error"
}
```

### Códigos de Estado HTTP

- **200 OK**: Petición exitosa
- **400 Bad Request**: Error en los datos enviados
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Error del servidor

## Ejemplos de Uso con PowerShell

### 1. Crear un Usuario
```powershell
$body = @{
    walletAddress = "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
} | ConvertTo-Json

Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/db/users" -Body $body -ContentType "application/json"
```

### 2. Crear una Conversación
```powershell
$body = @{
    walletAddress = "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
    name = "Mi Nueva Conversación"
} | ConvertTo-Json

Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/db/conversations" -Body $body -ContentType "application/json"
```

### 3. Enviar un Mensaje
```powershell
$body = @{
    conversationId = "uuid-de-la-conversacion"
    content = "Hola, este es un mensaje de prueba"
    sender = "user"
} | ConvertTo-Json

Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/db/messages" -Body $body -ContentType "application/json"
```

## Notas Importantes

1. Todos los timestamps se devuelven en formato UTC ISO.
2. La wallet address debe ser una dirección Ethereum válida.
3. El campo `sender` en los mensajes solo puede ser "user" o "ai".
4. El campo `metadata` es opcional en los mensajes.
5. Las conversaciones se ordenan por fecha de último acceso.
6. Los mensajes se ordenan cronológicamente (ASC).

## Flujo Típico de Uso

1. Crear o verificar usuario con wallet
2. Crear una nueva conversación
3. Enviar mensajes a la conversación
4. Obtener historial de mensajes
5. Actualizar nombre de la conversación si es necesario 