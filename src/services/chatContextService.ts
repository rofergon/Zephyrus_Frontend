import { Message, ConversationContext, conversationService } from './conversationService';
import { ChatService } from './chatService';
import { virtualFS } from './virtual-fs';
import { DatabaseService } from './databaseService';
import { ContractArtifact } from '../types/contracts';
import { generateUniqueId } from '../utils/commonUtils';
import { apiService } from './apiService';

// Define tipos para las funciones de callback
export type AddConsoleMessageFn = (message: string, type: 'error' | 'warning' | 'success' | 'info') => void;
export type SetStateFn<T> = (value: T | ((prev: T) => T)) => void;
export type CompileCodeFn = (code: string) => Promise<void>;

export interface ChatContextConfig {
  addConsoleMessage: AddConsoleMessageFn;
  setMessages: SetStateFn<Message[]>;
  setConversationContexts: SetStateFn<ConversationContext[]>;
  setActiveContext: SetStateFn<ConversationContext | undefined>;
  setCurrentArtifact: SetStateFn<ContractArtifact | null>;
  setCurrentCode: SetStateFn<string>;
  setShowCodeEditor: SetStateFn<boolean>;
  compileCode: CompileCodeFn;
  databaseService: DatabaseService;
  chatService: ChatService;
  address?: string;
  demoArtifact: ContractArtifact;
  setSelectedFile?: (filePath: string) => void;
}

export class ChatContextService {
  private config: ChatContextConfig;
  private currentContexts: ConversationContext[] = [];

  constructor(config: ChatContextConfig) {
    this.config = config;
    // Inicializar el array de contextos
    this.currentContexts = [];
  }

  /**
   * Crea un nuevo contexto de chat
   */
  public async createNewChat(): Promise<void> {
    try {
      console.log('[ChatContextService] Creating new chat');
      
      if (!this.config.address) {
        console.error('[ChatContextService] Cannot create chat without wallet address');
        this.config.addConsoleMessage('Cannot create chat without wallet address', 'error');
        return;
      }

      // Disconnect any active WebSocket connection first to prevent duplicate connections
      this.config.chatService.disconnect();

      // Crear la conversación en la base de datos primero
      const newConversation = await apiService.createConversation(
        this.config.address,
        'New Chat'
      );

      console.log('[ChatContextService] Created conversation in database:', newConversation);

      if (!newConversation.id) {
        throw new Error('Failed to create conversation - no ID returned');
      }

      // ALWAYS use the ID returned by the database - single source of truth
      const contextId = newConversation.id;
      console.log(`[ChatContextService] Using database-generated ID as source of truth: ${contextId}`);
      
      // First check if this context already exists
      const existingContext = this.currentContexts.find(ctx => ctx.id === contextId);
      
      if (existingContext) {
        console.log(`[ChatContextService] Context ${contextId} already exists, switching to it`);
        await this.handleContextSwitch(contextId);
        return;
      }
      
      // Create new context
      const newContext: ConversationContext = {
        id: contextId,
        name: newConversation.name || 'New Chat',
        messages: [],
        virtualFiles: {},
        workspaces: {},
        active: true,
        createdAt: newConversation.created_at || new Date().toISOString(),
      };
      
      // Create a default workspace for this context
      const workspaceId = `ws_${Date.now()}`;
      const defaultWorkspace = {
        id: workspaceId,
        name: 'Default Workspace',
        description: 'Default workspace for this conversation',
        files: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      newContext.workspaces = {
        [workspaceId]: defaultWorkspace
      };
      newContext.activeWorkspace = workspaceId;

      // Set the ID in chatService to maintain consistency
      this.config.chatService.setCurrentChatId(contextId);
      
      // Create the context in conversationService
      await conversationService.createNewContext(newContext, contextId);
      
      // Reconnect with the new chat ID
      this.config.chatService.connect(this.config.address, contextId);
      
      // Deactivate all other contexts
      const updatedContexts = this.currentContexts.map(ctx => ({
        ...ctx,
        active: ctx.id === contextId
      }));
      
      // Añadir el nuevo contexto
      updatedContexts.push({
        ...newContext,
        active: true
      });
      
      // Update our contexts
      this.currentContexts = updatedContexts;
      
      // Update the UI
      this.config.setConversationContexts(updatedContexts);
      this.config.setActiveContext(newContext);
      this.config.setMessages([]);
      
      // Forzar una actualización inmediata de la UI
      setTimeout(() => {
        console.log('[ChatContextService] Forcing UI update after new chat creation');
        this.config.setActiveContext({...newContext, active: true});
      }, 100);
      
      // Success message
      this.config.addConsoleMessage('Created new chat successfully', 'success');
    } catch (error) {
      console.error('[ChatContextService] Error creating new chat:', error);
      this.config.addConsoleMessage(`Error creating new chat: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  /**
   * Cambia entre diferentes contextos de chat
   */
  public async handleContextSwitch(contextId: string): Promise<void> {
    try {
      console.log('[ChatContextService] Starting context switch:', {
        contextId,
        address: this.config.address,
        timestamp: new Date().toISOString()
      });
      
      if (!this.config.address) {
        console.error('[ChatContextService] No wallet address available');
        return;
      }

      // Encontrar el contexto seleccionado
      const contexts = conversationService.getContexts();
      const selectedContext = contexts.find((ctx: ConversationContext) => ctx.id === contextId);
      
      if (!selectedContext) {
        console.error('[ChatContextService] Context not found:', {
          contextId,
          availableContexts: contexts.map((ctx: ConversationContext) => ({
            id: ctx.id,
            name: ctx.name
          }))
        });
        return;
      }
      
      console.log('[ChatContextService] Found context to switch to:', {
        id: selectedContext.id,
        name: selectedContext.name,
        hasVirtualFiles: !!selectedContext.virtualFiles,
        messageCount: selectedContext.messages?.length || 0
      });
      
      // Actualizar el estado local
      const updatedContexts = contexts.map((ctx: ConversationContext) => ({
        ...ctx,
        active: ctx.id === contextId
      }));
      
      // Actualizar estado local de la instancia
      this.currentContexts = updatedContexts;
      
      // Cargar contratos para esta wallet
      console.log('[ChatContextService] Initiating contract load for wallet:', {
        address: this.config.address,
        timestamp: new Date().toISOString()
      });

      try {
        const contracts = await this.config.databaseService.getDeployedContracts(this.config.address);
        console.log('[ChatContextService] Database query for contracts completed:', {
          address: this.config.address,
          contractsFound: contracts.length,
          contracts: contracts.map((c: any) => ({
            name: c.name,
            address: c.contract_address,
            hasAbi: !!c.abi,
            deployedAt: c.deployed_at
          }))
        });

        if (contracts && contracts.length > 0) {
          const lastContract = contracts[0];
          console.log('[ChatContextService] Found last deployed contract:', {
            name: lastContract.name,
            address: lastContract.contract_address,
            hasAbi: !!lastContract.abi,
            deployedAt: lastContract.deployed_at,
            abiPreview: lastContract.abi ? JSON.stringify(lastContract.abi).substring(0, 100) + '...' : 'null'
          });

          // Actualizar el contexto con la información del contrato
          const contextWithContract = {
            ...selectedContext,
            active: true,
            contractAddress: lastContract.contract_address,
            contractName: lastContract.name,
            contractAbi: lastContract.abi
          };

          console.log('[ChatContextService] Updating context with contract info:', {
            contextId: contextWithContract.id,
            contractAddress: contextWithContract.contractAddress,
            contractName: contextWithContract.contractName,
            hasAbi: !!contextWithContract.contractAbi
          });

          this.config.setConversationContexts(updatedContexts.map((ctx: ConversationContext) => 
            ctx.id === contextId ? contextWithContract : ctx
          ));
          this.config.setActiveContext(contextWithContract);
          
          await this.loadLastDeployedContract(contextId);
        } else {
          console.log('[ChatContextService] No deployed contracts found for context:', {
            contextId,
            timestamp: new Date().toISOString()
          });
          this.config.setConversationContexts(updatedContexts);
          this.config.setActiveContext({...selectedContext, active: true});
          this.config.setCurrentArtifact(this.config.demoArtifact);
        }
      } catch (apiError) {
        console.error('[ChatContextService] API Error loading deployed contract:', {
          contextId,
          error: apiError instanceof Error ? apiError.message : 'Unknown API error',
          stack: apiError instanceof Error ? apiError.stack : undefined
        });
        
        // Add user notification about API error
        this.config.addConsoleMessage(
          "Could not connect to the contracts database. The API may be unavailable.",
          "warning"
        );
        
        this.config.setConversationContexts(updatedContexts);
        this.config.setActiveContext({...selectedContext, active: true});
        this.config.setCurrentArtifact(this.config.demoArtifact);
      }
      
      // Actualizar los servicios
      conversationService.setActiveContext(contextId);
      this.config.chatService.setCurrentChatId(contextId);

      // Cargar los mensajes del contexto seleccionado
      this.config.setMessages(selectedContext.messages || []);
      
      // Manejar archivos virtuales
      if (selectedContext.virtualFiles) {
        console.log('[ChatContextService] Processing virtual files:', {
          contextId,
          filesFound: Object.keys(selectedContext.virtualFiles).length,
          files: Object.keys(selectedContext.virtualFiles)
        });
        
        // Limpiar el sistema de archivos virtual
        await virtualFS.clear();
        
        // Collect Solidity files for compilation
        const solidityFiles: { path: string, content: string }[] = [];
        
        // Restaurar los archivos del contexto seleccionado
        for (const [path, file] of Object.entries(selectedContext.virtualFiles)) {
          try {
            await virtualFS.writeFile(path, file.content);
            console.log('[ChatContextService] Restored virtual file:', {
              path,
              language: file.language,
              contentLength: file.content.length
            });
            
            if (file.language === 'solidity') {
              solidityFiles.push({ path, content: file.content });
            }
          } catch (error) {
            console.error('[ChatContextService] Error restoring virtual file:', {
              path,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        // Compile only the most recent Solidity file to avoid multiple compilation requests
        if (solidityFiles.length > 0) {
          const latestFile = solidityFiles[solidityFiles.length - 1];
          this.config.setCurrentCode(latestFile.content);
          this.config.setShowCodeEditor(true);
          await this.config.compileCode(latestFile.content);
        }
      } else {
        console.log('[ChatContextService] No virtual files found in context:', {
          contextId,
          timestamp: new Date().toISOString()
        });
        this.config.setCurrentCode('');
        this.config.setShowCodeEditor(false);
      }
      
      console.log('[ChatContextService] Context switch completed:', {
        contextId,
        name: selectedContext.name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[ChatContextService] Error during context switch:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Provide user feedback
      this.config.addConsoleMessage(
        "An error occurred while switching contexts. Some features may not work properly.",
        "error"
      );
    }
  }

  /**
   * Elimina un contexto de chat
   */
  public async handleContextDelete(contextId: string): Promise<void> {
    try {
      console.log('[ChatContextService] Deleting context:', contextId);
      
      // Eliminar el contexto
      this.config.chatService.deleteContext(contextId);
      
      // Actualizar el estado local
      const contexts = conversationService.getContexts();
      const updatedContexts = contexts.filter((ctx: ConversationContext) => ctx.id !== contextId);
      
      // Actualizar el estado local de la instancia
      this.currentContexts = updatedContexts;
      
      // Si el contexto que se está borrando es el activo, activar el último contexto
      const activeContext = contexts.find((ctx: ConversationContext) => ctx.active);
      if (activeContext?.id === contextId && updatedContexts.length > 0) {
        const lastContext = updatedContexts[updatedContexts.length - 1];
        lastContext.active = true;
        this.config.setActiveContext(lastContext);
        conversationService.setActiveContext(lastContext.id);
        this.config.chatService.setCurrentChatId(lastContext.id);
      }
      
      this.config.setConversationContexts(updatedContexts);
      conversationService.setContexts(updatedContexts);
      
      console.log('[ChatContextService] Context deleted, remaining contexts:', updatedContexts);
    } catch (error) {
      console.error('[ChatContextService] Error deleting context:', error);
    }
  }

  /**
   * Inicializa las conversaciones cargando el contexto activo
   */
  public initializeConversation(): void {
    try {
      // Verificar si ya tenemos contextos cargados
      if (this.currentContexts && this.currentContexts.length > 0) {
        console.log('[ChatContextService] Contexts already loaded, skipping initialization');
        return;
      }

      // Limpiar los contextos almacenados en localStorage
      if (this.config.address) {
        console.log('[ChatContextService] Clearing localStorage contexts for clean initialization');
        conversationService.clearContexts();
      }

      const contexts = conversationService.getContexts();
      console.log('[ChatContextService] Initializing with contexts:', contexts);
      
      if (contexts.length > 0) {
        // Asegurar que no haya IDs duplicados
        const uniqueContexts = this.ensureUniqueContexts(contexts);
        
        const activeContext = uniqueContexts[uniqueContexts.length - 1];
        activeContext.active = true;
        
        const updatedContexts = uniqueContexts.map((ctx: ConversationContext) => ({
          ...ctx,
          active: ctx.id === activeContext.id
        }));
        
        // Actualizar estado local
        this.currentContexts = updatedContexts;
        
        // Actualizar el servicio de conversación con los contextos únicos
        conversationService.setContexts(updatedContexts);
        
        this.config.setConversationContexts(updatedContexts);
        this.config.setActiveContext(activeContext);
        conversationService.setActiveContext(activeContext.id);
        this.config.chatService.setCurrentChatId(activeContext.id);
        
        // Load the last deployed contract for the active context
        this.loadLastDeployedContract(activeContext.id);
        
        console.log('[ChatContextService] Initialized contexts:', updatedContexts);
        console.log('[ChatContextService] Active context:', activeContext);
      }
    } catch (error) {
      console.error('[ChatContextService] Error initializing conversation:', error);
    }
  }

  /**
   * Asegura que todos los contextos tengan IDs únicos
   */
  private ensureUniqueContexts(contexts: ConversationContext[]): ConversationContext[] {
    const seen = new Set<string>();
    const uniqueContexts: ConversationContext[] = [];
    
    for (const context of contexts) {
      if (!seen.has(context.id)) {
        seen.add(context.id);
        uniqueContexts.push(context);
      } else {
        // If duplicate ID found, generate a new unique ID
        const newId = generateUniqueId();
        console.log(`[ChatContextService] Found duplicate context ID: ${context.id}, generating new ID: ${newId}`);
        uniqueContexts.push({
          ...context,
          id: newId
        });
      }
    }
    
    return uniqueContexts;
  }

  /**
   * Añade un mensaje al contexto de chat actual
   */
  public async addMessageToContext(message: string, isUserMessage: boolean, currentContext?: ConversationContext): Promise<Message> {
    try {
      if (!currentContext) {
        throw new Error('No active context found');
      }

      const timestamp = Date.now();
      const timestampIso = new Date(timestamp).toISOString();

      // Crear el mensaje en la base de datos
      const messageResponse = await apiService.createMessage(
        currentContext.id,
        message,
        isUserMessage ? 'user' : 'ai',
        { timestamp: timestampIso }
      );

      if (!messageResponse.success) {
        throw new Error('Failed to save message to database');
      }

      // Crear el mensaje UI directamente
      const uiMessage: Message = {
        id: generateUniqueId(), // Se actualizará cuando obtengamos la respuesta de la base de datos
        text: message,
        sender: isUserMessage ? 'user' : 'ai',
        timestamp,
        showAnimation: false // Always disable animation
      };

      // Actualizar el estado de mensajes inmediatamente
      this.config.setMessages(prevMessages => [...prevMessages, uiMessage]);

      // Actualizar el contexto activo
      this.config.setActiveContext(prevContext => {
        if (!prevContext) return undefined;
        const updatedContext = {
          ...prevContext,
          messages: [...prevContext.messages, uiMessage]
        };

        // Actualizar el estado de los contextos
        this.config.setConversationContexts(prevContexts => 
          prevContexts.map((ctx: ConversationContext) => 
            ctx.id === prevContext.id ? updatedContext : ctx
          )
        );

        return updatedContext;
      });

      // Obtener los mensajes actualizados en segundo plano
      try {
        const messages = await apiService.getMessages(currentContext.id);
        const latestMessage = messages[messages.length - 1];
        if (latestMessage) {
          // Actualizar el ID del mensaje con el de la base de datos
          uiMessage.id = latestMessage.id;
        }
      } catch (error) {
        console.error('[ChatContextService] Error fetching updated messages:', error);
      }

      return uiMessage;
    } catch (error) {
      console.error('[ChatContextService] Error adding message:', error);
      this.config.addConsoleMessage('Error saving message', 'error');
      throw error;
    }
  }

  /**
   * Carga el último contrato desplegado para un contexto
   */
  private async loadLastDeployedContract(conversationId: string): Promise<void> {
    try {
      const walletAddress = this.config.address;
      console.log('[ChatContextService] Starting to load last deployed contract:', {
        address: walletAddress,
        timestamp: new Date().toISOString()
      });

      if (!walletAddress) {
        console.error('[ChatContextService] No wallet address available');
        this.config.setCurrentArtifact(this.config.demoArtifact);
        return;
      }

      try {
        // Primero intentar obtener contratos por conversación
        let contracts = await this.config.databaseService.getContractsByConversation(conversationId);
        
        // Si no hay contratos para esta conversación, obtener todos los contratos del usuario
        if (!contracts || contracts.length === 0) {
          contracts = await this.config.databaseService.getDeployedContracts(walletAddress);
        }
        
        console.log('[ChatContextService] Database query completed:', {
          address: walletAddress,
          contractsFound: contracts.length,
          contracts: contracts.map((c: any) => ({
            name: c.name,
            address: c.contract_address,
            hasAbi: !!c.abi,
            deployedAt: c.deployed_at
          }))
        });
        
        if (contracts && contracts.length > 0) {
          const lastContract = contracts[0]; // Contracts are ordered by deployed_at DESC
          console.log('[ChatContextService] Processing most recent contract:', {
            name: lastContract.name,
            address: lastContract.contract_address,
            hasAbi: !!lastContract.abi,
            deployedAt: lastContract.deployed_at,
            sourceCodeExists: !!lastContract.source_code,
            abiPreview: lastContract.abi ? JSON.stringify(lastContract.abi).substring(0, 100) + '...' : 'null'
          });

          if (!lastContract.abi) {
            console.error('[ChatContextService] Contract ABI is missing:', {
              name: lastContract.name,
              address: lastContract.contract_address,
              deployedAt: lastContract.deployed_at
            });
            this.config.setCurrentArtifact(this.config.demoArtifact);
            return;
          }

          // Create contract artifact from the deployed contract
          const contractArtifact: ContractArtifact = {
            name: lastContract.name || 'Unnamed Contract',
            description: 'Deployed Smart Contract',
            address: lastContract.contract_address,
            transactionHash: lastContract.tx_hash || lastContract.transactionHash,
            abi: typeof lastContract.abi === 'string' ? JSON.parse(lastContract.abi) : lastContract.abi || [],
            bytecode: lastContract.bytecode,
            functions: (typeof lastContract.abi === 'string' ? JSON.parse(lastContract.abi) : lastContract.abi || [])
              .filter((item: any) => item.type === 'function')
              .map((item: any) => ({
                name: item.name,
                description: `${item.name}(${(item.inputs || []).map((input: any) => `${input.type} ${input.name}`).join(', ')})`,
                type: 'function' as 'function',
                stateMutability: item.stateMutability,
                inputs: (item.inputs || []).map((input: any) => ({
                  name: input.name || 'value',
                  type: input.type,
                  internalType: input.internalType,
                  components: input.components
                })),
                outputs: (item.outputs || []).map((output: any) => ({
                  name: output.name || 'value',
                  type: output.type,
                  internalType: output.internalType,
                  components: output.components
                }))
              })),
            events: (typeof lastContract.abi === 'string' ? JSON.parse(lastContract.abi) : lastContract.abi || [])
              .filter((item: any) => item.type === 'event')
              .map((item: any) => ({
                name: item.name,
                description: `Event: ${item.name}(${(item.inputs || []).map((input: any) => `${input.type} ${input.name}`).join(', ')})`,
                type: 'event' as 'event',
                inputs: (item.inputs || []).map((input: any) => ({
                  name: input.name || 'value',
                  type: input.type,
                  description: `Event parameter of type ${input.type}`,
                  components: input.components,
                  indexed: input.indexed
                }))
              })) || [],
            constructor: (typeof lastContract.abi === 'string' ? JSON.parse(lastContract.abi) : lastContract.abi || [])
              .filter((item: any) => item.type === 'constructor')
              .map((item: any) => ({
                name: 'constructor',
                description: `Constructor(${(item.inputs || []).map((input: any) => `${input.type} ${input.name}`).join(', ')})`,
                type: 'constructor' as 'constructor',
                stateMutability: item.stateMutability as 'nonpayable' | 'payable',
                inputs: (item.inputs || []).map((input: any) => ({
                  name: input.name || 'value',
                  type: input.type,
                  description: `Constructor parameter of type ${input.type}`,
                  components: input.components
                }))
              }))[0] || null,
            errors: []
          };

          console.log('[ChatContextService] Created contract artifact:', {
            name: contractArtifact.name,
            address: contractArtifact.address,
            functionsCount: contractArtifact.functions.length,
            eventsCount: contractArtifact.events?.length || 0,
            hasConstructor: !!contractArtifact.constructor,
            firstFunction: contractArtifact.functions[0]?.name || 'No functions'
          });

          // Actualizar el código fuente si está disponible
          if (lastContract.source_code) {
            let sourceCode = '';
            console.log('[ChatContextService] Contract has source code, processing...', {
              type: typeof lastContract.source_code,
              length: typeof lastContract.source_code === 'string' 
                ? lastContract.source_code.length 
                : JSON.stringify(lastContract.source_code).length
            });
            
            try {
              if (typeof lastContract.source_code === 'string') {
                console.log('[ChatContextService] Source code is string, length:', lastContract.source_code.length);
                console.log('[ChatContextService] Source code preview:', lastContract.source_code.substring(0, 100) + '...');
                
                try {
                  // Intentar parsear como JSON primero
                  const parsedSource = JSON.parse(lastContract.source_code);
                  console.log('[ChatContextService] Successfully parsed source code as JSON:', {
                    keys: Object.keys(parsedSource),
                    hasContent: 'content' in parsedSource,
                    contentType: 'content' in parsedSource ? typeof parsedSource.content : 'N/A'
                  });
                  
                  sourceCode = typeof parsedSource === 'object' && parsedSource !== null && 'content' in parsedSource
                    ? parsedSource.content
                    : lastContract.source_code;
                    
                  console.log('[ChatContextService] Extracted source code', 
                    sourceCode ? `(${sourceCode.length} chars)` : '(empty)', {
                      preview: sourceCode.substring(0, 100) + '...'
                    });
                } catch (parseError) {
                  // Si no es JSON válido, usar el string directamente
                  console.error('[ChatContextService] Source code is not valid JSON, using as-is:', parseError);
                  sourceCode = lastContract.source_code;
                }
              } else if (typeof lastContract.source_code === 'object' && lastContract.source_code !== null) {
                console.log('[ChatContextService] Source code is object:', {
                  keys: Object.keys(lastContract.source_code as Record<string, any>),
                  hasContent: 'content' in (lastContract.source_code as Record<string, any>),
                  contentType: 'content' in (lastContract.source_code as Record<string, any>) ? 
                    typeof (lastContract.source_code as Record<string, any>).content : 'N/A'
                });
                
                if ('content' in (lastContract.source_code as Record<string, any>)) {
                  sourceCode = (lastContract.source_code as Record<string, any>).content;
                  console.log('[ChatContextService] Extracted content from object:', 
                    sourceCode ? `(${sourceCode.length} chars)` : '(empty)');
                } else {
                  sourceCode = JSON.stringify(lastContract.source_code, null, 2);
                  console.log('[ChatContextService] Stringified object:', 
                    sourceCode ? `(${sourceCode.length} chars)` : '(empty)');
                }
              }
              
              if (sourceCode) {
                console.log('[ChatContextService] Setting current code in editor:', 
                  sourceCode.substring(0, 100) + '...');
                  
                // Set code to editor
                this.config.setCurrentCode(sourceCode);
                this.config.setShowCodeEditor(true);
                
                // Also add to virtual files if not already there
                const activeContext = this.getActiveContext();
                const existingFiles = Object.keys(activeContext?.virtualFiles || {})
                  .filter(path => path.endsWith('.sol'));
                
                console.log('[ChatContextService] Virtual files check:', {
                  hasActiveContext: !!activeContext,
                  existingFiles,
                  willAddNewFile: existingFiles.length === 0 && !!activeContext
                });
                
                if (existingFiles.length === 0 && activeContext) {
                  console.log('[ChatContextService] Adding contract to virtual files');
                  
                  const filePath = `contracts/${lastContract.name || 'Contract'}.sol`;
                  const virtualFile = {
                    content: sourceCode,
                    language: 'solidity',
                    timestamp: Date.now()
                  };
                  
                  console.log(`[ChatContextService] Created virtual file: ${filePath}`, {
                    contentLength: virtualFile.content.length,
                    language: virtualFile.language
                  });
                  
                  // Update context with the new file
                  const updatedContext = {
                    ...activeContext,
                    virtualFiles: {
                      ...activeContext.virtualFiles,
                      [filePath]: virtualFile
                    }
                  };
                  
                  console.log('[ChatContextService] Updating active context with new virtual file');
                  
                  // Update in context list
                  this.config.setConversationContexts(prevContexts => 
                    prevContexts.map((ctx: ConversationContext) => 
                      ctx.id === activeContext.id ? updatedContext : ctx
                    )
                  );
                  
                  // Set as active context
                  this.config.setActiveContext(updatedContext);
                  
                  // Force UI update by setting selected file
                  if (this.config.setSelectedFile) {
                    console.log(`[ChatContextService] Setting selected file to: ${filePath}`);
                    this.config.setSelectedFile(filePath);
                  }
                } else {
                  console.log('[ChatContextService] Contract already exists in virtual files or no active context:', {
                    existingFiles,
                    hasActiveContext: !!activeContext
                  });
                }
              } else {
                console.warn('[ChatContextService] No valid source code extracted');
              }
            } catch (e) {
              console.error('[ChatContextService] Error processing source code:', e);
              
              // Fallback: Try to use the source code directly anyway
              try {
                if (lastContract.source_code && typeof lastContract.source_code === 'string') {
                  console.log('[ChatContextService] Using source code directly as fallback');
                  this.config.setCurrentCode(lastContract.source_code);
                  this.config.setShowCodeEditor(true);
                  
                  // Also add to virtual files if not already there
                  const activeContext = this.getActiveContext();
                  if (activeContext) {
                    console.log('[ChatContextService] Adding fallback contract to virtual files');
                    
                    const filePath = `contracts/${lastContract.name || 'Contract'}.sol`;
                    const virtualFile = {
                      content: lastContract.source_code,
                      language: 'solidity',
                      timestamp: Date.now()
                    };
                    
                    // Update context with the new file
                    const updatedContext = {
                      ...activeContext,
                      virtualFiles: {
                        ...activeContext.virtualFiles,
                        [filePath]: virtualFile
                      }
                    };
                    
                    // Update in context list
                    this.config.setConversationContexts(prevContexts => 
                      prevContexts.map((ctx: ConversationContext) => 
                        ctx.id === activeContext.id ? updatedContext : ctx
                      )
                    );
                    
                    // Set as active context
                    this.config.setActiveContext(updatedContext);
                    
                    // Force UI update by setting selected file
                    if (this.config.setSelectedFile) {
                      console.log(`[ChatContextService] Setting selected file to: ${filePath}`);
                      this.config.setSelectedFile(filePath);
                    }
                  }
                }
              } catch (fallbackError) {
                console.error('[ChatContextService] Fallback also failed:', fallbackError);
              }
            }
          } else {
            console.warn('[ChatContextService] Contract does not have source code');
          }

          this.config.setCurrentArtifact(contractArtifact);
          
          // Update active context with contract information
          this.config.setActiveContext(prevContext => {
            if (!prevContext) return undefined;
            
            const updatedContext = {
              ...prevContext,
              contractAddress: lastContract.contract_address,
              contractName: lastContract.name,
              contractAbi: lastContract.abi
            };
            
            // Update conversation contexts
            this.config.setConversationContexts(prevContexts => 
              prevContexts.map((ctx: ConversationContext) => 
                ctx.id === prevContext.id ? updatedContext : ctx
              )
            );
            
            console.log('[ChatContextService] Updated context with contract information:', {
              id: updatedContext.id,
              name: updatedContext.name,
              contractAddress: updatedContext.contractAddress,
              contractName: updatedContext.contractName,
              hasAbi: !!updatedContext.contractAbi
            });
            
            return updatedContext;
          });

        } else {
          console.log('[ChatContextService] No deployed contracts found');
          this.config.setCurrentArtifact(this.config.demoArtifact);
        }
      } catch (error) {
        console.error('[ChatContextService] Error loading deployed contracts:', error);
        this.config.setCurrentArtifact(this.config.demoArtifact);
      }
    } catch (error) {
      console.error('[ChatContextService] Error in loadLastDeployedContract:', error);
      this.config.setCurrentArtifact(this.config.demoArtifact);
    }
  }

  /**
   * Registra una nueva versión del contrato actual asociándola al contexto de conversación activo
   * @param sourceCode Código fuente del contrato
   * @param name Nombre opcional del contrato
   * @returns Promise que se resuelve cuando la versión se ha registrado
   */
  public async registerContractVersion(sourceCode: string, name?: string): Promise<void> {
    try {
      // Obtener el contexto activo
      const activeContext = conversationService.getActiveContext();
      if (!activeContext) {
        console.error('[ChatContextService] Cannot register contract version: No active context');
        return;
      }

      // Verificar si ya existe una versión con el mismo código en este contexto
      if (activeContext.virtualFiles) {
        const existingFiles = Object.entries(activeContext.virtualFiles)
          .filter(([path, file]) => {
            const typedFile = file as { content: string, language: string };
            return path.endsWith('.sol') && 
                   typedFile.language === 'solidity' && 
                   typedFile.content === sourceCode;
          });
          
        if (existingFiles.length > 0) {
          console.log('[ChatContextService] Skipping duplicate contract version - already exists in context');
          return;
        }
      }

      // Datos de la nueva versión
      const timestamp = Date.now();
      const contractName = name || 'Contract';
      const fileName = `${contractName}.sol`;
      
      console.log('[ChatContextService] Registering new contract version:', {
        contextId: activeContext.id,
        fileName
      });

      try {
        // Primero, guardar el código en virtualFiles del contexto
        if (!activeContext.virtualFiles) {
          activeContext.virtualFiles = {};
        }
        
        // Crear la estructura de directorios si no existe
        const filePath = `contracts/${fileName}`;
        activeContext.virtualFiles[filePath] = {
          content: sourceCode,
          language: 'solidity',
          timestamp
        };
        
        // Persistir el contexto actualizado
        const currentActiveContext = conversationService.getActiveContext();
        conversationService.updateContext(
          activeContext.id,
          {
            name: activeContext.name || 'Chat',
            active: true,
            virtualFiles: activeContext.virtualFiles || {},
            workspaces: activeContext.workspaces || {}
          },
          activeContext
        );
        
        // También guardar en el sistema de archivos virtual si está disponible
        try {
          const virtualFS = await import('./virtual-fs').then(m => m.virtualFS);
          await virtualFS.writeFile(filePath, sourceCode);
        } catch (err) {
          console.warn('[ChatContextService] Could not save to virtual FS:', err);
        }
      } catch (error) {
        console.error('[ChatContextService] Error saving contract to virtual files:', error);
      }

      // Emitir evento para notificar a los componentes interesados
      window.dispatchEvent(new CustomEvent('contract-version-registered', {
        detail: {
          sourceCode,
          name: contractName,
          conversationId: activeContext.id,
          timestamp
        }
      }));

      this.config.addConsoleMessage(`New contract version registered: ${contractName}`, 'success');
    } catch (error) {
      console.error('[ChatContextService] Error registering contract version:', error);
      this.config.addConsoleMessage(`Error registering contract version: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  // Función auxiliar para convertir mensajes de la API al formato de la UI
  private convertApiMessageToUiMessage(apiMessage: any): Message {
    // Asegurarnos de que tenemos un timestamp válido
    let timestamp: number;
    try {
      if (apiMessage.metadata?.timestamp) {
        const date = new Date(apiMessage.metadata.timestamp);
        timestamp = date.getTime();
      } else if (apiMessage.created_at) {
        const date = new Date(apiMessage.created_at);
        timestamp = date.getTime();
      } else {
        timestamp = Date.now();
      }

      // Verificar que el timestamp es válido
      if (isNaN(timestamp)) {
        console.warn('[ChatContextService] Invalid timestamp, using current time');
        timestamp = Date.now();
      }
    } catch (error) {
      console.warn('[ChatContextService] Error processing timestamp, using current time:', error);
      timestamp = Date.now();
    }

    return {
      id: apiMessage.id || generateUniqueId(),
      text: apiMessage.content,
      sender: apiMessage.sender,
      timestamp,
      showAnimation: false // Always disable animation
    };
  }

  /**
   * Initialize a specific chat by ID
   */
  public async initializeChat(chatId: string, isNewChat: boolean): Promise<void> {
    try {
      console.log(`[ChatContextService] Initializing chat: ${chatId}, isNewChat: ${isNewChat}`);

      // Check if the chat ID already exists in our contexts
      const existingContext = this.currentContexts.find(ctx => ctx.id === chatId);
      if (existingContext) {
        console.log(`[ChatContextService] Found existing context with ID ${chatId}, activating it`);
        
        // Just activate the existing context rather than creating a new one
        this.handleContextSwitch(chatId);
        return;
      }

      // If not new chat, fetch chat data
      if (!isNewChat) {
        try {
          // Fetch chat messages from API if it's not a new chat
          const messages = await apiService.getMessages(chatId);
          console.log(`[ChatContextService] Retrieved ${messages.length} messages for chat ${chatId}`);

          // Convert API messages to UI format
          const convertedMessages: Message[] = messages.map(this.convertApiMessageToUiMessage);
          
          // Deduplicate messages
          console.log('[ChatContextService] Deduplicating messages');
          const uniqueMessagesMap = new Map();
          const messageSignatures = new Set();
          
          const uiMessages = convertedMessages.filter(msg => {
            // Si no tiene ID o no tiene texto, no es un mensaje válido
            if (!msg.id || !msg.text) return false;
            
            // Crear una firma única basada en contenido y remitente
            const signature = `${msg.sender}:${msg.text.substring(0, 100)}`;
            
            // Si ya hemos visto este mensaje (por ID o por contenido similar), filtrarlo
            if (uniqueMessagesMap.has(msg.id) || messageSignatures.has(signature)) {
              console.log(`[ChatContextService] Filtered duplicate message: ${signature.substring(0, 30)}...`);
              return false;
            }
            
            // Si es único, agregarlo a nuestros conjuntos de seguimiento
            uniqueMessagesMap.set(msg.id, true);
            messageSignatures.add(signature);
            return true;
          });
          
          console.log(`[ChatContextService] Deduplication: ${convertedMessages.length} -> ${uiMessages.length}`);

          // Create a conversation context from the loaded data
          const chatContext: ConversationContext = {
            id: chatId,
            name: 'Loaded Chat', // Default name, will update later
            messages: uiMessages,
            virtualFiles: {},
            workspaces: {},
            active: true,
            createdAt: new Date().toISOString()
          };

          // Register this as a new context in the conversation service
          const newContext = await conversationService.createNewContext(chatContext);
          
          // Make it active
          await conversationService.setActiveContext(chatId);

          // Update the UI state
          this.config.setMessages(uiMessages);
          this.config.setActiveContext(newContext);
          
          // Set all contexts
          const allContexts = [...this.currentContexts.filter(ctx => ctx.id !== chatId).map(ctx => ({
            ...ctx,
            active: false
          })), newContext];
          
          this.currentContexts = allContexts;
          this.config.setConversationContexts(allContexts);

          // Load last deployed contract if available - pass the wallet address
          if (this.config.address) {
            console.log(`[ChatContextService] Loading last deployed contract with wallet: ${this.config.address}`);
            await this.loadLastDeployedContract(chatId);
          } else {
            console.warn('[ChatContextService] No wallet address available, skipping contract loading');
          }

          // Update this in the ChatService too
          this.config.chatService.setCurrentChatId(chatId);

          console.log(`[ChatContextService] Successfully initialized chat ${chatId}`);
        } catch (error) {
          console.error(`[ChatContextService] Error initializing chat ${chatId}:`, error);
          this.config.addConsoleMessage('Error loading chat history', 'error');
        }
      }
    } catch (error) {
      console.error(`[ChatContextService] Error in initializeChat:`, error);
      this.config.addConsoleMessage(`Failed to initialize chat: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  /**
   * Gets the currently active context from conversation service
   * @returns The active context or undefined if none is active
   */
  private getActiveContext(): ConversationContext | undefined {
    return conversationService.getActiveContext();
  }

  private async persistUpdate(): Promise<void> {
    const timestamp = Date.now();
    console.log(`[ChatContextService] Persisting updates at ${timestamp}`);
    
    const activeContext = this.getActiveContext();
    
    // Update in conversation service
    if (activeContext) {
      conversationService.updateContext(
        activeContext.id,
        {
          name: activeContext.name || 'Chat',
          active: true,
          virtualFiles: activeContext.virtualFiles || {},
          workspaces: activeContext.workspaces || {}
        },
        activeContext
      );
    }
    
    // Save to virtual FS if available - fix the condition
    if (virtualFS) {
      // ... existing code ...
    }
  }
} 