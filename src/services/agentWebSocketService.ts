import { AgentConfiguration } from '../components/AgentConfigForm';

export type WebSocketMessageType = 
  | 'create_contract'
  | 'create_contract_response'
  | 'create_agent'
  | 'create_agent_response'
  | 'create_function'
  | 'create_function_response'
  | 'create_schedule'
  | 'create_schedule_response'
  | 'create_notification'
  | 'create_notification_response'
  | 'configure_agent'
  | 'configure_agent_response'
  | 'agent_configured'
  | 'start_agent'
  | 'agent_started'
  | 'stop_agent'
  | 'agent_stopped'
  | 'execute'
  | 'execute_response'
  | 'error'
  | 'log'
  | 'status';

interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
}

interface AgentConnection {
  socket: WebSocket;
  handlers: Map<string, ((message: any) => void)[]>;
}

export class AgentWebSocketService {
  private static instance: AgentWebSocketService;
  private connections: Map<string, AgentConnection> = new Map();
  private configurationInProgress: boolean = false;

  private constructor() {}

  public static getInstance(): AgentWebSocketService {
    if (!AgentWebSocketService.instance) {
      AgentWebSocketService.instance = new AgentWebSocketService();
    }
    return AgentWebSocketService.instance;
  }

  public connect(agentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Si ya existe una conexión para este agente, la cerramos
      if (this.connections.has(agentId)) {
        this.disconnect(agentId);
      }

      // Obtener la URL base del WebSocket del entorno
      const wsUrl = import.meta.env.MODE === 'production'
        ? import.meta.env.VITE_WS_URL_PROD
        : import.meta.env.VITE_WS_AGENT_URL_DEV || 'ws://localhost:8765';

      // Construir la URL completa según la documentación
      const fullWsUrl = `${wsUrl}/ws/agent/${agentId}`;
      console.log('Connecting to WebSocket:', fullWsUrl);

      try {
        const socket = new WebSocket(fullWsUrl);
        const handlers = new Map<string, ((message: any) => void)[]>();

        socket.onopen = () => {
          console.log(`Connected to agent WebSocket service for agent ${agentId}`);
          this.emitForAgent(agentId, 'log', { message: 'Connected to agent service', type: 'info' });
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(agentId, message);
          } catch (error) {
            console.error(`Error parsing WebSocket message for agent ${agentId}:`, error);
            this.emitForAgent(agentId, 'error', { message: 'Error parsing message' });
          }
        };

        socket.onerror = (error) => {
          const errorMessage = `WebSocket connection error for agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          this.emitForAgent(agentId, 'error', { message: errorMessage });
          reject(new Error(errorMessage));
        };

        socket.onclose = (event) => {
          const closeMessage = `WebSocket closed for agent ${agentId}. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`;
          console.log(closeMessage);
          this.emitForAgent(agentId, 'log', { 
            message: closeMessage,
            type: event.wasClean ? 'info' : 'warning'
          });
          // Limpiar la conexión cuando se cierra
          this.connections.delete(agentId);
        };

        // Guardar la nueva conexión
        this.connections.set(agentId, { socket, handlers });

      } catch (error) {
        const errorMessage = `Failed to create WebSocket connection: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      }
    });
  }

  public disconnect(agentId: string): void {
    const connection = this.connections.get(agentId);
    if (connection) {
      connection.socket.close();
      this.connections.delete(agentId);
    }
  }

  public disconnectAll(): void {
    for (const agentId of this.connections.keys()) {
      this.disconnect(agentId);
    }
  }

  public async configureAgent(agentId: string, config: AgentConfiguration): Promise<void> {
    if (this.configurationInProgress) {
      throw new Error('Another agent configuration is already in progress');
    }

    const connection = this.connections.get(agentId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket is not connected for agent ${agentId}`);
    }

    try {
      this.configurationInProgress = true;
      
      // Desconectar cualquier otra conexión existente
      for (const [existingId, existingConnection] of this.connections.entries()) {
        if (existingId !== agentId) {
          existingConnection.socket.close();
          this.connections.delete(existingId);
        }
      }

      console.log('Step 1: Creating contract...');
      // 1. Create contract
      await this.sendMessageToAgent(agentId, {
        type: 'create_contract',
        data: {
          ...config.contract,
          agent_id: agentId
        }
      });

      // Esperar un momento para asegurarse de que el contrato se ha guardado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Step 2: Creating agent...');
      // 2. Create agent base
      await this.sendMessageToAgent(agentId, {
        type: 'create_agent',
        data: {
          ...config.agent,
          agent_id: agentId
        }
      });

      // Esperar un momento para asegurarse de que el agente se ha guardado
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. Add functions
      if (config.functions && config.functions.length > 0) {
        console.log(`Step 3: Creating ${config.functions.length} functions...`);
        for (const func of config.functions) {
          await this.sendMessageToAgent(agentId, {
            type: 'create_function',
            data: {
              ...func,
              agent_id: agentId
            }
          });
          // Pequeña pausa entre funciones
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 4. Add schedule if exists
      if (config.schedule) {
        console.log('Step 4: Creating schedule...');
        await this.sendMessageToAgent(agentId, {
          type: 'create_schedule',
          data: {
            ...config.schedule,
            agent_id: agentId
          }
        });
        
        // Esperar un momento para asegurarse de que la programación se ha guardado
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 5. Add notifications if any
      if (config.notifications && config.notifications.length > 0) {
        console.log(`Step 5: Creating ${config.notifications.length} notifications...`);
        for (const notification of config.notifications) {
          await this.sendMessageToAgent(agentId, {
            type: 'create_notification',
            data: {
              ...notification,
              agent_id: agentId
            }
          });
          // Pequeña pausa entre notificaciones
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Pausa final antes del configure_agent
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Step 6: Finalizing agent configuration...');
      // 6. Finally, send configure_agent to complete setup
      await this.sendMessageToAgent(agentId, {
        type: 'configure_agent',
        data: { agent_id: agentId }
      });

      console.log('Agent configuration completed successfully');

    } catch (error) {
      console.error('Error configuring agent:', error);
      throw error;
    } finally {
      this.configurationInProgress = false;
    }
  }

  public startAgent(agentId: string): void {
    this.sendMessageToAgent(agentId, {
      type: 'start_agent',
      data: { agent_id: agentId }
    });
  }

  public stopAgent(agentId: string): void {
    this.sendMessageToAgent(agentId, {
      type: 'stop_agent',
      data: { agent_id: agentId }
    });
  }

  public executeAgent(agentId: string): void {
    this.sendMessageToAgent(agentId, {
      type: 'execute',
      data: { agent_id: agentId }
    });
  }

  public on(agentId: string, type: WebSocketMessageType, handler: (message: any) => void): void {
    const connection = this.connections.get(agentId);
    if (connection) {
      const handlers = connection.handlers.get(type) || [];
      handlers.push(handler);
      connection.handlers.set(type, handlers);
    }
  }

  public off(agentId: string, type: WebSocketMessageType, handler: (message: any) => void): void {
    const connection = this.connections.get(agentId);
    if (connection) {
      const handlers = connection.handlers.get(type) || [];
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        connection.handlers.set(type, handlers);
      }
    }
  }

  private emitForAgent(agentId: string, type: WebSocketMessageType, data: any): void {
    const connection = this.connections.get(agentId);
    if (connection) {
      const handlers = connection.handlers.get(type) || [];
      handlers.forEach(handler => handler(data));
    }
  }

  private async sendMessageToAgent(agentId: string, message: WebSocketMessage): Promise<any> {
    const connection = this.connections.get(agentId);
    if (connection && connection.socket.readyState === WebSocket.OPEN) {
      try {
        // Asegurar que el agent_id esté presente en todos los mensajes
        const messageWithAgentId = {
          ...message,
          data: {
            ...message.data,
            agent_id: agentId
          }
        };

        const messageString = JSON.stringify(messageWithAgentId);
        console.log(`Sending message to agent ${agentId}:`, messageString);
        connection.socket.send(messageString);

        // Wait for acknowledgment
        return new Promise((resolve, reject) => {
          const responseType = message.type === 'create_contract' ? 'create_contract_response' :
                             message.type === 'create_agent' ? 'create_agent_response' :
                             message.type === 'create_function' ? 'create_function_response' :
                             message.type === 'create_schedule' ? 'create_schedule_response' :
                             message.type === 'create_notification' ? 'create_notification_response' :
                             message.type === 'configure_agent' ? 'configure_agent_response' :
                             `${message.type}_response` as WebSocketMessageType;

          const errorType = 'error' as WebSocketMessageType;

          const handler = (response: any) => {
            console.log(`Received ${responseType} response:`, response);
            if (response.status === 'error') {
              reject(new Error(response.message || 'Unknown error'));
            } else {
              resolve(response);
            }
            // Remove the handler after receiving response
            this.off(agentId, responseType, handler);
          };
          
          const errorHandler = (error: any) => {
            if (error.message && error.message.includes(message.type)) {
              console.error(`Received error for ${message.type}:`, error);
              reject(new Error(error.message || 'Unknown error'));
              this.off(agentId, errorType, errorHandler);
              this.off(agentId, responseType, handler);
            }
          };
          
          // Add handlers
          this.on(agentId, responseType, handler);
          this.on(agentId, errorType, errorHandler);

          // Add timeout
          setTimeout(() => {
            this.off(agentId, responseType, handler);
            this.off(agentId, errorType, errorHandler);
            reject(new Error(`Timeout waiting for ${message.type} response`));
          }, 8000); // Aumentar el timeout a 8 segundos
        });

      } catch (error) {
        const errorMessage = `Error sending message to agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        this.emitForAgent(agentId, 'error', { message: errorMessage });
        throw error;
      }
    } else {
      const errorMessage = `WebSocket is not connected for agent ${agentId}. State: ${connection?.socket.readyState}`;
      console.error(errorMessage);
      this.emitForAgent(agentId, 'error', { message: errorMessage });
      throw new Error(errorMessage);
    }
  }

  private handleMessage(agentId: string, message: WebSocketMessage): void {
    this.emitForAgent(agentId, message.type, message.data);

    console.log(`Received message of type ${message.type} for agent ${agentId}:`, message.data);

    // Manejar respuestas específicas
    switch (message.type) {
      case 'agent_configured':
        if (message.data.status === 'error') {
          this.emitForAgent(agentId, 'error', { message: message.data.message });
        } else {
          console.log(`Agent ${agentId} configured successfully`);
        }
        break;

      case 'create_contract_response':
        if (message.data.status === 'error') {
          this.emitForAgent(agentId, 'error', { message: message.data.message });
        } else {
          console.log(`Contract created successfully for agent ${agentId}`);
        }
        break;

      case 'create_agent_response':
        if (message.data.status === 'error') {
          this.emitForAgent(agentId, 'error', { message: message.data.message });
        } else {
          console.log(`Agent ${agentId} created successfully`);
        }
        break;

      case 'status':
        // Actualizar estado del agente específico
        break;

      case 'error':
        console.error(`Agent error for ${agentId}:`, message.data.message);
        break;
    }
  }
} 