import { virtualFS } from '../services/virtual-fs';
import { conversationService } from '../services/conversationService';
import { generateUniqueId } from '../utils/commonUtils';
import { DatabaseService } from './databaseService';

// Remove this generator since we're now importing a better one
// Generador de IDs únicos usando UUID v4
// const generateUniqueId = () => {
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//     const r = Math.random() * 16 | 0;
//     const v = c === 'x' ? r : (r & 0x3 | 0x8);
//     return v.toString(16);
//   });
// };

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
  private databaseService: DatabaseService = DatabaseService.getInstance();
  
  private debugBuffering: boolean = false; // Debug option to log buffering decisions

  constructor() {
    this.messageHandler = null;
    this.connectionChangeHandler = null;
    this.chatsLoadedHandler = null;
  }

  public connect(walletAddress?: string, chatId?: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[ChatService] WebSocket already connected. Skipping connection.');
      return;
    }
    
    // If a wallet address is provided, use it
    if (walletAddress) {
      this.walletAddress = walletAddress;
    }
    
    // If a chat ID is provided, use it
    if (chatId) {
      this.currentChatId = chatId;
      
      // Attempt to load chat history from database
      (async () => {
        try {
          await this.loadChatHistoryFromDatabase(chatId);
        } catch (error) {
          console.error('[ChatService] Error loading initial chat history:', error);
        }
      })();
    }

    if (!this.walletAddress) {
      console.error('[ChatService] Cannot connect without a wallet address');
      return;
    }

    try {
      // Build websocket URL based on environment
      const agentWsUrl = import.meta.env.MODE === 'production' 
        ? import.meta.env.VITE_WS_URL_PROD 
        : import.meta.env.VITE_WS_URL_DEV;
      
      const wsUrl = `${agentWsUrl}?wallet_address=${this.walletAddress}${chatId ? `&chat_id=${chatId}` : ''}`;
      console.log(`[ChatService] Connecting to WebSocket at ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[ChatService] WebSocket connection established');
        this.reconnectAttempts = 0;
        this.handleConnectionChange(true);
      };
      
      this.ws.onclose = (event) => {
        console.log(`[ChatService] WebSocket closed with code ${event.code}`);
        this.handleConnectionChange(false);
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.tryReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[ChatService] WebSocket error:', error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };
    } catch (error) {
      console.error('[ChatService] Error creating WebSocket connection:', error);
      this.handleConnectionChange(false);
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
        // If code is trying to reconnect but we have no wallet address, stop trying
        if (!this.walletAddress) {
          console.log('[ChatService] No wallet address available, aborting reconnection');
          this.reconnectAttempts = this.maxReconnectAttempts;
          
          // Emit disconnected state to update UI
          if (this.connectionChangeHandler) {
            this.connectionChangeHandler(false);
          }
          return;
        }
        
        console.log(`[ChatService] Attempting reconnection with wallet: ${this.walletAddress}`);
        
        // Try to reconnect with the existing wallet address and chat ID
        this.connect(this.walletAddress || undefined, this.currentChatId || undefined);
      }, delay);
    } else {
      console.log('[ChatService] Max reconnection attempts reached');
      
      // Emitir un mensaje de error al UI
      if (this.messageHandler) {
        this.messageHandler({
          type: 'error',
          content: 'Failed to connect to the server after multiple attempts. Please refresh the page.',
        });
      }
      
      // Asegurar que la UI muestre el estado desconectado
      if (this.connectionChangeHandler) {
        this.connectionChangeHandler(false);
      }
    }
  }

  public disconnect(): void {
    if (!this.ws) return;
    
    if (this.ws.readyState === WebSocket.OPEN) {
      console.log('[ChatService] Disconnecting from chat agent');
      this.ws.close(1000, "Normal closure");  // Use code 1000 for normal closure
    }
    
    // Limpiar el temporizador si existe
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.ws = null;
    this.reconnectAttempts = 0;  // Reset reconnect attempts
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ChatService] WebSocket not connected. Cannot send message.');
      if (this.messageHandler) {
        this.messageHandler({
          type: 'error',
          content: 'Connection to server lost. Please refresh the page and try again.',
        });
      }
      return;
    }

    // Use provided chatId or currentChatId
    const targetChatId = chatId || this.currentChatId;
    if (!targetChatId) {
      console.error('[ChatService] No chat ID provided. Creating a new chat...');
      this.createNewChat('New Chat');
      return;
    }

    // Add user message to conversation context first
    (async () => {
      await this.addMessageToConversation(content, 'user');
      
      const formattedMessage = this.formatMessageContent(content, 'user');
      const message = {
        type: 'message',
        sender: 'user',
        content: formattedMessage,
        chat_id: targetChatId,
        wallet_address: this.walletAddress
      };

      try {
        console.log('[ChatService] Sending message to server:', message);
        if (this.ws) {
          this.ws.send(JSON.stringify(message));
        } else {
          console.error('[ChatService] WebSocket is null, cannot send message');
        }
      } catch (error) {
        console.error('[ChatService] Error sending message:', error);
        if (this.messageHandler) {
          this.messageHandler({
            type: 'error',
            content: 'Failed to send message. Please try again.',
          });
        }
      }
    })();
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
    // Notify all registered handlers about connection state change
    if (this.connectionChangeHandler) {
      this.connectionChangeHandler(connected);
    }
    
    // When connection is established, verify chat history sync state
    if (connected && this.currentChatId) {
      console.log(`[ChatService] Connection established, verifying chat history sync for: ${this.currentChatId}`);
      setTimeout(() => {
        this.verifyChatSyncState(this.currentChatId!)
          .then(isSynced => {
            if (isSynced) {
              console.log('[ChatService] Chat history sync verification passed');
            } else {
              console.warn('[ChatService] Chat history may not be fully synced');
            }
          })
          .catch(error => {
            console.error('[ChatService] Error during chat history sync verification:', error);
          });
      }, 2000); // Slight delay to ensure WebSocket processing completes first
    }
  }

  private async handleChatsLoaded(chats: ChatInfo[]) {
    console.log('[ChatService] Chats loaded:', chats);

    // Stop if we don't have any chats
    if (!Array.isArray(chats) || chats.length === 0) {
      console.log('[ChatService] No active chat found');
      return;
    }

    // Clear the virtual file system first
    try {
      console.log('[ChatService] Clearing virtual file system...');
      await virtualFS.clear();
      console.log('[ChatService] Virtual file system cleared');
    } catch (error) {
      console.error('[ChatService] Error clearing virtual file system:', error);
    }

    // Process messages from active chat
    let activeChat = chats.find(chat => chat.id === this.currentChatId);
    
    // If no active chat matches current ID, use the first one
    if (!activeChat && chats.length > 0) {
      activeChat = chats[0];
      console.log(`[ChatService] No chat found matching current ID, using first chat: ${activeChat.id}`);
      this.currentChatId = activeChat.id;
    }

    if (activeChat) {
      console.log('[ChatService] Processing active chat:', activeChat);
      
      // Process messages
      const messages = activeChat.messages || [];
      console.log(`[ChatService] Processed messages: ${messages.length} -> ${messages.length}`);
      
      // Restore any virtual files from the chat
      if (activeChat.virtualFiles) {
        for (const [path, file] of Object.entries(activeChat.virtualFiles)) {
          try {
            // Create folder structure if needed
            const lastSlashIndex = path.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
              const folder = path.substring(0, lastSlashIndex);
              // Usamos writeFile para crear un archivo oculto que actúe como marcador de carpeta
              await virtualFS.writeFile(`${folder}/.gitkeep`, '').catch((err: unknown) => 
                console.warn(`[ChatService] Error creating folder ${folder}:`, err)
              );
            }
            
            // Create the file
            await virtualFS.writeFile(path, file.content);
          } catch (error) {
            console.error(`[ChatService] Error restoring file ${path}:`, error);
          }
        }
      }

      // Create conversation contexts from all chats
      const contexts = chats.map(chat => ({
        id: chat.id,
        name: chat.name,
        messages: chat.messages || [],
        virtualFiles: chat.virtualFiles || {},
        workspaces: chat.workspaces || {},
        active: chat.id === activeChat?.id,
        createdAt: chat.created_at
      }));
      
      // Important: Update the conversation service with all contexts
      conversationService.setContexts(contexts);
      
      // If we have a current chat ID, set it as active
      if (this.currentChatId) {
        conversationService.setActiveContext(this.currentChatId);
      }
      
      // Notify any listeners about the loaded chats
      if (this.chatsLoadedHandler) {
        console.log('[ChatService] Notifying UI about loaded chats:', chats.length);
        this.chatsLoadedHandler(chats);
      }
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
    // Update currentChatId
    if (chat && chat.id) {
      console.log(`[ChatService] Switching to chat: ${chat.id}`);
      this.currentChatId = chat.id;
      
      // Load chat history from database
      await this.loadChatHistoryFromDatabase(chat.id);

      // Update UI through handlers
      this.handleConnectionChange(true);
      
      // Set context as active - use correct method
      const activeContext = conversationService.getActiveContext();
      
      // Update conversation service with this conversation data
      conversationService.updateContext(
        chat.id, 
        {
          name: chat.name,
          active: true,
          virtualFiles: chat.virtualFiles || {},
          workspaces: chat.workspaces || {}
        },
        activeContext || {
          id: chat.id,
          name: chat.name,
          messages: [],
          active: true,
          virtualFiles: chat.virtualFiles || {},
          workspaces: chat.workspaces || {},
          createdAt: chat.created_at
        } // Provide fallback if activeContext is undefined
      );
    } else {
      console.error('[ChatService] Invalid chat data for switching:', chat);
    }
  }

  /**
   * Loads chat history from the database API
   * @param chatId ID of the chat to load history for
   */
  private async loadChatHistoryFromDatabase(chatId: string): Promise<void> {
    if (!chatId) {
      console.error('[ChatService] Cannot load chat history: No chat ID provided');
      return;
    }

    try {
      console.log(`[ChatService] Loading chat history from database for chat: ${chatId}`);
      
      // Get messages from database API
      const messages = await this.databaseService.getMessagesViaAPI(chatId);
      
      if (Array.isArray(messages) && messages.length > 0) {
        console.log(`[ChatService] Loaded ${messages.length} messages from database`);
        
        // Get current context
        const contexts = conversationService.getContexts();
        const currentContext = contexts.find(ctx => ctx.id === chatId);
        
        if (currentContext) {
          // First, completely clear all messages for this chat to avoid duplicates
          conversationService.updateContext(
            chatId,
            {
              name: currentContext.name || 'Chat',
              active: true,
              virtualFiles: currentContext.virtualFiles || {},
              workspaces: currentContext.workspaces || {}
            },
            {
              ...currentContext,
              messages: [], // Clear the messages
              active: true
            }
          );
          
          // Keep track of message signatures to avoid duplicates
          // We use a combination of sender and content as the signature
          const addedMessageSignatures = new Set<string>();
          
          // Add messages to conversation service in order
          for (const message of messages) {
            // Create signature from content and sender
            const messageSignature = `${message.sender}:${message.content.substring(0, 100)}`;
            
            // Skip if we've already added a message with this signature
            if (addedMessageSignatures.has(messageSignature)) {
              console.log(`[ChatService] Skipping duplicate message with signature: ${messageSignature.substring(0, 50)}...`);
              continue;
            }
            
            // Convert API message format to local format
            const localMessage = {
              id: message.id || generateUniqueId(),
              text: message.content,
              sender: message.sender,
              timestamp: new Date(message.created_at).getTime() || Date.now(),
              metadata: message.metadata || {}
            };
            
            // Add message to conversation
            conversationService.addMessage(chatId, localMessage);
            addedMessageSignatures.add(messageSignature);
          }
          
          console.log('[ChatService] Chat history loaded successfully');
        }
      } else {
        console.log(`[ChatService] No messages found in database for chat: ${chatId}`);
      }
    } catch (error) {
      console.error('[ChatService] Error loading chat history from database:', error);
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
    } else {
      console.warn('[ChatService] Invalid buffer time window. Must be between 100ms and 2000ms');
    }
  }

  // New method to sync contexts with database
  public syncContextsWithDatabase(dbContexts: ChatInfo[]): void {
    if (!Array.isArray(dbContexts) || dbContexts.length === 0) {
      console.warn('[ChatService] No contexts to sync with database');
      return;
    }
    
    console.log(`[ChatService] Syncing ${dbContexts.length} contexts from database`);
    
    // If we already have a currentChatId, make sure we keep using it
    // instead of replacing it with a random context from the database
    const currentId = this.currentChatId;
    
    if (currentId) {
      console.log(`[ChatService] Using existing chat ID: ${currentId}`);
      
      // Check if the current ID exists in database contexts
      const matchingContext = dbContexts.find(ctx => ctx.id === currentId);
      
      if (matchingContext) {
        console.log(`[ChatService] Found matching context in database for ID: ${currentId}`);
        this.syncChatHistory(currentId, matchingContext);
      } else {
        // If current ID not in database, use the first context from database
        console.log(`[ChatService] Current chat ID not found in database, using first context`);
        this.currentChatId = dbContexts[0].id;
        
        // Notify any listeners that the chats have been loaded
        if (this.chatsLoadedHandler) {
          this.chatsLoadedHandler(dbContexts);
        }
      }
    } else {
      // If no current chat ID, use the first one from database
      console.log('[ChatService] No current chat ID, using first context from database');
      this.currentChatId = dbContexts[0].id;
      
      // Notify any listeners that the chats have been loaded
      if (this.chatsLoadedHandler) {
        this.chatsLoadedHandler(dbContexts);
      }
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
  public syncFullChatHistory(): void {
    // This method is no longer needed as we load history from the database
    // Just log the call for debugging
    console.log('[ChatService] syncFullChatHistory method is deprecated - using API to load history');
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('[ChatService] Received message:', data);

      // Process the incoming message based on its type
      switch (data.type) {
        case 'message':
          // Handle regular message response
          if (data.content && this.messageHandler) {
            const response: AgentResponse = {
              type: data.type || 'message',
              content: data.content,
              metadata: data.metadata || {}
            };
            
            // Add AI message to conversation - Only if the message is from the AI
            if (data.sender === 'ai') {
              (async () => {
                // Check if this message is already in the conversation to avoid duplicates
                const contexts = conversationService.getContexts();
                const currentContext = contexts.find(ctx => ctx.id === this.currentChatId);
                
                // Create a signature for this message based on content and sender
                const messageSignature = `${data.sender}:${data.content.substring(0, 100)}`;
                
                // Check the last 10 messages for duplicates to be thorough
                const recentMessages = currentContext?.messages?.slice(-10) || [];
                const existingMessage = recentMessages.some(m => {
                  // Check by content similarity (first 100 chars) and same sender
                  const msgSignature = `${m.sender}:${m.text.substring(0, 100)}`;
                  return msgSignature === messageSignature;
                });
                
                // Only add the message if it doesn't already exist
                if (!existingMessage) {
                  await this.addMessageToConversation(data.content, 'ai');
                } else {
                  console.log('[ChatService] Skipped adding duplicate AI message with signature:', 
                              messageSignature.substring(0, 50) + '...');
                }
                
                // Notify listeners about the message
                if (this.messageHandler) {
                  this.messageHandler(response);
                }
              })();
            } else {
              // If it's not an AI message, just notify listeners without adding to conversation
              this.messageHandler(response);
            }
          }
          break;
        
        case 'contexts_loaded':
          // Add a crucial step here to update the UI when loading chats
          const contexts = Array.isArray(data.content) ? data.content : [];
          console.log('[ChatService] Received chat contexts:', contexts);
          
          // Always call the handler to update the UI
          if (this.chatsLoadedHandler) {
            console.log('[ChatService] Notifying UI about contexts:', contexts.length);
            this.chatsLoadedHandler(contexts);
          } else {
            console.warn('[ChatService] No chats loaded handler registered');
          }
          
          // Process chat contexts into conversations
          this.handleChatsLoaded(contexts);
          break;
        
        case 'file_create':
          console.log('[ChatService] File creation request:', data.content);
          
          // Call message handler with file creation message
          if (this.messageHandler) {
            const fileName = data.metadata?.path || 'unnamed-file.txt';
            const language = data.metadata?.language || 'text';
            
            // Create a message to show the file creation in the chat
            const fileCreateMessage: AgentResponse = {
              type: 'file_create',
              content: `Created file: ${fileName}\n\`\`\`${language}\n${data.content}\n\`\`\``,
              metadata: {
                path: fileName,
                language: language,
                isFullMessage: true
              }
            };
            
            // Directly notify message handler about file creation
            this.messageHandler(fileCreateMessage);
            
            // Add file creation message to conversation
            if (this.currentChatId) {
              this.addMessageToConversation(fileCreateMessage.content, 'ai');
            }
            
            // Also add the file to the virtual filesystem
            try {
              // Extract folder path if needed
              const lastSlashIndex = fileName.lastIndexOf('/');
              const folderPath = lastSlashIndex !== -1 
                ? fileName.substring(0, lastSlashIndex) 
                : '';
              
              // Create folders if needed
              if (folderPath) {
                // Usamos writeFile para crear un archivo oculto que actúe como marcador de carpeta
                virtualFS.writeFile(`${folderPath}/.gitkeep`, '')
                  .catch((err: unknown) => console.error(`[ChatService] Error creating folder ${folderPath}:`, err));
              }
              
              // Then create the file
              virtualFS.writeFile(fileName, data.content)
                .then(() => {
                  console.log(`[ChatService] File created: ${fileName}`);
                  
                  // Emitir un evento personalizado para seleccionar automáticamente el archivo creado
                  // cuando es un archivo Solidity (.sol)
                  if (fileName.endsWith('.sol')) {
                    console.log(`[ChatService] Emitting event to auto-select Solidity file: ${fileName}`);
                    const autoSelectEvent = new CustomEvent('auto-select-file', {
                      detail: {
                        path: fileName,
                        content: data.content
                      }
                    });
                    window.dispatchEvent(autoSelectEvent);
                  }
                  
                  // Also update the current conversation's virtual files
                  if (this.currentChatId) {
                    const context = conversationService.getActiveContext();
                    if (context) {
                      // Add to virtual files
                      const virtualFile = {
                        content: data.content,
                        language: language,
                        timestamp: Date.now()
                      };
                      
                      // Add to context virtual files
                      const updatedContext = {
                        ...context,
                        virtualFiles: {
                          ...context.virtualFiles,
                          [fileName]: virtualFile
                        },
                        // Ensure active property is true
                        active: true
                      };
                      
                      // If there's an active workspace, add to that workspace too
                      if (updatedContext.activeWorkspace && updatedContext.workspaces) {
                        const workspace = updatedContext.workspaces[updatedContext.activeWorkspace];
                        if (workspace) {
                          const updatedWorkspace = {
                            ...workspace,
                            files: {
                              ...workspace.files,
                              [fileName]: virtualFile
                            },
                            updatedAt: Date.now()
                          };
                          
                          updatedContext.workspaces = {
                            ...updatedContext.workspaces,
                            [updatedContext.activeWorkspace]: updatedWorkspace
                          };
                        }
                      }
                      
                      // Update the context
                      conversationService.updateContext(
                        this.currentChatId,
                        updatedContext,
                        conversationService.getActiveContext() || updatedContext
                      );
                    }
                  }
                })
                .catch((err: unknown) => console.error(`[ChatService] Error creating file ${fileName}:`, err));
            } catch (error) {
              console.error('[ChatService] Error handling file creation:', error);
            }
          }
          break;
        
        case 'context_created':
          console.log('[ChatService] Context created:', data.content);
          this.handleChatCreated(data.content);
          break;
        
        case 'context_switched':
          console.log('[ChatService] Context switched:', data.content);
          this.handleChatSwitched(data.content);
          break;
        
        case 'error':
          console.error('[ChatService] Error from server:', data.content);
          
          // Handle error messages
          if (this.messageHandler) {
            const errorMessage: AgentResponse = {
              type: 'error',
              content: typeof data.content === 'string' 
                ? data.content 
                : 'An error occurred',
              metadata: data.metadata || {}
            };
            this.messageHandler(errorMessage);
          }
          break;
        
        default:
          console.warn('[ChatService] Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('[ChatService] Error processing WebSocket message:', error);
      if (this.messageHandler) {
        this.messageHandler({
          type: 'error',
          content: 'Error processing server response. Please try again.',
        });
      }
    }
  }
  

  // Helper method to add messages to the conversation context
  private async addMessageToConversation(content: string, sender: 'user' | 'ai'): Promise<void> {
    if (!this.currentChatId) {
      console.error('[ChatService] Cannot save message: No active chat ID');
      return;
    }
    
    try {
      // Check if this message already exists in the conversation
      const contexts = conversationService.getContexts();
      const currentContext = contexts.find(ctx => ctx.id === this.currentChatId);
      
      // Create a signature for this message to check for duplicates
      const messageSignature = `${sender}:${content.substring(0, 100)}`;
      
      // Look for a message with similar content and same sender in the last 5 messages
      // This helps avoid duplicates but still allows intentional repetition of messages after some time
      const recentMessages = currentContext?.messages?.slice(-5) || [];
      const isDuplicate = recentMessages.some(m => {
        const msgSignature = `${m.sender}:${m.text.substring(0, 100)}`;
        return msgSignature === messageSignature;
      });
      
      if (isDuplicate) {
        console.log('[ChatService] Skipping duplicate message with signature:', 
                    messageSignature.substring(0, 50) + '...');
        return;
      }
      
      // Create a message object
      const message = {
        id: generateUniqueId(),
        text: content,
        sender,
        timestamp: Date.now()
      };
      
      // Add to conversation service (local state)
      conversationService.addMessage(this.currentChatId, message);
      
      // Save to database via API
      console.log(`[ChatService] Saving message to database for conversation: ${this.currentChatId}`);
      try {
        await this.databaseService.saveMessageViaAPI(
          this.currentChatId,
          content,
          sender,
          { timestamp: Date.now() }
        );
        console.log('[ChatService] Message saved to database successfully');
      } catch (dbError) {
        console.error('[ChatService] Error saving message to database:', dbError);
        // Continue even if database save fails to maintain local functionality
      }
    } catch (error) {
      console.error('[ChatService] Error adding message to conversation:', error);
    }
  }

  /**
   * Verifies that the local chat history matches the database records
   * @param chatId ID of the chat to verify
   * @returns Promise resolving to true if synchronized, false otherwise
   */
  public async verifyChatSyncState(chatId: string): Promise<boolean> {
    if (!chatId) {
      console.error('[ChatService] Cannot verify chat sync: No chat ID provided');
      return false;
    }
    
    try {
      console.log(`[ChatService] Verifying chat sync state for chat: ${chatId}`);
      
      // Get messages from database API
      const databaseMessages = await this.databaseService.getMessagesViaAPI(chatId);
      
      // Get local messages from conversation service
      // conversationService.getContext doesn't exist, use getContexts instead
      const contexts = conversationService.getContexts();
      const context = contexts.find(ctx => ctx.id === chatId);
      const localMessages = context?.messages || [];
      
      // Check if counts match
      if (!Array.isArray(databaseMessages)) {
        console.error('[ChatService] Database returned non-array for messages');
        return false;
      }
      
      if (databaseMessages.length !== localMessages.length) {
        console.warn(`[ChatService] Message count mismatch: Database has ${databaseMessages.length}, local has ${localMessages.length}`);
        
        // If database has fewer messages, we need to sync local messages to database
        if (databaseMessages.length < localMessages.length) {
          console.log('[ChatService] Database missing messages - syncing local messages to database');
          
          // Find messages that exist locally but not in database
          const dbMessageIds = new Set(databaseMessages.map(m => m.id));
          const missingMessages = localMessages.filter((m: any) => !dbMessageIds.has(m.id));
          
          // Save missing messages to database
          for (const message of missingMessages) {
            console.log(`[ChatService] Syncing missing message to database: ${message.id}`);
            await this.databaseService.saveMessageViaAPI(
              chatId,
              message.text,
              message.sender as 'user' | 'ai',
              { timestamp: message.timestamp }
            );
          }
          
          console.log('[ChatService] Chat history sync complete');
          return true;
        }
        
        return false;
      }
      
      console.log('[ChatService] Chat history appears to be in sync');
      return true;
    } catch (error) {
      console.error('[ChatService] Error verifying chat sync state:', error);
      return false;
    }
  }

} 