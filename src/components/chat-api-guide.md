# Chat and User API - Usage Guide

This guide describes the available routes for handling users, conversations, and messages in the Zephyrus API.

## Base URL
```
http://localhost:3000/api/db
```

## Users

### Create User
Registers a new user in the system.

```http
POST /users
Content-Type: application/json

{
    "walletAddress": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
}
```

**Successful Response (200 OK)**
```json
{
    "success": true
}
```

### Get User
Gets the information of a specific user.

```http
GET /users/:walletAddress
```

**Successful Response (200 OK)**
```json
{
    "wallet_address": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
    "created_at": "2024-03-20T12:00:00.000Z"
}
```

## Conversations

### Create Conversation
Creates a new conversation for a user.

```http
POST /conversations
Content-Type: application/json

{
    "walletAddress": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
    "name": "My New Conversation"
}
```

**Successful Response (200 OK)**
```json
{
    "id": "conversation-uuid"
}
```

### Get Conversations
Gets all conversations for a user.

```http
GET /conversations/:walletAddress
```

**Successful Response (200 OK)**
```json
[
    {
        "id": "conversation-uuid",
        "name": "My New Conversation",
        "user_wallet": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
        "created_at": "2024-03-20T12:00:00.000Z",
        "last_accessed": "2024-03-20T12:00:00.000Z"
    }
]
```

### Update Conversation Name
Updates the name of an existing conversation.

```http
PATCH /conversations/:conversationId/name
Content-Type: application/json

{
    "name": "New Conversation Name"
}
```

**Successful Response (200 OK)**
```json
{
    "success": true
}
```

## Messages

### Create Message
Adds a new message to a conversation.

```http
POST /messages
Content-Type: application/json

{
    "conversationId": "conversation-uuid",
    "content": "Message content",
    "sender": "user",
    "metadata": {
        "key": "value"
    }
}
```

**Successful Response (200 OK)**
```json
{
    "success": true
}
```

### Get Messages
Gets all messages from a conversation.

```http
GET /messages/:conversationId
```

**Successful Response (200 OK)**
```json
[
    {
        "id": "message-uuid",
        "conversation_id": "conversation-uuid",
        "content": "Message content",
        "sender": "user",
        "metadata": {
            "key": "value"
        },
        "created_at": "2024-03-20T12:00:00.000Z"
    }
]
```

## Error Handling

The API returns errors in the following format:

```json
{
    "error": "Error description"
}
```

### HTTP Status Codes

- **200 OK**: Successful request
- **400 Bad Request**: Error in the data sent
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

## Usage Examples with PowerShell

### 1. Create a User
```powershell
$body = @{
    walletAddress = "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
} | ConvertTo-Json

Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/db/users" -Body $body -ContentType "application/json"
```

### 2. Create a Conversation
```powershell
$body = @{
    walletAddress = "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
    name = "My New Conversation"
} | ConvertTo-Json

Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/db/conversations" -Body $body -ContentType "application/json"
```

### 3. Send a Message
```powershell
$body = @{
    conversationId = "conversation-uuid"
    content = "Hello, this is a test message"
    sender = "user"
} | ConvertTo-Json

Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/db/messages" -Body $body -ContentType "application/json"
```

## Important Notes

1. All timestamps are returned in UTC ISO format.
2. The wallet address must be a valid Ethereum address.
3. The `sender` field in messages can only be "user" or "ai".
4. The `metadata` field is optional in messages.
5. Conversations are sorted by last access date.
6. Messages are sorted chronologically (ASC).

## Typical Usage Flow

1. Create or verify user with wallet
2. Create a new conversation
3. Send messages to the conversation
4. Get message history
5. Update conversation name if necessary 