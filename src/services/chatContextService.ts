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
  public async createNewChat(customContextId?: string): Promise<void> {
    try {
      console.log('[ChatContextService] Creating new chat');
      
      if (!this.config.address) {
        console.error('[ChatContextService] Cannot create chat without wallet address');
        return;
      }

      // Crear la conversación en la base de datos primero
      const newConversation = await apiService.createConversation(
        this.config.address,
        'New Chat'
      );

      console.log('[ChatContextService] Created conversation in database:', newConversation);

      if (!newConversation.id) {
        throw new Error('Failed to create conversation - no ID returned');
      }

      // Usar el ID devuelto por la base de datos
      const contextId = newConversation.id;
      
      // Verificar que el ID no esté duplicado
      if (this.currentContexts.some((ctx: ConversationContext) => ctx.id === contextId)) {
        console.warn(`[ChatContextService] Detected duplicate context ID: ${contextId}`);
        return;
      }
      
      // Crear nuevo contexto
      const newContext: ConversationContext = {
        id: contextId,
        name: newConversation.name || 'New Chat',
        messages: [],
        virtualFiles: {},
        workspaces: {},
        active: true,
        createdAt: newConversation.created_at || new Date().toISOString(),
      };
      
      // Actualizar el servicio de conversación
      conversationService.createNewContext(newContext);
      
      // Desactivar contexto actual
      const updatedContexts = this.currentContexts.map((ctx: ConversationContext) => ({
        ...ctx,
        active: false
      }));
      
      // Añadir el nuevo contexto
      const newContexts = [...updatedContexts, newContext];
      
      // Actualizar el estado local
      this.currentContexts = newContexts;
      
      // Actualizar el estado
      this.config.setConversationContexts(newContexts);
      this.config.setActiveContext(newContext);
      this.config.chatService.setCurrentChatId(newContext.id);
      
      console.log(`[ChatContextService] New chat created with ID: ${contextId}, total contexts: ${newContexts.length}`);
    } catch (error) {
      console.error('[ChatContextService] Error creating new chat:', error);
      this.config.addConsoleMessage('Failed to create new chat', 'error');
      throw error;
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
          contracts: contracts.map(c => ({
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
      console.log('[ChatContextService] Starting to load last deployed contract:', {
        address: this.config.address,
        timestamp: new Date().toISOString()
      });

      if (!this.config.address) {
        console.error('[ChatContextService] No wallet address available');
        this.config.setCurrentArtifact(this.config.demoArtifact);
        return;
      }

      try {
        // Primero intentar obtener contratos por conversación
        let contracts = await this.config.databaseService.getContractsByConversation(conversationId);
        
        // Si no hay contratos para esta conversación, obtener todos los contratos del usuario
        if (!contracts || contracts.length === 0) {
          contracts = await this.config.databaseService.getDeployedContracts(this.config.address);
        }
        
        console.log('[ChatContextService] Database query completed:', {
          address: this.config.address,
          contractsFound: contracts.length,
          contracts: contracts.map(c => ({
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
            try {
              if (typeof lastContract.source_code === 'string') {
                try {
                  // Intentar parsear como JSON primero
                  const parsedSource = JSON.parse(lastContract.source_code);
                  sourceCode = typeof parsedSource === 'object' && parsedSource !== null && 'content' in parsedSource
                    ? parsedSource.content
                    : lastContract.source_code;
                } catch {
                  // Si no es JSON válido, usar el string directamente
                  sourceCode = lastContract.source_code;
                }
              }
              
              if (sourceCode) {
                this.config.setCurrentCode(sourceCode);
                this.config.setShowCodeEditor(true);
              }
            } catch (e) {
              console.error('[ChatContextService] Error parsing source code:', e);
            }
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
        conversationService.updateContext(activeContext);
        
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
   * Inicializa un chat con un ID específico
   * @param chatId ID del chat de la base de datos
   * @param isNewChat Indica si es un chat nuevo o existente
   */
  public async initializeChat(chatId: string, isNewChat: boolean): Promise<void> {
    try {
      console.log('[ChatContextService] Initializing chat:', {
        chatId,
        isNewChat,
        address: this.config.address
      });

      if (!chatId) {
        throw new Error('Chat ID is required');
      }

      // Cargar los mensajes del chat
      let messages: Message[] = [];
      try {
        const apiMessages = await apiService.getMessages(chatId);
        messages = apiMessages.map(msg => this.convertApiMessageToUiMessage(msg));
        console.log('[ChatContextService] Loaded messages from API:', {
          chatId,
          messageCount: messages.length
        });
      } catch (error) {
        console.error('[ChatContextService] Error loading messages from API:', error);
      }

      // Crear el contexto base con los mensajes cargados
      const newContext: ConversationContext = {
        id: chatId,
        name: isNewChat ? 'New Chat' : `Chat ${chatId.substring(0, 8)}`,
        messages,
        virtualFiles: {},
        workspaces: {},
        active: true,
        createdAt: new Date().toISOString()
      };

      // Desactivar contextos actuales
      const updatedContexts = this.currentContexts.map((ctx: ConversationContext) => ({
        ...ctx,
        active: false
      }));

      // Añadir el nuevo contexto
      const newContexts = [...updatedContexts, newContext];

      // Actualizar estado local
      this.currentContexts = newContexts;
      
      // Actualizar el servicio de conversación
      conversationService.setContexts(newContexts);
      conversationService.setActiveContext(chatId);
      
      // Actualizar estados en la UI
      this.config.setConversationContexts(newContexts);
      this.config.setActiveContext(newContext);
      this.config.setMessages(newContext.messages);

      // Cargar contratos asociados si existen
      if (this.config.address) {
        try {
          const contracts = await apiService.getContracts(this.config.address);
          const chatContracts = contracts.filter(c => c.conversation_id === chatId);
          
          if (chatContracts.length > 0) {
            const lastContract = chatContracts[0]; // Usar el contrato más reciente
            console.log('[ChatContextService] Loading associated contract:', lastContract.name);
            
            if (lastContract.source_code) {
              this.config.setCurrentCode(lastContract.source_code);
              this.config.setShowCodeEditor(true);
              await this.config.compileCode(lastContract.source_code);
            }
          }
        } catch (error) {
          console.error('[ChatContextService] Error loading associated contracts:', error);
        }
      }

      console.log('[ChatContextService] Chat initialization completed:', {
        chatId,
        contextCount: newContexts.length
      });
    } catch (error) {
      console.error('[ChatContextService] Error in initializeChat:', error);
      throw error;
    }
  }
} 