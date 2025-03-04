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
  workspaces?: {
    [id: string]: {
      id: string;
      name: string;
      description?: string;
      files: {
        [path: string]: {
          content: string;
          language: string;
          timestamp: number;
        }
      };
      createdAt: number;
      updatedAt: number;
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

  public connect(walletAddress?: string, chatId?: string): void {
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      console.log('[ChatService] No valid wallet address provided, connection aborted');
      return;
    }

    // Si ya hay una conexión activa y es la misma wallet, no reconectar
    if (this.ws && 
        (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) &&
        this.walletAddress === walletAddress) {
      console.log('[ChatService] Active connection exists for this wallet');
      return;
    }
    
    try {
      console.log('[ChatService] Attempting to connect to WebSocket');
      
      this.walletAddress = walletAddress;
      
      // Construir la URL del WebSocket basada en el entorno
      let url = import.meta.env.MODE === 'production' 
        ? import.meta.env.VITE_WS_URL_PROD 
        : import.meta.env.VITE_WS_URL_DEV;

      // Si no hay URL configurada, usar la URL por defecto
      if (!url) {
        console.warn('[ChatService] No WebSocket URL configured for environment, using default');
        url = 'ws://localhost:8000/ws/agent';
      }

      // Asegurarse de que la URL use el protocolo WebSocket correcto
      const wsUrl = new URL(url.replace(/^(ws|wss):\/\//, 'http://'));
      wsUrl.searchParams.append('wallet_address', this.walletAddress);
      
      // Solo añadir chat_id si está disponible y es válido
      if (chatId && chatId.length > 0) {
        this.currentChatId = chatId;
        wsUrl.searchParams.append('chat_id', chatId);
        console.log(`[ChatService] Including chat_id in WebSocket URL: ${chatId}`);
      } else {
        console.log('[ChatService] Connecting without chat_id, will load existing chats');
      }
      
      // Restaurar el protocolo WebSocket
      url = wsUrl.toString().replace(/^http:\/\//, url.startsWith('wss://') ? 'wss://' : 'ws://');
      console.log(`[ChatService] Connecting to WebSocket URL: ${url}`);
        
      // Cerrar cualquier conexión existente antes de crear una nueva
      if (this.ws) {
        this.ws.close();
        this.ws = null;
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
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (parseError) {
            console.error('[ChatService] Error parsing WebSocket message:', parseError);
            return;
          }

          // Manejar la carga de chats
          if (data.type === 'contexts_loaded') {
            this.handleChatsLoaded(data.content);
            
            // Si no hay chat_id actual pero hay chats cargados, usar el más reciente
            if (!this.currentChatId && data.content && data.content.length > 0) {
              const mostRecentChat = data.content[data.content.length - 1];
              this.currentChatId = mostRecentChat.id;
              console.log(`[ChatService] Setting current chat to most recent: ${this.currentChatId}`);
              
              // Notificar el cambio de chat
              if (this.messageHandler) {
                this.messageHandler({
                  type: 'context_switched',
                  content: mostRecentChat
                });
              }
            }
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
          
          // Handle context synchronization response
          if (data.type === 'contexts_synced') {
            console.log('[ChatService] Contexts synced with server:', data.content);
            if (this.messageHandler) {
              this.messageHandler({
                type: 'contexts_synced',
                content: data.content
              });
            }
            return;
          }

          // Solo procesar mensajes que sean respuestas a mensajes del usuario
          if (data.type === 'message') {
            // For all message types, regardless of isUserResponse flag
            if (this.messageHandler) {
              console.log(`[ChatService] Processing message:`, data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''));
              
              // If explicitly marked as a user response, use buffering
              if (data.isUserResponse) {
                this.bufferMessage(data);
              } else {
                // Otherwise process immediately for better responsiveness
                this.messageHandler(data as AgentResponse);
              }
            }
          } else if (data.type === 'code_edit' || data.type === 'file_create') {
            // Process code edits and file creations immediately (no buffering)
            if (this.messageHandler) {
              console.log(`[ChatService] Immediate processing of ${data.type} message`);
              this.messageHandler(data as AgentResponse);
            }
          } else if (data.type !== 'message' && this.messageHandler) {
            // Other non-message types are processed immediately 
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
        this.connect(this.walletAddress || undefined, this.currentChatId || undefined);
      }, delay);
    } else {
      console.log('[ChatService] Max reconnection attempts reached');
    }
  }

  public disconnect(): void {
    if (!this.ws) return;
    
    if (this.ws.readyState === WebSocket.OPEN) {
      console.log('[ChatService] Disconnecting from chat agent');
      this.ws.close();
    }
    
    // Limpiar el temporizador si existe
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.ws = null;
    this.handleConnectionChange(false);
  }

  /**
   * Verifica si el WebSocket está actualmente conectado
   * @returns true si está conectado, false en caso contrario
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
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
    
    // Usar el chatId proporcionado, o el actual, o generar un error si ninguno está disponible
    const effectiveChatId = chatId || this.currentChatId;
    
    if (!effectiveChatId) {
      console.error('[ChatService] Cannot send message without a chat ID');
      return;
    }
    
    console.log(`[ChatService] Sending message with chat ID: ${effectiveChatId}, current chat ID: ${this.currentChatId}`);
    
    // Si el chatId proporcionado es diferente al actual, actualizarlo
    if (chatId && chatId !== this.currentChatId) {
      console.log(`[ChatService] Updating current chat ID from ${this.currentChatId} to ${chatId}`);
      this.currentChatId = chatId;
    }

    const message = {
      type: context.type || 'message',
      content,
      chat_id: effectiveChatId,
      isUserResponse: true, // Marcar que este es un mensaje del usuario
      context: {
        ...context,
        wallet_address: this.walletAddress
      }
    };

    console.log(`[ChatService] Sending message to agent with ID ${effectiveChatId}:`, { messageType: message.type });
    this.ws.send(JSON.stringify(message));
  }

  public createNewChat(name?: string, customChatId?: string): void {
    if (!this.walletAddress || !this.walletAddress.startsWith('0x')) {
      console.error('[ChatService] Cannot create chat without a valid wallet address');
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket is not connected');
      return;
    }
    
    // Si se proporciona un ID personalizado, usarlo
    if (customChatId) {
      this.currentChatId = customChatId;
      console.log(`[ChatService] Using custom chat ID: ${customChatId}`);
    }

    const message = {
      type: 'create_context',
      content: name || '',
      chat_id: customChatId || this.currentChatId, // Incluir el chat_id si está disponible
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
    
    // Enviar mensaje de cambio de chat al servidor
    const message = {
      type: 'switch_context',
      chat_id: chatId,
      content: '',
      context: {
        wallet_address: this.walletAddress
      }
    };

    console.log('[ChatService] Sending switch context message:', message);
    this.ws.send(JSON.stringify(message));
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
    
    // Check for null before processing
    if (!chats || !Array.isArray(chats)) {
      console.error('[ChatService] Received null or invalid chats from server:', chats);
      return;
    }
    
    // Si no hay chat activo pero hay chats disponibles, usar el más reciente
    if (!this.currentChatId && chats.length > 0) {
      const mostRecentChat = chats[chats.length - 1];
      this.currentChatId = mostRecentChat.id;
      console.log(`[ChatService] Setting current chat to most recent: ${this.currentChatId}`);
    }
    
    // Buscar el chat activo explícitamente por ID
    let activeChat = chats.find(chat => chat.id === this.currentChatId);
    if (!activeChat && chats.length > 0) {
      // Si no se encuentra el chat activo, usar el último chat
      activeChat = chats[chats.length - 1];
      this.currentChatId = activeChat.id;
      console.log(`[ChatService] No active chat found with ID ${this.currentChatId}, using last chat: ${activeChat.id}`);
    }
    
    // Procesar los archivos del chat activo
    if (activeChat && activeChat.virtualFiles) {
      console.log('[ChatService] Active chat virtual files:', activeChat.virtualFiles);
      try {
        console.log('[ChatService] Clearing virtual file system...');
        await virtualFS.clear();
        console.log('[ChatService] Virtual file system cleared');
        
        // Restore files from the active chat
        console.log('[ChatService] Restoring active files');
        const filePromises = Object.entries(activeChat.virtualFiles).map(
          async ([path, file]) => {
            const fileData = file as {
              content: string;
              language: string;
              timestamp: number;
            };
            
            if (path && fileData && fileData.content) {
              try {
                console.log(`[ChatService] Restoring file: ${path}`);
                await virtualFS.writeFile(path, fileData.content);
                console.log(`[ChatService] Successfully restored file: ${path}`);
              } catch (error) {
                console.error(`[ChatService] Failed to restore file ${path}:`, error);
              }
            } else {
              console.warn(`[ChatService] Invalid file data for path ${path}:`, fileData);
            }
          }
        );
        
        await Promise.all(filePromises);
        console.log('[ChatService] All files restored successfully');
      } catch (error) {
        console.error('[ChatService] Error processing virtual files:', error);
      }
    } else {
      console.warn('[ChatService] No active chat or virtual files found');
    }
    
    // Notificar a todos los handlers de forma sincrónica
    if (this.chatsLoadedHandler) {
      console.log('[ChatService] Notifying chats loaded handler with chats:', chats);
      this.chatsLoadedHandler(chats);
    } else {
      console.warn('[ChatService] No chats loaded handler registered');
    }

    // Notificar explícitamente sobre el cambio de contexto
    if (activeChat && this.messageHandler) {
      console.log('[ChatService] Sending context_switched event for chat:', activeChat.id);
      this.messageHandler({
        type: 'context_switched',
        content: JSON.stringify(activeChat)
      });
    } else {
      console.warn('[ChatService] Cannot send context_switched event (no active chat or message handler)');
    }
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
      content: '',
      context: {
        wallet_address: this.walletAddress
      }
    };

    console.log('[ChatService] Deleting context:', message);
    this.ws.send(JSON.stringify(message));
    
    // Si el contexto actual es el que se está eliminando, limpiar la referencia
    if (this.currentChatId === contextId) {
      console.log('[ChatService] Clearing current chat ID as it was deleted');
      this.currentChatId = null;
    }
  }

  // New method to buffer messages
  private bufferMessage(data: AgentResponse): void {
    // Special handling for code_edit - these should be processed immediately
    if (data.type === 'code_edit' && this.messageHandler) {
      console.log('[ChatService] Immediate processing of code_edit message');
      this.messageHandler(data);
      return;
    }
    
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
    
    // Set a new timeout to process the buffer - use shorter time window for certain message types
    const timeWindow = (data.type === 'file_create' || data.content.includes('```') || data.type === 'message') 
      ? 200  // Shorter window for code blocks, file_create, and regular messages
      : this.bufferTimeWindow;
    
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
    }, timeWindow);
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

  // New method to sync contexts with database
  public syncContextsWithDatabase(dbContexts: ChatInfo[]): void {
    // Verificar que tengamos contextos de la base de datos para sincronizar
    if (!dbContexts || dbContexts.length === 0) {
      console.warn('[ChatService] No database contexts to sync');
      return;
    }

    // Verificar que el WebSocket esté abierto
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] Cannot sync contexts with database - WebSocket not connected');
      return;
    }

    try {
      console.log('[ChatService] Syncing database contexts with WebSocket:', dbContexts);
      
      // Si el chatId actual no está establecido, usar el ID del primer contexto
      if (!this.currentChatId && dbContexts.length > 0) {
        this.currentChatId = dbContexts[0].id;
        console.log('[ChatService] Setting current chat ID to first database context:', this.currentChatId);
      }
      
      // Convertir los contextos al formato esperado por el WebSocket
      const serializedContexts = dbContexts.map(ctx => ({
        id: ctx.id,
        name: ctx.name,
        messages: ctx.messages || [],
        virtualFiles: ctx.virtualFiles || {},
        type: 'chat',
        wallet_address: ctx.wallet_address
      }));
      
      // Enviar mensaje de sincronización de contextos al WebSocket
      const message = {
        type: 'sync_contexts',
        content: JSON.stringify(serializedContexts)
      };
      
      this.ws.send(JSON.stringify(message));
      console.log('[ChatService] Sent sync_contexts message to WebSocket');
    } catch (error) {
      console.error('[ChatService] Error syncing contexts with database:', error);
    }
  }

  private detectLanguage(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'sol':
        return 'solidity';
      case 'js':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'jsx':
        return 'javascriptreact';
      case 'tsx':
        return 'typescriptreact';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'py':
        return 'python';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      default:
        return 'plaintext';
    }
  }
} 