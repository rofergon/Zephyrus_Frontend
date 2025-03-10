import { virtualFS } from './virtual-fs';
import { apiService } from '../services/apiService';

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
    forceReload?: boolean;
    isFullMessage?: boolean;
    containsCode?: boolean;
    noCompile?: boolean;
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
    forceReload?: boolean;
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
  
  // Variables para control de buffering
  private messageBuffer: string = '';
  private messageBufferTimeout: NodeJS.Timeout | null = null;
  private bufferTimeWindow: number = 5000; // Increased from 1500ms to 5000ms to accumulate more content
  private messageMetadata: any = null; // Store metadata from first message
  private debugBuffering: boolean = false; // Debug option to log buffering decisions
  private processingFullMessage: boolean = false; // Flag para evitar procesamiento simultáneo

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

      this.ws.onmessage = async (event: MessageEvent) => {
        console.log('[ChatService] Received message:', event.data);
        try {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (parseError) {
            console.error('[ChatService] Error parsing WebSocket message:', parseError);
            return;
          }

          // Manejar la confirmación de sincronización
          if (data.type === 'chat_synced') {
            console.log('[ChatService] Chat sync confirmed:', data.metadata.chat_id);
            if (this.messageHandler) {
              this.messageHandler({
                type: 'chat_synced',
                content: `Chat ${data.metadata.chat_id} synchronized successfully`,
                metadata: data.metadata
              });
            }
            return;
          }

          // Procesar mensajes de tipo file_create
          if (data.type === 'file_create') {
            console.log('[ChatService] Immediate processing of file_create message:', data);
            
            // Asegurar que el contenido esté en el formato correcto
            let processedContent = data.content;
            if (typeof data.content === 'object' && 'replace' in data.content) {
              processedContent = data.content.replace;
            }
            
            const processedData = {
              ...data,
              content: processedContent
            };

            if (this.messageHandler) {
              this.messageHandler(processedData as AgentResponse);
            }
            return;
          }

          // Manejar mensajes regulares del agente
          if (data.type === 'message') {
            console.log('[ChatService] Processing message:', data.content.substring(0, 50) + '...');
            
            // Proceso mejorado para mensajes regulares - buffer them
            if (this.processingFullMessage) {
              // Si ya estamos procesando un mensaje completo, acumular este fragmento
              this.bufferMessage(data as AgentResponse);
              return;
            }
            
            // Si el mensaje parece ser un fragmento de algo mayor, acumularlo
            if (data.content.length < 500 && 
                !(data.content.trim().endsWith('.') || data.content.trim().endsWith('?') || data.content.trim().endsWith('!'))) {
              // Parece un fragmento, lo agregamos al buffer
              this.bufferMessage(data as AgentResponse);
              return;
            }
            
            // Guardar el mensaje del agente en la base de datos
            if (this.currentChatId) {
              try {
                const timestamp = new Date().toISOString();
                await apiService.createMessage(
                  this.currentChatId,
                  data.content,
                  'ai',
                  {
                    ...data.metadata,
                    timestamp
                  }
                );
                console.log('[ChatService] Agent message saved to database');

                // Modificar el mensaje para incluir el timestamp antes de enviarlo al handler
                const messageWithTimestamp = {
                  ...data,
                  metadata: {
                    ...data.metadata,
                    timestamp
                  }
                };

                if (this.messageHandler) {
                  this.messageHandler(messageWithTimestamp as AgentResponse);
                }
              } catch (error) {
                console.error('[ChatService] Error saving agent message to database:', error);
                // Aún enviar el mensaje al handler aunque falle el guardado
                if (this.messageHandler) {
                  this.messageHandler(data as AgentResponse);
                }
              }
            } else {
              if (this.messageHandler) {
                this.messageHandler(data as AgentResponse);
              }
            }
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

          if (data.type === 'code_edit' || data.type === 'file_create') {
            // Process code edits and file creations immediately (no buffering)
            if (this.messageHandler) {
              console.log(`[ChatService] Immediate processing of ${data.type} message:`, {
                type: data.type,
                path: data.metadata?.path,
                contentType: typeof data.content
              });

              // Ensure content is properly handled
              const processedData = {
                ...data,
                content: typeof data.content === 'string' 
                  ? data.content 
                  : JSON.stringify(data.content)
              };

              this.messageHandler(processedData as AgentResponse);
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

  /**
   * Ensures messages are properly formatted for the Anthropic API
   * Addresses the error: 'messages.4.content: Input should be a valid list'
   * @param content The message content to format
   * @param role The role of the message sender (user or assistant)
   * @returns Properly formatted message content
   */
  private formatMessageContent(content: any, role: 'user' | 'assistant' = 'assistant'): any {
    // If content is already an array and well-formed for Anthropic, return it
    if (Array.isArray(content) && content.length > 0 && content.every(item => 
      typeof item === 'object' && item !== null && 'type' in item && 'text' in item)) {
      return content;
    }
    
    // Assistant messages in Anthropic format should have array content
    if (role === 'assistant') {
      // If content is a string, wrap it in the proper format
      if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
      }
      
      // If content is already an object but not in array form
      if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
        return [{ type: 'text', text: JSON.stringify(content) }];
      }
      
      // Default fallback for assistant
      return [{ type: 'text', text: String(content || '') }];
    }
    
    // User messages can have string content
    return typeof content === 'string' ? content : String(content || '');
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

    // Process context to handle ABI and other complex objects
    const processedContext = {
      ...context,
      wallet_address: this.walletAddress
    };

    // If context contains ABI, ensure it's properly serialized
    if (context.currentArtifact?.abi) {
      processedContext.currentArtifact = {
        ...context.currentArtifact,
        abi: typeof context.currentArtifact.abi === 'string' 
          ? context.currentArtifact.abi 
          : JSON.stringify(context.currentArtifact.abi)
      };
      console.log('[ChatService] Processed ABI for WebSocket:', {
        abiLength: processedContext.currentArtifact.abi.length,
        firstFunction: JSON.parse(processedContext.currentArtifact.abi)[0]
      });
    }

    const message = {
      type: context.type || 'message',
      content,
      chat_id: effectiveChatId,
      isUserResponse: true,
      context: processedContext
    };

    // Format the message content properly for Anthropic API
    if (message.type === 'message') {
      message.content = this.formatMessageContent(content, 'user');
    }

    console.log(`[ChatService] Sending message to agent with ID ${effectiveChatId}:`, { 
      messageType: message.type,
      hasAbi: !!processedContext.currentArtifact?.abi
    });
    
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
      activeChat = chats[chats.length - 1];
      this.currentChatId = activeChat.id;
      console.log(`[ChatService] No active chat found with ID ${this.currentChatId}, using last chat: ${activeChat.id}`);
    }
    
    // Eliminar posibles mensajes duplicados antes de procesar
    if (activeChat && Array.isArray(activeChat.messages)) {
      // Ordenar mensajes por tiempo
      const sortedMessages = [...activeChat.messages].sort((a: any, b: any) => {
        const timestampA = a.timestamp || a.created_at || 0;
        const timestampB = b.timestamp || b.created_at || 0;
        return new Date(timestampA).getTime() - new Date(timestampB).getTime();
      });
      
      // Eliminar duplicados
      const uniqueMessages: any[] = [];
      const messageMap = new Map();
      
      sortedMessages.forEach((msg: any) => {
        const senderKey = msg.sender || msg.role || 'unknown';
        const contentKey = typeof msg.text === 'string' ? msg.text : 
                         (typeof msg.content === 'string' ? msg.content : 
                         JSON.stringify(msg.content || ''));
        
        const messageKey = `${senderKey}:${contentKey}`;
        
        if (!messageMap.has(messageKey)) {
          messageMap.set(messageKey, true);
          
          // Asegurarse de que todos los mensajes tienen la propiedad isFullMessage
          // para evitar problemas con la interfaz de usuario
          uniqueMessages.push({
            ...msg,
            isFullMessage: true
          });
        }
      });
      
      console.log(`[ChatService] Processed messages: ${activeChat.messages.length} -> ${uniqueMessages.length}`);
      
      // Actualizar el chat con los mensajes únicos
      activeChat = {
        ...activeChat,
        messages: uniqueMessages
      };
    }
    
    // Procesar los archivos del chat activo
    if (activeChat) {
      console.log('[ChatService] Processing active chat:', activeChat);
      try {
        console.log('[ChatService] Clearing virtual file system...');
        await virtualFS.clear();
        console.log('[ChatService] Virtual file system cleared');
        
        // Sincronizar completamente el historial de chat con el agente
        // para evitar que se repitan los mensajes de usuario
        this.syncFullChatHistory(activeChat.id, activeChat);
        
        // Notificar a los manipuladores del evento de chats cargados
        if (this.chatsLoadedHandler) {
          this.chatsLoadedHandler(chats);
        }
      } catch (error) {
        console.error('[ChatService] Error processing virtual files:', error);
      }
    } else {
      console.warn('[ChatService] No active chat found');
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

  // New method to buffer messages with improved handling
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
    
    // Set a new timeout to process the buffer - use longer time window to collect more content
    const timeWindow = data.content.includes('```') ? 
      2000 :  // Longer window for code blocks to ensure we get the complete block
      this.bufferTimeWindow;
    
    this.messageBufferTimeout = setTimeout(() => {
      if (this.messageBuffer && this.messageHandler) {
        this.processingFullMessage = true;
        this.processMessageBuffer();
        this.processingFullMessage = false;
      }
    }, timeWindow);
  }

  // Process the message buffer intelligently with improved handling
  private processMessageBuffer(): void {
    if (!this.messageBuffer || !this.messageHandler) {
      return;
    }

    if (this.debugBuffering) {
      console.log('[ChatService] Processing complete message buffer:', {
        length: this.messageBuffer.length,
        preview: this.messageBuffer.substring(0, 100) + '...'
      });
    }

    // Normalizar líneas en blanco y espacios extra
    const processedContent = this.messageBuffer
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    // Para mensajes que contienen bloques de código, procesar para extraer contratos
    if (processedContent.includes('```')) {
      if (this.debugBuffering) {
        console.log('[ChatService] Message contains code blocks, processing for contract extraction');
      }
      
      // Try to extract Solidity code from message
      const extractSolidityCode = (text: string): { code: string, isComplete: boolean } => {
        // Look for Solidity code blocks
        const codeBlockRegex = /```(?:solidity)?\s*([\s\S]*?)```/;
        const match = text.match(codeBlockRegex);
        
        if (match && match[1]) {
          const code = match[1].trim();
          // Check if it's a complete contract
          const isComplete = code.includes('contract') && 
                            code.includes('{') && 
                            code.includes('}') &&
                            (code.includes('pragma solidity') || code.includes('// SPDX-License'));
                            
          return { code, isComplete };
        }
        
        return { code: '', isComplete: false };
      };
      
      // Extract Solidity code from the message
      const { code, isComplete } = extractSolidityCode(processedContent);
      
      // Primero enviar siempre el mensaje completo para mostrar en UI
      const messageResponse: AgentResponse = {
        type: 'message',
        content: processedContent,
        metadata: {
          ...this.messageMetadata,
          isFullMessage: true, // Marca que este es un mensaje completo, no fragmentado
          containsCode: isComplete // Marca si el mensaje contiene código completo para evitar duplicar compilaciones
        }
      };
      
      this.messageHandler(messageResponse);
      
      // Si el mensaje contiene un contrato Solidity completo, enviarlo también como file_create
      if (code && isComplete) {
        console.log('[ChatService] Found complete Solidity contract in message, sending as file_create');
        
        // Esperar un poco antes de enviar el archivo para asegurar que el mensaje se procese primero
        setTimeout(() => {
          if (this.messageHandler) {
            const fileResponse: AgentResponse = {
              type: 'file_create',
              content: code,
              metadata: {
                ...this.messageMetadata,
                path: 'contracts/Contract.sol',
                language: 'solidity',
                noCompile: true // Indicador para evitar compilación duplicada
              }
            };
            
            this.messageHandler(fileResponse);
          }
        }, 500);
      }
    } else {
      // Para mensajes sin bloques de código, enviar como un mensaje completo
      const bufferedResponse: AgentResponse = {
        type: 'message',
        content: processedContent,
        metadata: {
          ...this.messageMetadata,
          isFullMessage: true // Marca que este es un mensaje completo, no fragmentado
        }
      };
      
      this.messageHandler(bufferedResponse);
    }

    // Limpiar el buffer
    this.messageBuffer = '';
    this.messageMetadata = null;
    
    if (this.messageBufferTimeout) {
      clearTimeout(this.messageBufferTimeout);
      this.messageBufferTimeout = null;
    }
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

  public syncChatHistory(chatId: string, history: ChatInfo): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] Cannot sync chat history: WebSocket not connected');
      return;
    }

    console.log('[ChatService] Syncing chat history with agent:', {
      chatId,
      messageCount: history.messages?.length || 0,
      hasVirtualFiles: !!history.virtualFiles
    });

    // Corregir el manejo de map para evitar parámetros implícitos any
    const processedMessages = history.messages.map((msg: any) => {
      // Para mensajes con contenido anidado
      if (msg.content && Array.isArray(msg.content)) {
        return {
          ...msg,
          // Ensure each content item has the required properties
          content: msg.content.map((item: any) => {
            if (typeof item === 'object' && item !== null) {
              return {
                type: item.type || 'text',
                text: item.text || '',
                ...item
              };
            }
            return { type: 'text', text: String(item) };
          })
        };
      }
      return msg;
    });

    // Format messages to ensure proper structure for Anthropic API
    const formattedMessages = processedMessages.map(msg => {
      // Standard formatting logic same as syncChatHistory
      if (typeof msg === 'object') {
        // If content is an array, ensure it's properly formatted
        if (Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                return {
                  type: item.type || 'text',
                  text: typeof item.text === 'string' ? item.text : String(item.text || '')
                };
              }
              return { type: 'text', text: String(item || '') };
            })
          };
        }
        
        // If content is not an array but should be based on format
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          return {
            ...msg,
            content: [{ type: 'text', text: msg.content }]
          };
        }

        return msg;
      }
      
      return {
        role: typeof msg.sender === 'string' && msg.sender.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: typeof msg.text === 'string' ? msg.text : String(msg.text || '')
      };
    });

    const syncMessage = {
      type: "sync_chat_history",
      chat_id: chatId,
      history: {
        id: history.id,
        name: history.name,
        messages: formattedMessages,
        virtualFiles: history.virtualFiles || {},
        created_at: history.created_at,
        last_accessed: history.last_accessed
      }
    };

    try {
      this.ws.send(JSON.stringify(syncMessage));
      console.log('[ChatService] Chat history successfully sent to agent');
    } catch (error) {
      console.error('[ChatService] Error sending chat history to agent:', error);
    }
  }

  /**
   * Sends a full synchronization of chat history to the backend
   * Use this when you want to completely replace the chat history on the backend
   */
  public syncFullChatHistory(chatId: string, history: ChatInfo): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] Cannot sync full chat history: WebSocket not connected');
      return;
    }

    console.log('[ChatService] Performing full chat history sync with agent:', {
      chatId,
      messageCount: history.messages?.length || 0
    });

    // Asegurarse de que los mensajes estén ordenados cronológicamente
    const sortedMessages = [...(history.messages || [])].sort((a: any, b: any) => {
      const timestampA = a.timestamp || a.created_at || 0;
      const timestampB = b.timestamp || b.created_at || 0;
      return new Date(timestampA).getTime() - new Date(timestampB).getTime();
    });

    // Eliminar posibles duplicados basados en contenido y remitente
    const uniqueMessages: any[] = [];
    const messageMap = new Map();
    
    sortedMessages.forEach((msg: any) => {
      // Crear una clave única para el mensaje basada en contenido y remitente
      const senderKey = msg.sender || msg.role || 'unknown';
      const contentKey = typeof msg.text === 'string' ? msg.text : 
                        (typeof msg.content === 'string' ? msg.content : 
                        JSON.stringify(msg.content || ''));
      
      const messageKey = `${senderKey}:${contentKey}`;
      
      // Solo agregar el mensaje si no existe ya uno igual
      if (!messageMap.has(messageKey)) {
        messageMap.set(messageKey, true);
        uniqueMessages.push(msg);
      } else {
        console.log('[ChatService] Skipping duplicate message:', {
          sender: senderKey,
          contentPreview: contentKey.substring(0, 30)
        });
      }
    });
    
    console.log(`[ChatService] Reduced ${sortedMessages.length} messages to ${uniqueMessages.length} unique messages`);

    // Corregir el manejo de map para evitar parámetros implícitos any
    const processedHistory = {
      ...history,
      messages: uniqueMessages.map((msg: any) => {
        // Para mensajes con contenido anidado
        if (msg.content && Array.isArray(msg.content)) {
          return {
            ...msg,
            // Ensure each content item has the required properties
            content: msg.content.map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                return {
                  type: item.type || 'text',
                  text: item.text || '',
                  ...item
                };
              }
              return { type: 'text', text: String(item) };
            })
          };
        }
        return msg;
      })
    };

    // Format messages to ensure proper structure for Anthropic API
    const formattedMessages = processedHistory.messages?.map(msg => {
      // Standard formatting logic same as syncChatHistory
      if (typeof msg === 'object') {
        // If content is an array, ensure it's properly formatted
        if (Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                return {
                  type: item.type || 'text',
                  text: typeof item.text === 'string' ? item.text : String(item.text || '')
                };
              }
              return { type: 'text', text: String(item || '') };
            })
          };
        }
        
        // If content is not an array but should be based on format
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          return {
            ...msg,
            content: [{ type: 'text', text: msg.content }]
          };
        }

        return msg;
      }
      
      return {
        role: typeof msg.sender === 'string' && msg.sender.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: typeof msg.text === 'string' ? msg.text : String(msg.text || '')
      };
    }) || [];

    const fullSyncMessage = {
      type: "full_history_sync",
      chat_id: chatId,
      history: {
        id: processedHistory.id,
        name: processedHistory.name,
        messages: formattedMessages,
        virtualFiles: processedHistory.virtualFiles || {},
        workspaces: processedHistory.workspaces || {},
        created_at: processedHistory.created_at,
        last_accessed: processedHistory.last_accessed
      }
    };

    try {
      this.ws.send(JSON.stringify(fullSyncMessage));
      console.log('[ChatService] Full chat history successfully sent to agent');
    } catch (error) {
      console.error('[ChatService] Error sending full chat history to agent:', error);
    }
  }

} 