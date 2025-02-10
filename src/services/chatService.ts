// Generador de IDs únicos usando UUID v4
const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface SessionInfo {
  clientId: string;
  sessionId: string;
  sessionName: string;
}

export interface AgentResponse {
  type: 'message' | 'code_edit' | 'file_create' | 'file_delete';
  content: string;
  metadata?: {
    fileName?: string;
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

          if (this.messageHandler) {
            if (typeof data === 'string') {
              const responses = this.processCodeBlocks(data);
              responses.forEach(response => {
                this.messageHandler!({
                  ...response,
                  metadata: {
                    ...response.metadata,
                    session_id: this.sessionId,
                    id: generateUniqueId()
                  }
                });
              });
            } else if ('session_id' in data && 'response' in data) {
              const backendResponse = data as BackendResponse;
              const responses = this.processCodeBlocks(backendResponse.response);
              responses.forEach(response => {
                this.messageHandler!({
                  ...response,
                  metadata: {
                    ...response.metadata,
                    session_id: backendResponse.session_id,
                    id: generateUniqueId()
                  }
                });
              });
            } else if ('type' in data && 'content' in data) {
              this.messageHandler({
                ...data,
                metadata: {
                  ...data.metadata,
                  session_id: this.sessionId,
                  id: generateUniqueId()
                }
              } as AgentResponse);
            } else {
              console.warn('[ChatService] Unknown message format:', data);
            }
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
          clientId: this.clientId,
          sessionId: data.session_id,
          sessionName: data.session_name
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

  public sendMessage(content: string, context: any = {}): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket is not connected');
      return;
    }

    const message = {
      content,
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
} 