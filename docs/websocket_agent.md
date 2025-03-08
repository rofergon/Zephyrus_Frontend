# Documentación WebSocket - Zephyrus Agent

## Conexión

El servidor WebSocket está disponible en:
```
ws://localhost:8765
```

## Mensajes

La comunicación se realiza mediante mensajes JSON con el siguiente formato:

```json
{
    "type": "tipo_de_mensaje",
    "data": {
        // datos específicos del mensaje
    }
}
```

## Comandos Disponibles

### 1. Configurar Agente

**Enviar:**
```json
{
    "type": "configure_agent",
    "data": {
        "agent": {
            "agentId": "uuid-del-agente",
            "contractId": "dirección-del-contrato",
            "name": "Nombre del Agente",
            "description": "Descripción del comportamiento del agente",
            "status": "paused|active",
            "gasLimit": "300000",
            "maxPriorityFee": "1.5",
            "owner": "dirección-del-propietario",
            "contractState": {
                // Estado actual del contrato
            }
        },
        "functions": [
            {
                "functionId": "uuid-de-la-función",
                "agentId": "uuid-del-agente",
                "functionName": "nombre_función",
                "functionSignature": "firma_función(tipo1,tipo2)",
                "functionType": "read|write|payable",
                "isEnabled": true,
                "validationRules": {
                    // Reglas de validación específicas
                },
                "abi": {
                    // ABI de la función del contrato
                }
            }
        ],
        "schedule": null,
        "notifications": []
    }
}
```

**Respuesta exitosa:**
```json
{
    "type": "agent_configured",
    "data": {
        "agent_id": "uuid-del-agente",
        "status": "success",
        "message": "Agent configured successfully"
    }
}
```

**Respuesta de error:**
```json
{
    "type": "agent_configured",
    "data": {
        "status": "error",
        "message": "Descripción del error"
    }
}
```

### 2. Agregar Agente

**Enviar:**
```json
{
    "type": "add_agent",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

**Respuesta exitosa:**
```json
{
    "type": "agent_added",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

### 3. Iniciar Agente

**Enviar:**
```json
{
    "type": "start_agent",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

**Respuesta exitosa:**
```json
{
    "type": "agent_started",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

### 4. Detener Agente

**Enviar:**
```json
{
    "type": "stop_agent",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

**Respuesta exitosa:**
```json
{
    "type": "agent_stopped",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

### 5. Eliminar Agente

**Enviar:**
```json
{
    "type": "remove_agent",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

**Respuesta exitosa:**
```json
{
    "type": "agent_removed",
    "data": {
        "agent_id": "id_del_agente"
    }
}
```

## Mensajes de Error

En caso de error, el servidor responderá con un mensaje de error:

```json
{
    "type": "error",
    "data": {
        "message": "Descripción del error"
    }
}
```

## Ejemplos de Errores Comunes

1. Agente no encontrado:
```json
{
    "type": "error",
    "data": {
        "message": "Agent <id_del_agente> not found"
    }
}
```

2. Agente ya existe:
```json
{
    "type": "error",
    "data": {
        "message": "Agent <id_del_agente> already exists"
    }
}
```

3. Agente ya está en ejecución:
```json
{
    "type": "error",
    "data": {
        "message": "Agent <id_del_agente> is already running"
    }
}
```

4. Error de configuración:
```json
{
    "type": "agent_configured",
    "data": {
        "status": "error",
        "message": "Invalid agent configuration: missing required field"
    }
}
```

## Notas Adicionales

1. Todos los mensajes deben ser en formato JSON válido.
2. El campo `type` es obligatorio en todos los mensajes.
3. El campo `data` puede variar según el tipo de mensaje.
4. Los mensajes de respuesta siempre incluirán el ID del agente afectado.
5. El servidor mantendrá la conexión abierta hasta que el cliente la cierre o ocurra un error.
6. La configuración del agente se guardará automáticamente en la base de datos.
7. Los timestamps deben estar en formato ISO 8601 (UTC).
8. Las direcciones de contratos y propietarios deben ser direcciones Ethereum válidas (0x...).

## Ejemplo de Uso con JavaScript

```javascript
// Conectar al WebSocket
const ws = new WebSocket('ws://localhost:8765');

// Manejar conexión establecida
ws.onopen = () => {
    console.log('Conectado al servidor WebSocket');
    
    // Ejemplo: Configurar un agente
    ws.send(JSON.stringify({
        type: 'configure_agent',
        data: {
            agent: {
                agentId: 'mi-agente-001',
                contractId: '0x1234...',
                name: 'Mi Agente',
                description: 'Descripción del agente',
                status: 'paused',
                gasLimit: '300000',
                maxPriorityFee: '1.5',
                owner: '0xabcd...',
                contractState: {
                    paused: false
                }
            },
            functions: [],
            schedule: null,
            notifications: []
        }
    }));
};

// Manejar mensajes recibidos
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Mensaje recibido:', message);
};

// Manejar errores
ws.onerror = (error) => {
    console.error('Error en WebSocket:', error);
};

// Manejar desconexión
ws.onclose = () => {
    console.log('Desconectado del servidor WebSocket');
};
```

## Ejemplo de Uso con Python

```python
import asyncio
import websockets
import json

async def configure_agent():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        # Ejemplo: Configurar un agente
        await websocket.send(json.dumps({
            "type": "configure_agent",
            "data": {
                "agent": {
                    "agentId": "mi-agente-001",
                    "contractId": "0x1234...",
                    "name": "Mi Agente",
                    "description": "Descripción del agente",
                    "status": "paused",
                    "gasLimit": "300000",
                    "maxPriorityFee": "1.5",
                    "owner": "0xabcd...",
                    "contractState": {
                        "paused": False
                    }
                },
                "functions": [],
                "schedule": None,
                "notifications": []
            }
        }))
        
        # Recibir respuesta
        response = await websocket.recv()
        print(f"Respuesta recibida: {response}")

# Ejecutar el cliente
asyncio.get_event_loop().run_until_complete(configure_agent())
``` 