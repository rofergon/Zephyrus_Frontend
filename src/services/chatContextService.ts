import { Message, ConversationContext, conversationService } from './conversationService';
import { ChatService } from './chatService';
import { virtualFS } from './virtual-fs';
import { DatabaseService } from './databaseService';
import { ContractArtifact } from '../types/contracts';
import { generateUniqueId } from '../utils/commonUtils';

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

  constructor(config: ChatContextConfig) {
    this.config = config;
  }

  /**
   * Crea un nuevo contexto de chat
   */
  public async createNewChat(): Promise<void> {
    try {
      if (!this.config.address) {
        console.error('[ChatContextService] No wallet address available');
        return;
      }

      // Crear una nueva conversación en la base de datos
      const newContext = await conversationService.createNewContext("New Chat");
      
      if (!newContext) {
        console.error('[ChatContextService] Failed to create new context');
        return;
      }

      // Actualizar el estado local
      const updatedContexts = [
        ...conversationService.getContexts().map(ctx => ({ ...ctx, active: false })),
        { ...newContext, active: true }
      ];

      this.config.setConversationContexts(updatedContexts);
      this.config.setActiveContext({ ...newContext, active: true });
      
      // Actualizar los servicios
      conversationService.setActiveContext(newContext.id);
      this.config.chatService.setCurrentChatId(newContext.id);
      
      console.log('[ChatContextService] New context created:', newContext);
    } catch (error) {
      console.error('[ChatContextService] Error creating new chat:', error);
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
      const selectedContext = contexts.find(ctx => ctx.id === contextId);
      
      if (!selectedContext) {
        console.error('[ChatContextService] Context not found:', {
          contextId,
          availableContexts: contexts.map(ctx => ({
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
      const updatedContexts = contexts.map(ctx => ({
        ...ctx,
        active: ctx.id === contextId
      }));
      
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

          this.config.setConversationContexts(updatedContexts.map(ctx => 
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
      const updatedContexts = contexts.filter(ctx => ctx.id !== contextId);
      
      // Si el contexto que se está borrando es el activo, activar el último contexto
      const activeContext = contexts.find(ctx => ctx.active);
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
      const contexts = conversationService.getContexts();
      console.log('[ChatContextService] Initializing with contexts:', contexts);
      
      if (contexts.length > 0) {
        const activeContext = contexts[contexts.length - 1];
        activeContext.active = true;
        
        const updatedContexts = contexts.map(ctx => ({
          ...ctx,
          active: ctx.id === activeContext.id
        }));
        
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
   * Añade un mensaje al contexto de chat actual
   */
  public addMessageToContext(message: string, isUserMessage: boolean, currentContext?: ConversationContext): Message {
    const newMessage: Message = {
      id: generateUniqueId(),
      text: message,
      sender: isUserMessage ? 'user' : 'ai',
      timestamp: Date.now(),
      showAnimation: !isUserMessage // Habilitar la animación de typing para mensajes de AI
    };

    // Actualizar el estado de mensajes
    this.config.setMessages(prevMessages => [...prevMessages, newMessage]);
    
    // Actualizar el contexto activo si existe
    if (currentContext) {
      // Actualizar los contextos en el servicio
      conversationService.addMessage(currentContext.id, newMessage);
      
      // Actualizar el estado del contexto activo
      this.config.setActiveContext(prevContext => {
        if (!prevContext) return undefined;
        const updatedContext = {
          ...prevContext,
          messages: [...prevContext.messages, newMessage]
        };
        
        // Actualizar el estado de los contextos
        this.config.setConversationContexts(prevContexts => 
          prevContexts.map(ctx => 
            ctx.id === prevContext.id ? updatedContext : ctx
          )
        );
        
        return updatedContext;
      });
    }

    return newMessage;
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
        const contracts = await this.config.databaseService.getDeployedContracts(this.config.address);
        
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
            sourceCodeExists: !!lastContract.sourceCode,
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
              prevContexts.map(ctx => 
                ctx.id === prevContext.id ? updatedContext : ctx
              )
            );
            
            // Update conversation service
            conversationService.updateContext(updatedContext);
            
            console.log('[ChatContextService] Updated context with contract information:', {
              id: updatedContext.id,
              name: updatedContext.name,
              contractAddress: updatedContext.contractAddress,
              contractName: updatedContext.contractName,
              hasAbi: !!updatedContext.contractAbi
            });
            
            return updatedContext;
          });
          
          // If there's source code, set it in the editor
          if (lastContract.sourceCode) {
            const sourceCode = typeof lastContract.sourceCode === 'string' 
              ? lastContract.sourceCode 
              : lastContract.sourceCode.content;
            console.log('[ChatContextService] Setting source code in editor, length:', sourceCode.length);
            this.config.setCurrentCode(sourceCode);
            this.config.setShowCodeEditor(true);
          }
        } else {
          console.log('[ChatContextService] No deployed contracts found for conversation:', conversationId);
          this.config.setCurrentArtifact(this.config.demoArtifact);
        }
      } catch (apiError) {
        // Handle API error specifically
        console.error('[ChatContextService] Error querying API for contracts:', {
          error: apiError instanceof Error ? apiError.message : String(apiError),
          address: this.config.address
        });
        
        // Show a user-friendly message
        this.config.addConsoleMessage(
          "Could not connect to the contracts database. Using demo contract instead.",
          "warning"
        );
        
        this.config.setCurrentArtifact(this.config.demoArtifact);
      }
    } catch (error) {
      console.error('[ChatContextService] Error loading last deployed contract:', error);
      this.config.setCurrentArtifact(this.config.demoArtifact);
      
      // Add a console message about the error
      this.config.addConsoleMessage(
        "An error occurred while loading contract data. Using demo contract instead.",
        "error"
      );
    }
  }
} 