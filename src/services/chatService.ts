import { virtualFS } from './virtual-fs';

// Generador de IDs únicos usando UUID v4

export interface ChatInfo {
  id: string;
  name: string;
  wallet_address: string;
  created_at: string;
  last_accessed: string;
  messages: any[];
  type: string;
  generatedCode?: {
    content: string;
    path?: string;
    language?: string;
  };
  virtualFiles?: {
    [path: string]: {
      content: string;
      language: string;
      timestamp: number;
    }
  };
}

export interface AgentResponse {
  type: string;
  content: string;
  metadata?: {
    path?: string;
    language?: string;
    chat_id?: string;
    id?: string;
  };
}

export interface WebSocketResponse {
  type: 'message' | 'contexts_loaded' | 'context_created' | 'context_switched' | 'error' | 'file_create';
  content: any;
  metadata?: {
    path?: string;
    language?: string;
    chat_id?: string;
    id?: string;
  };
}

export class ChatService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private walletAddress: string | null = null;
  private currentChatId: string | null = null;
  private messageHandler: ((message: AgentResponse) => void) | null = null;
  private connectionChangeHandler: ((connected: boolean) => void) | null = null;
  private chatsLoadedHandler: ((chats: ChatInfo[]) => void) | null = null;
  
  // Message buffering system
  private messageBuffer: string = '';
  private messageBufferTimeout: NodeJS.Timeout | null = null;
  private bufferTimeWindow: number = 500; // Time in ms to wait before processing buffered messages (no longer readonly)
  private messageMetadata: any = null; // Store metadata from first message
  private readonly paragraphThreshold: number = 500; // Minimum length to consider processing paragraphs separately
  private debugBuffering: boolean = false; // Debug option to log buffering decisions

  constructor() {
    this.messageHandler = null;
    this.connectionChangeHandler = null;
    this.chatsLoadedHandler = null;
  }

  public connect(walletAddress?: string, _p0?: string): void {
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      console.log('[ChatService] No valid wallet address provided, connection aborted');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('[ChatService] WebSocket connection already exists');
      return;
    }
    
    try {
      console.log('[ChatService] Attempting to connect to WebSocket');
      
      this.walletAddress = walletAddress;
      
      // Construir la URL del WebSocket
      let url = 'ws://localhost:8000/ws/agent';
      
      // Añadir la dirección de la billetera como parámetro de consulta
      const wsUrl = new URL(url.replace('ws://', 'http://'));
      wsUrl.searchParams.append('wallet_address', this.walletAddress);
      url = wsUrl.toString().replace('http://', 'ws://');
        
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

          // Manejar la carga de chats
          if (data.type === 'contexts_loaded') {
            this.handleChatsLoaded(data.content);
            return;
          }

          // Manejar la creación de nuevo chat
          if (data.type === 'context_created') {
            this.handleChatCreated(data.content);
            return;
          }

          // Manejar el cambio de chat
          if (data.type === 'context_switched') {
            this.handleChatSwitched(data.content);
            return;
          }

          // Buffer AI messages to combine fragments into coherent paragraphs
          if (data.type === 'message' && this.messageHandler) {
            this.bufferMessage(data);
          } else if (this.messageHandler) {
            // For non-message types, process normally
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

  private tryReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      
      console.log(`[ChatService] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect(this.walletAddress || undefined);
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
  }

  public sendMessage(content: string, context: any = {}, chatId?: string): void {
    if (!this.walletAddress || !this.walletAddress.startsWith('0x')) {
      console.error('[ChatService] Cannot send message without a valid wallet address');
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket is not connected');
      return;
    }

    // No enviar mensajes vacíos a menos que sea un tipo específico de operación
    if (!content && context.type !== 'delete_context' && context.type !== 'create_context' && context.type !== 'switch_context') {
      console.log('[ChatService] Skipping empty message');
      return;
    }

    const message = {
      type: context.type || 'message',
      content,
      chat_id: chatId || this.currentChatId,
      context: {
        ...context,
        wallet_address: this.walletAddress
      }
    };

    console.log('[ChatService] Sending message:', message);
    this.ws.send(JSON.stringify(message));
  }

  public createNewChat(name?: string): void {
    if (!this.walletAddress || !this.walletAddress.startsWith('0x')) {
      console.error('[ChatService] Cannot create chat without a valid wallet address');
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket is not connected');
      return;
    }

    const message = {
      type: 'create_context',
      content: name || '',
      context: {
        wallet_address: this.walletAddress
      }
    };

    console.log('[ChatService] Creating new chat:', message);
    this.ws.send(JSON.stringify(message));
  }

  public switchChat(chatId: string): void {
    if (!this.walletAddress || !this.walletAddress.startsWith('0x')) {
      console.error('[ChatService] Cannot switch chat without a valid wallet address');
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket is not connected');
      return;
    }

    // Update current chat ID
    this.currentChatId = chatId;
    console.log('[ChatService] Switched to chat:', chatId);
  }

  public onMessage(handler: (message: AgentResponse) => void): void {
    this.messageHandler = handler;
  }

  public onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionChangeHandler = handler;
  }

  public onChatsLoaded(handler: (chats: ChatInfo[]) => void): void {
    this.chatsLoadedHandler = handler;
  }

  public getCurrentChatId(): string | null {
    return this.currentChatId;
  }

  public setCurrentChatId(chatId: string): void {
    this.currentChatId = chatId;
  }


  private handleConnectionChange(connected: boolean) {
    if (this.connectionChangeHandler) {
      this.connectionChangeHandler(connected);
    }
  }

  private async handleChatsLoaded(chats: ChatInfo[]) {
    console.log('[ChatService] Chats loaded:', chats);
    
    // Asegurarse de que los chats tengan la estructura correcta
    const processedChats = chats.map((chat, index) => ({
        ...chat,
        messages: Array.isArray(chat.messages) ? chat.messages : [],
        active: index === chats.length - 1,
        generatedCode: chat.generatedCode || null,
        virtualFiles: chat.virtualFiles || {}
    }));
    
    // Actualizar el chat ID actual
    if (processedChats.length > 0) {
        this.currentChatId = processedChats[processedChats.length - 1].id;
        
        // Restaurar archivos virtuales del chat activo
        const activeChat = processedChats[processedChats.length - 1];
        console.log('[ChatService] Active chat virtual files:', activeChat.virtualFiles);
        
        try {
            // Limpiar el sistema de archivos virtual antes de cargar los nuevos archivos
            console.log('[ChatService] Clearing virtual file system...');
            await virtualFS.clear();
            console.log('[ChatService] Virtual file system cleared');
            
            if (activeChat.virtualFiles) {
                // Los archivos ya vienen normalizados del backend (solo versiones activas)
                console.log('[ChatService] Restoring active files');
                await Promise.all(
                    Object.entries(activeChat.virtualFiles).map(async ([path, file]) => {
                        console.log(`[ChatService] Writing file: ${path}`);
                        try {
                            await virtualFS.writeFile(path, file.content);
                            console.log(`[ChatService] Successfully wrote file: ${path}`);
                        } catch (error) {
                            console.error(`[ChatService] Error writing file: ${path}`, error);
                        }
                    })
                );
            }
        } catch (error) {
            console.error('[ChatService] Error handling virtual files:', error);
        }
    }
    
    // Notificar a los handlers
    if (this.chatsLoadedHandler) {
        this.chatsLoadedHandler(processedChats.map(chat => ({
            ...chat,
            generatedCode: chat.generatedCode || undefined
        })));
    }
    if (this.messageHandler) {
        this.messageHandler({
            type: 'contexts_loaded',
            content: JSON.stringify(processedChats)
        });
    }
    
    console.log('[ChatService] Processed chats:', processedChats);
  }

  private handleChatCreated(chat: ChatInfo) {
    console.log('[ChatService] Chat created:', chat);
    this.currentChatId = chat.id;
    if (this.messageHandler) {
      this.messageHandler({
        type: 'context_created',
        content: JSON.stringify(chat)
      });
    }
  }

  private async handleChatSwitched(chat: ChatInfo) {
    console.log('[ChatService] Switching to chat:', chat);
    this.currentChatId = chat.id;
    
    try {
      // Limpiar el sistema de archivos virtual antes de cargar los nuevos archivos
      console.log('[ChatService] Clearing virtual file system...');
      await virtualFS.clear();
      console.log('[ChatService] Virtual file system cleared');
      
      // Restaurar los archivos virtuales del chat
      if (chat.virtualFiles) {
        console.log('[ChatService] Restoring virtual files for chat:', chat.id);
        await Promise.all(
          Object.entries(chat.virtualFiles).map(async ([path, file]) => {
            try {
              await virtualFS.writeFile(path, file.content);
              console.log('[ChatService] Restored file:', path);
            } catch (error) {
              console.error('[ChatService] Error restoring file:', path, error);
            }
          })
        );
      }
    } catch (error) {
      console.error('[ChatService] Error handling virtual files:', error);
    }
    
    if (this.messageHandler) {
      this.messageHandler({
        type: 'context_switched',
        content: JSON.stringify(chat)
      });
    }
  }

  public deleteContext(contextId: string): void {
    if (!this.walletAddress || !this.walletAddress.startsWith('0x')) {
      console.error('[ChatService] Cannot delete context without a valid wallet address');
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket is not connected');
      return;
    }

    const message = {
      type: 'delete_context',
      chat_id: contextId,
      context: {
        wallet_address: this.walletAddress
      }
    };

    console.log('[ChatService] Deleting context:', message);
    this.ws.send(JSON.stringify(message));
  }

  // New method to buffer messages
  private bufferMessage(data: AgentResponse): void {
    // Clear any existing timeout
    if (this.messageBufferTimeout) {
      clearTimeout(this.messageBufferTimeout);
    }
    
    // Add to buffer
    this.messageBuffer += data.content;
    
    // Store metadata from the first fragment if it exists
    if (data.metadata && !this.messageMetadata) {
      this.messageMetadata = data.metadata;
    }
    
    // Set a new timeout to process the buffer
    this.messageBufferTimeout = setTimeout(() => {
      if (this.messageBuffer && this.messageHandler) {
        // Check if we should process the buffer as paragraphs
        if (this.messageBuffer.length > this.paragraphThreshold) {
          this.processMessageBuffer();
        } else {
          // Create a new response with the buffered content
          const bufferedResponse: AgentResponse = {
            type: 'message',
            content: this.messageBuffer,
            metadata: this.messageMetadata
          };
          
          // Send the combined message to the handler
          this.messageHandler(bufferedResponse);
          
          // Clear the buffer and metadata
          this.messageBuffer = '';
          this.messageMetadata = null;
        }
      }
    }, this.bufferTimeWindow);
  }

  // Process the message buffer intelligently
  private processMessageBuffer(): void {
    if (!this.messageBuffer || !this.messageHandler) {
      return;
    }

    if (this.debugBuffering) {
      console.log('[ChatService] Processing message buffer:', this.messageBuffer.substring(0, 100) + '...');
    }

    // For messages containing code blocks, send the entire message as one unit
    if (this.messageBuffer.includes('```')) {
      if (this.debugBuffering) {
        console.log('[ChatService] Message contains code blocks, sending as single message');
      }
      
      const bufferedResponse: AgentResponse = {
        type: 'message',
        content: this.messageBuffer,
        metadata: this.messageMetadata
      };
      
      this.messageHandler(bufferedResponse);
    } 
    // For messages with markdown headings, preserve the formatting
    else if (/^#{1,6} .*$/m.test(this.messageBuffer)) {
      if (this.debugBuffering) {
        console.log('[ChatService] Message contains markdown headings, preserving format');
      }
      
      // Clean up the text by removing excessive newlines and normalizing spacing
      let cleanedText = this.messageBuffer
        .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with double newlines
        .trim();
      
      const bufferedResponse: AgentResponse = {
        type: 'message',
        content: cleanedText,
        metadata: this.messageMetadata
      };
      
      this.messageHandler(bufferedResponse);
    }
    // For normal text, combine into a single well-formed message
    else {
      if (this.debugBuffering) {
        console.log('[ChatService] Processing as regular text message');
      }
      
      // Clean up the text by removing excessive newlines and normalizing spacing
      let cleanedText = this.messageBuffer
        .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with double newlines
        .trim();
      
      const bufferedResponse: AgentResponse = {
        type: 'message',
        content: cleanedText,
        metadata: this.messageMetadata
      };
      
      this.messageHandler(bufferedResponse);
    }
    
    // Clear the buffer
    this.messageBuffer = '';
    this.messageMetadata = null;
  }

  // Enable/disable debug logging for message buffering
  public setDebugBuffering(enabled: boolean): void {
    this.debugBuffering = enabled;
  }
  
  // Customize the buffer time window
  public setBufferTimeWindow(timeMs: number): void {
    if (timeMs >= 100 && timeMs <= 2000) {
      if (this.debugBuffering) {
        console.log(`[ChatService] Setting buffer time window to ${timeMs}ms`);
      }
      this.bufferTimeWindow = timeMs;
    } else {
      console.warn('[ChatService] Invalid buffer time window. Must be between 100ms and 2000ms');
    }
  }
} 