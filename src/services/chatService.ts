// Generador de IDs únicos usando UUID v4
const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface SessionInfo {
  client_id: string;
  session_id: string;
  session_name: string;
}

export interface AgentResponse {
  type: string;
  content: string;
  metadata?: {
    path?: string;
    language?: string;
    session_id?: string;
    id?: string;
  };
}

interface BackendResponse {
  session_id: string;
  response: string;
}

export interface WebSocketResponse {
  type: 'message' | 'contexts_loaded' | 'context_created' | 'context_switched' | 'error';
  content: any;
  metadata?: {
    path?: string;
    language?: string;
    session_id?: string;
    id?: string;
  };
}

export class ChatService {
  private ws: WebSocket | null = null;
  private messageQueue: string[] = [];
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private clientId: string | null = null;
  private sessionId: string | null = null;
  private walletAddress: string | null = null;
  private messageHandler: ((message: AgentResponse) => void) | null = null;
  private connectionChangeHandler: ((connected: boolean) => void) | null = null;
  private sessionEstablishedHandler: ((sessionInfo: SessionInfo) => void) | null = null;

  constructor() {
    this.messageHandler = null;
    this.connectionChangeHandler = null;
    this.sessionEstablishedHandler = null;
    // Intentar recuperar el clientId del localStorage si hay una wallet
    const storedData = localStorage.getItem('chatService');
    if (storedData) {
      const data = JSON.parse(storedData);
      if (data.walletAddress) {
        this.clientId = data.clientId;
        this.walletAddress = data.walletAddress;
      }
    }
  }

  private saveState() {
    if (this.walletAddress && this.clientId) {
      localStorage.setItem('chatService', JSON.stringify({
        clientId: this.clientId,
        walletAddress: this.walletAddress
      }));
    }
  }

  private processCodeBlocks(text: string): AgentResponse[] {
    const responses: AgentResponse[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Añadir el texto antes del bloque de código como mensaje
      if (match.index > lastIndex) {
        const messageText = text.slice(lastIndex, match.index).trim();
        if (messageText) {
          responses.push({
            type: 'message',
            content: messageText
          });
        }
      }

      // Procesar el bloque de código
      const [, language, code] = match;
      if (language?.toLowerCase() === 'solidity') {
        const timestamp = new Date().getTime();
        const fileName = `contracts/Contract_${timestamp}.sol`;
        responses.push({
          type: 'file_create',
          content: code.trim(),
          metadata: {
            path: fileName,
            language: 'solidity'
          }
        });
      } else {
        // Si no es Solidity, lo tratamos como parte del mensaje
        responses.push({
          type: 'message',
          content: match[0]
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Añadir el texto restante como mensaje
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex).trim();
      if (remainingText) {
        responses.push({
          type: 'message',
          content: remainingText
        });
      }
    }

    return responses;
  }

  public connect(sessionId?: string, walletAddress?: string): void {
    // Prevent multiple connections
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        console.log('[ChatService] WebSocket connection already exists');
        return;
    }
    
    try {
      console.log('[ChatService] Attempting to connect to WebSocket');
      
      // Si hay una nueva wallet address y es diferente a la actual, limpiar el estado
      if (walletAddress && walletAddress !== this.walletAddress) {
        this.clientId = null;
        localStorage.removeItem('chatService');
      }
      
      this.walletAddress = walletAddress || null;
      
      // Construir la URL del WebSocket
      let url = 'ws://localhost:8000/ws/agent';
      
      // Si tenemos un sessionId y clientId, usarlos para la conexión
      if (sessionId && this.clientId) {
        url = `ws://localhost:8000/ws/agent/${this.clientId}/${sessionId}`;
      }
      
      // Añadir la dirección de la billetera como parámetro de consulta si está disponible
      if (this.walletAddress) {
        const wsUrl = new URL(url.replace('ws://', 'http://'));
        wsUrl.searchParams.append('wallet_address', this.walletAddress);
        url = wsUrl.toString().replace('http://', 'ws://');
      }
        
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[ChatService] Connected to chat agent');
        this.reconnectAttempts = 0;
        this.handleConnectionChange(true);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        console.log('[ChatService] Received message:', event.data);
        try {
          const data = JSON.parse(event.data);
          
          // Manejar el establecimiento de conexión
          if (data.type === 'connection_established') {
            this.handleConnectionEstablished(data);
            return;
          }

          // Manejar la carga de contextos
          if (data.type === 'contexts_loaded') {
            this.handleContextsLoaded(data.content);
            return;
          }

          // Manejar la creación de nuevo contexto
          if (data.type === 'context_created') {
            this.handleContextCreated(data.content);
            return;
          }

          // Manejar el cambio de contexto
          if (data.type === 'context_switched') {
            this.handleContextSwitched(data.content);
            return;
          }

          if (this.messageHandler) {
            this.messageHandler(data as AgentResponse);
          }
        } catch (error) {
          console.error('[ChatService] Error processing message:', error);
        }
      };

      this.ws.onerror = (error: Event) => {
        console.log('[ChatService] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[ChatService] Disconnected from chat agent');
        this.handleConnectionChange(false);
        this.tryReconnect();
      };
    } catch (error) {
      console.error('[ChatService] Connection error:', error);
      this.tryReconnect();
    }
  }

  private handleConnectionEstablished(data: any) {
    if (data.type === 'connection_established') {
      // Solo actualizar el clientId si no teníamos uno o si no hay wallet address
      if (!this.clientId || !this.walletAddress) {
        this.clientId = data.client_id;
      }
      this.sessionId = data.session_id;
      console.log('[ChatService] Connection established with ID:', this.clientId);
      
      // Guardar el estado si hay wallet address
      this.saveState();
      
      if (this.sessionEstablishedHandler) {
        this.sessionEstablishedHandler({
          client_id: this.clientId,
          session_id: data.session_id,
          session_name: data.session_name
        });
      }
    }
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      
      console.log(`[ChatService] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.log('[ChatService] Max reconnection attempts reached');
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    // No limpiar el clientId ni el walletAddress al desconectar
  }

  public sendMessage(content: string, context: any = {}, contextId?: string, type: string = 'message'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket is not connected');
      return;
    }

    const message = {
      type,
      content,
      contextId,
      context: {
        ...context,
        clientId: this.clientId,
        sessionId: this.sessionId,
        walletAddress: this.walletAddress
      }
    };

    console.log('[ChatService] Sending message:', message);
    this.ws.send(JSON.stringify(message));
  }

  public onMessage(handler: (message: AgentResponse) => void): void {
    this.messageHandler = handler;
  }

  public onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionChangeHandler = handler;
  }

  public onSessionEstablished(handler: (sessionInfo: SessionInfo) => void): void {
    this.sessionEstablishedHandler = handler;
  }

  public getClientId(): string | null {
    return this.clientId;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  private handleMessage(message: AgentResponse) {
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  private handleConnectionChange(connected: boolean) {
    if (this.connectionChangeHandler) {
      this.connectionChangeHandler(connected);
    }
  }

  private handleSessionEstablished(sessionInfo: SessionInfo) {
    if (this.sessionEstablishedHandler) {
      this.sessionEstablishedHandler(sessionInfo);
    }
  }

  private handleContextsLoaded(contexts: any[]): void {
    console.log('[ChatService] Contexts loaded:', contexts);
    if (this.messageHandler) {
      this.messageHandler({
        type: 'contexts_loaded',
        content: contexts,
        metadata: {}
      } as WebSocketResponse);
    }
  }

  private handleContextCreated(context: any): void {
    console.log('[ChatService] Context created:', context);
    if (this.messageHandler) {
      this.messageHandler({
        type: 'context_created',
        content: context,
        metadata: {}
      } as WebSocketResponse);
    }
  }

  private handleContextSwitched(context: any): void {
    console.log('[ChatService] Context switched:', context);
    if (this.messageHandler) {
      this.messageHandler({
        type: 'context_switched',
        content: context,
        metadata: {}
      } as WebSocketResponse);
    }
  }
} 