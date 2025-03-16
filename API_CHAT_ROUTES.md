# API de Gestión de Chats - Documentación

Esta documentación describe las rutas disponibles para gestionar conversaciones (chats) en la API de Zephyrus.

## Rutas para Conversaciones

### Crear una Nueva Conversación

**Ruta:** `POST /conversations`

**Parámetros requeridos:**
- `walletAddress`: La dirección de wallet del usuario
- `name`: El nombre de la conversación

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:3000/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "name": "Nuevo proyecto de contrato NFT"
  }'
```

**Respuesta exitosa:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890"
}
```

### Obtener Todas las Conversaciones de un Usuario

**Ruta:** `GET /conversations/:walletAddress`

**Ejemplo con curl:**
```bash
curl -X GET http://localhost:3000/conversations/0x1234567890abcdef1234567890abcdef12345678
```

**Respuesta esperada:**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
    "user_wallet": "0x1234567890abcdef1234567890abcdef12345678",
    "name": "Nuevo proyecto de contrato NFT",
    "created_at": "2023-10-15T14:30:45.000Z",
    "updated_at": "2023-10-15T14:30:45.000Z",
    "last_accessed": "2023-10-15T15:20:10.000Z"
  },
  {
    "id": "b2c3d4e5-f6a7-8901-b2c3-d4e5f6a78901",
    "user_wallet": "0x1234567890abcdef1234567890abcdef12345678",
    "name": "Contrato de Staking",
    "created_at": "2023-10-10T09:15:30.000Z",
    "updated_at": "2023-10-10T09:15:30.000Z",
    "last_accessed": "2023-10-14T11:45:22.000Z"
  }
]
```

### Actualizar el Nombre de una Conversación

**Ruta:** `PATCH /conversations/:conversationId/name`

**Parámetros requeridos:**
- `name`: El nuevo nombre para la conversación

**Ejemplo con curl:**
```bash
curl -X PATCH http://localhost:3000/conversations/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890/name \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Proyecto NFT - Colección Espacial"
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true
}
```

## Rutas para Mensajes

### Guardar un Mensaje en una Conversación

**Ruta:** `POST /messages`

**Parámetros requeridos:**
- `conversationId`: ID de la conversación
- `content`: Contenido del mensaje
- `sender`: Emisor del mensaje (puede ser "user" o "ai")
- `metadata`: Metadatos opcional (JSON)

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
    "content": "Necesito ayuda para crear un contrato de NFT con royalties.",
    "sender": "user",
    "metadata": {
      "timestamp": "2023-10-15T15:32:10.000Z",
      "client": "web"
    }
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true
}
```

### Obtener Todos los Mensajes de una Conversación

**Ruta:** `GET /messages/:conversationId`

**Ejemplo con curl:**
```bash
curl -X GET http://localhost:3000/messages/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890
```

**Respuesta esperada:**
```json
[
  {
    "id": "c3d4e5f6-a7b8-9012-c3d4-e5f6a7b89012",
    "conversation_id": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
    "content": "Hola, ¿en qué puedo ayudarte hoy?",
    "sender": "ai",
    "metadata": null,
    "created_at": "2023-10-15T15:30:45.000Z"
  },
  {
    "id": "d4e5f6a7-b8c9-0123-d4e5-f6a7b8c90123",
    "conversation_id": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
    "content": "Necesito ayuda para crear un contrato de NFT con royalties.",
    "sender": "user",
    "metadata": {
      "timestamp": "2023-10-15T15:32:10.000Z",
      "client": "web"
    },
    "created_at": "2023-10-15T15:32:10.000Z"
  },
  {
    "id": "e5f6a7b8-c9d0-1234-e5f6-a7b8c9d01234",
    "conversation_id": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
    "content": "Claro, puedo ayudarte con eso. Vamos a crear un contrato ERC-721 con soporte para royalties usando el estándar EIP-2981...",
    "sender": "ai",
    "metadata": null,
    "created_at": "2023-10-15T15:32:45.000Z"
  }
]
```

## Nota Importante

Actualmente, no existe una ruta específica para borrar conversaciones completas en la API. Si necesita esta funcionalidad, deberá implementarse una nueva ruta en la API.

## Diagrama de Flujo

```
Usuario ──> POST /conversations ───> Base de Datos ──> Conversación creada
   │                                                           │
   │                                                           ▼
   │       GET /conversations/:walletAddress        Listar todas las conversaciones
   │                                                           │
   │                                                           ▼
   │    PATCH /conversations/:conversationId/name     Actualizar nombre
   │                                                           │
   ▼                                                           ▼
POST /messages ────────────────────> Base de Datos ──> Mensaje guardado
   │                                                           │
   ▼                                                           ▼
GET /messages/:conversationId ─────> Base de Datos ──> Lista de mensajes
``` 