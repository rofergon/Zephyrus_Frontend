# Guía de Integración de Agentes con la API

Esta documentación describe el proceso para crear y configurar agentes completos usando la API del sistema Zephyrus. Está basada en la implementación y pruebas realizadas durante el desarrollo.

## Índice

- [Requisitos Previos](#requisitos-previos)
- [Flujo Completo](#flujo-completo)
- [Estructura de Datos](#estructura-de-datos)
- [Endpoints de la API](#endpoints-de-la-api)
- [Paso a Paso](#paso-a-paso)
- [Ejemplos de Código](#ejemplos-de-código)
- [Solución de Problemas](#solución-de-problemas)

## Requisitos Previos

Antes de comenzar a crear agentes, asegúrate de que:

1. El servidor API está ejecutándose correctamente
2. Tienes acceso a los endpoints `/api/db/*`
3. Dispones de una wallet válida para asociar con los contratos y agentes

## Flujo Completo

La creación de un agente completo requiere estos pasos secuenciales:

1. **Crear el contrato en la tabla `contracts`** - Esto es fundamental debido a la restricción de clave foránea
2. **Crear el agente base** - Asociado al contrato creado
3. **Añadir funciones al agente** - Las funciones que el agente podrá ejecutar
4. **Configurar programación** - Establecer cuándo y con qué frecuencia se ejecutará
5. **Configurar notificaciones** (opcional) - Establece cómo se notificarán los eventos del agente

## Estructura de Datos

### Contrato (paso 1)

```json
{
  "contract_id": "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
  "address": "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
  "chain_id": 11155111,
  "name": "TestToken",
  "type": "ERC20",
  "abi": "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"spender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"approve\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
  "deployed_at": "2025-03-07T04:37:44.383Z",
  "owner_address": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
}
```

### Agente (paso 2)

```json
{
  "contractId": "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
  "name": "Smart Contract Agent",
  "description": "asdfwefsdfwef",
  "status": "paused", 
  "gas_limit": "300000",
  "max_priority_fee": "1.5",
  "owner": "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
  "contract_state": {
    "paused": false,
    "symbol": "TST"
  }
}
```

### Función (paso 3)

```json
{
  "function_name": "approve",
  "function_signature": "approve(address,uint256)",
  "function_type": "write",
  "is_enabled": true,
  "validation_rules": {
    "spender": {},
    "value": {}
  },
  "abi": {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
}
```

### Programación (paso 4)

```json
{
  "schedule_type": "cron",
  "cron_expression": "0 0 * * *",
  "is_active": true
}
```

### Notificación (paso 5, opcional)

```json
{
  "notification_type": "discord",
  "configuration": {
    "webhook_url": "https://discord.com/api/webhooks/..."
  },
  "is_enabled": true
}
```

## Endpoints de la API

### 1. Crear Contrato
- **Endpoint**: `POST /api/db/contracts/create`
- **Uso**: Crea un contrato en la tabla `contracts` (no en `deployed_contracts`)

### 2. Crear Agente
- **Endpoint**: `POST /api/db/agents`
- **Uso**: Crea un agente base asociado a un contrato existente

### 3. Crear Función
- **Endpoint**: `POST /api/db/agents/:agentId/functions`
- **Uso**: Añade una función al agente

### 4. Crear Programación
- **Endpoint**: `POST /api/db/agents/:agentId/schedules`
- **Uso**: Configura la programación de ejecución del agente

### 5. Crear Notificación
- **Endpoint**: `POST /api/db/agents/:agentId/notifications`
- **Uso**: Configura las notificaciones del agente

## Paso a Paso

### 1. Crear el Contrato

Este paso es **crucial** porque la tabla `agents` tiene una restricción de clave foránea con la tabla `contracts`.

```javascript
const contractData = {
  contract_id: "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
  address: "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
  chain_id: 11155111, // Sepolia
  name: "TestToken",
  type: "ERC20",
  abi: JSON.stringify([{/* ... */}]),
  deployed_at: new Date().toISOString(),
  owner_address: "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
};

const contractResponse = await fetch('http://localhost:3000/api/db/contracts/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(contractData)
});

// Verificar respuesta
const contractResult = await contractResponse.json();
console.log('Contrato creado:', contractResult);
```

### 2. Crear el Agente Base

Con el contrato creado, ahora podemos crear el agente que hace referencia a ese contrato:

```javascript
const agentData = {
  contractId: "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
  name: "Smart Contract Agent",
  description: "asdfwefsdfwef",
  status: "paused",
  gas_limit: "300000",
  max_priority_fee: "1.5",
  owner: "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
  contract_state: {
    paused: false,
    symbol: "TST"
  }
};

const agentResponse = await fetch('http://localhost:3000/api/db/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(agentData)
});

// Verificar respuesta
const agentResult = await agentResponse.json();
const agentId = agentResult.agent_id;
console.log('Agente creado con ID:', agentId);
```

### 3. Añadir Función al Agente

Una vez creado el agente, podemos añadirle funciones:

```javascript
const functionData = {
  function_name: "approve",
  function_signature: "approve(address,uint256)",
  function_type: "write",
  is_enabled: true,
  validation_rules: {
    spender: {},
    value: {}
  },
  abi: {/* ... */}
};

const functionResponse = await fetch(`http://localhost:3000/api/db/agents/${agentId}/functions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(functionData)
});

// Verificar respuesta
const functionResult = await functionResponse.json();
console.log('Función creada con ID:', functionResult.function_id);
```

### 4. Configurar Programación

Para establecer cuándo se ejecutará el agente:

```javascript
const scheduleData = {
  schedule_type: "cron",
  cron_expression: "0 0 * * *", // Una vez al día a medianoche
  is_active: true
};

const scheduleResponse = await fetch(`http://localhost:3000/api/db/agents/${agentId}/schedules`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(scheduleData)
});

// Verificar respuesta
const scheduleResult = await scheduleResponse.json();
console.log('Programación creada con ID:', scheduleResult.schedule_id);
```

### 5. Configurar Notificaciones (opcional)

Si deseas configurar notificaciones:

```javascript
const notificationData = {
  notification_type: "discord",
  configuration: {
    webhook_url: "https://discord.com/api/webhooks/..."
  },
  is_enabled: true
};

const notificationResponse = await fetch(`http://localhost:3000/api/db/agents/${agentId}/notifications`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(notificationData)
});

// Verificar respuesta
const notificationResult = await notificationResponse.json();
console.log('Notificación creada con ID:', notificationResult.notification_id);
```

## Ejemplos de Código

### Flujo Completo en JavaScript

```javascript
// Paso 1: Crear Contrato
const createContract = async () => {
  try {
    const contractData = {
      contract_id: "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
      address: "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
      chain_id: 11155111,
      name: "TestToken",
      type: "ERC20",
      abi: JSON.stringify([{
        "inputs": [
          { "internalType": "address", "name": "spender", "type": "address" },
          { "internalType": "uint256", "name": "value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
      }]),
      deployed_at: new Date().toISOString(),
      owner_address: "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
    };
    
    const contractResponse = await fetch('http://localhost:3000/api/db/contracts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contractData)
    });
    
    if (!contractResponse.ok) {
      throw new Error(`Error creating contract: ${await contractResponse.text()}`);
    }
    
    return await contractResponse.json();
  } catch (error) {
    console.error('Error in createContract:', error);
    throw error;
  }
};

// Paso 2: Crear Agente
const createAgent = async () => {
  try {
    const agentData = {
      contractId: "0x3ded337a401e234d40cf2a54d9291bf61692ca07",
      name: "Smart Contract Agent",
      description: "asdfwefsdfwef",
      status: "paused",
      gas_limit: "300000",
      max_priority_fee: "1.5",
      owner: "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
      contract_state: {
        paused: false,
        symbol: "TST"
      }
    };
    
    const agentResponse = await fetch('http://localhost:3000/api/db/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData)
    });
    
    if (!agentResponse.ok) {
      throw new Error(`Error creating agent: ${await agentResponse.text()}`);
    }
    
    return await agentResponse.json();
  } catch (error) {
    console.error('Error in createAgent:', error);
    throw error;
  }
};

// Ejecución principal
async function main() {
  try {
    // 1. Crear contrato
    console.log('Creando contrato...');
    const contractResult = await createContract();
    console.log('Contrato creado:', contractResult);
    
    // 2. Crear agente
    console.log('Creando agente...');
    const agentResult = await createAgent();
    const agentId = agentResult.agent_id;
    console.log('Agente creado con ID:', agentId);
    
    // 3. Añadir función
    console.log('Añadiendo función...');
    // ... código para añadir función
    
    // 4. Configurar programación
    console.log('Configurando programación...');
    // ... código para configurar programación
    
    console.log('Proceso completo terminado con éxito');
  } catch (error) {
    console.error('Error en el proceso principal:', error);
  }
}

main();
```

## Solución de Problemas

### Error: SQLITE_CONSTRAINT: FOREIGN KEY constraint failed

**Problema**: Al intentar crear un agente, recibes un error de restricción de clave foránea.

**Causa**: Estás intentando asociar el agente a un `contractId` que no existe en la tabla `contracts`.

**Solución**: Asegúrate de crear primero el contrato usando el endpoint `/api/db/contracts/create` con el mismo `contract_id` que usarás para el agente.

```javascript
// Primero crear el contrato
await fetch('/api/db/contracts/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contract_id: "0x123...", // Este ID debe usarse después
    // ... resto de datos
  })
});

// Luego crear el agente con el mismo ID
await fetch('/api/db/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contractId: "0x123...", // Debe coincidir con el contract_id anterior
    // ... resto de datos
  })
});
```

### Error: req.body is undefined

**Problema**: Los datos enviados no se están procesando correctamente.

**Causa**: Falta el middleware `express.json()` en el servidor.

**Solución**: Asegúrate de que el servidor tenga configurado:

```javascript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

### Error al validar los campos

**Problema**: Recibes errores de validación al enviar datos.

**Causa**: Campos obligatorios faltantes o mal formateados.

**Solución**: Verifica que todos los campos requeridos estén presentes y tengan el formato correcto:

- Para contratos: `contract_id`, `address`, `chain_id`, `name`, `type`, `abi`, `deployed_at`, `owner_address`
- Para agentes: `contractId`, `name`, `owner`
- Para funciones: `function_name`, `function_signature`, `function_type`
- Para programaciones: `schedule_type` y `cron_expression` o `interval_seconds` dependiendo del tipo 