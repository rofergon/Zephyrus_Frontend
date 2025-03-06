import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ChatService, type AgentResponse } from '../services/chatService';
import { virtualFS } from '../services/virtual-fs';
import { ResizableBox } from 'react-resizable';
import { 
  HomeIcon, ChatBubbleLeftRightIcon, DocumentDuplicateIcon, CogIcon, UsersIcon, WrenchScrewdriverIcon, CurrencyDollarIcon, ChevronLeftIcon, ChevronRightIcon,
  CodeBracketIcon, FolderIcon} from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import 'react-resizable/css/styles.css';
import { conversationService, Message, type ConversationContext } from '../services/conversationService';
import * as monaco from 'monaco-editor';
import '../styles/editor.css';
import '../styles/global.css';
import { ContractArtifact, ConsoleMessage } from '../types/contracts';
import { CompilationService } from '../services/compilationService';
import ContractViewer from '../components/contract/ContractViewer';
import ChatArea from '../components/chat/ChatArea';
import { generateUniqueId } from '../utils/commonUtils';
import ChatContexts from '../components/chat/ChatContexts';
import { DatabaseService } from '../services/databaseService';
import { ChatContextService } from '../services/chatContextService';
import FileExplorer from '../components/FileExplorer';
import WorkspaceManager from '../components/chat/WorkspaceManager';

interface VirtualFile {
  content: string;
  language: string;
  timestamp: number;
}

const demoArtifact: ContractArtifact = {
  name: "Contract Preview",
  description: "Your smart contract interface will appear here after compilation",
  functions: [],
  events: [],
  constructor: null,
  errors: [],
  abi: [],
  address: undefined
};

const AssistedChat: React.FC = (): JSX.Element => {
  const { address, isConnected } = useAccount();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<ContractArtifact | null>(demoArtifact);
  const [wsConnected, setWsConnected] = useState(false);
  const chatService = useRef<ChatService>(new ChatService());
  const [artifactWidth, setArtifactWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMaximized] = useState(false);
  const [isChatMaximized] = useState(false);
  const location = useLocation();
  const [conversationContexts, setConversationContexts] = useState<ConversationContext[]>([]);
  const [activeContext, setActiveContext] = useState<ConversationContext | undefined>();
  const [showCodeEditor, setShowCodeEditor] = useState(true);
  const [currentCode, setCurrentCode] = useState<string>('');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [consoleHeight, setConsoleHeight] = useState(200);
  const compilationService = useRef<CompilationService>(CompilationService.getInstance());
  const databaseService = useRef<DatabaseService>(DatabaseService.getInstance());
  const chatContextService = useRef<ChatContextService | null>(null);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false);
  const lastCompilationRef = useRef<string>('');
  const compilationInProgressRef = useRef<boolean>(false);
  const compilationQueueRef = useRef<{code: string, timestamp: number}[]>([]);
  const compilationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función para añadir mensajes a la consola
  const addConsoleMessage = (message: string, type: ConsoleMessage['type']) => {
    const newMessage: ConsoleMessage = {
      id: generateUniqueId(),
      type,
      content: message,
      timestamp: Date.now()
    };
    setConsoleMessages(prev => [...prev, newMessage]);
  };

  const compileCode = useCallback(async (code: string) => {
    if (!code || !editorRef.current || !monacoRef.current) return;
      
    const model = editorRef.current.getModel();
    if (!model) return;

    // Skip if this exact code was just compiled (within last 2 seconds)
    const now = Date.now();
    if (lastCompilationRef.current === code && now - (compilationQueueRef.current[0]?.timestamp || 0) < 2000) {
      console.log('[AssistedChat] Skipping duplicate compilation request');
      return;
    }

    // If compilation is already in progress, queue this request
    if (compilationInProgressRef.current) {
      console.log('[AssistedChat] Compilation in progress, queueing request');
      
      // Clear any existing timeout
      if (compilationTimeoutRef.current) {
        clearTimeout(compilationTimeoutRef.current);
      }
      
      // Add to queue, keeping only the most recent request
      compilationQueueRef.current = [{code, timestamp: now}];
      
      // Set a timeout to process the queue after current compilation finishes
      compilationTimeoutRef.current = setTimeout(() => {
        if (compilationQueueRef.current.length > 0 && !compilationInProgressRef.current) {
          const nextCompilation = compilationQueueRef.current.pop();
          if (nextCompilation) {
            compileCode(nextCompilation.code);
          }
          compilationQueueRef.current = [];
        }
      }, 1000);
      
      return;
    }

    // Mark compilation as in progress
    compilationInProgressRef.current = true;
    lastCompilationRef.current = code;

    try {
      console.log('[AssistedChat] Starting compilation');
      await compilationService.current.compileCode(code, monacoRef.current, model, addConsoleMessage, setCurrentArtifact);
    } catch (error) {
      console.error('[AssistedChat] Compilation error:', error);
      addConsoleMessage(`Compilation error: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      // Mark compilation as complete
      compilationInProgressRef.current = false;
      
      // Process any queued compilations
      if (compilationQueueRef.current.length > 0) {
        const nextCompilation = compilationQueueRef.current.pop();
        if (nextCompilation) {
          setTimeout(() => compileCode(nextCompilation.code), 500);
        }
        compilationQueueRef.current = [];
      }
    }
  }, []);

  // Initialize chat context service
  useEffect(() => {
    // Inicializar el servicio de contexto de chat si no existe
    if (!chatContextService.current) {
      console.log('[AssistedChat] Initializing ChatContextService');
      chatContextService.current = new ChatContextService({
        addConsoleMessage,
        setMessages,
        setConversationContexts,
        setActiveContext,
        setCurrentArtifact,
        setCurrentCode,
        setShowCodeEditor,
        compileCode,
        databaseService: databaseService.current,
        chatService: chatService.current,
        address,
        demoArtifact
      });
      
      // Hacer disponible el servicio globalmente para depuración
      (window as any).__chatContextService = chatContextService.current;
    }
    
    // Actualizar la dirección de wallet en el servicio de base de datos
    if (address) {
      databaseService.current.setCurrentWalletAddress(address);
      
      // Primero verificar que el usuario existe
      (async () => {
        try {
          console.log('[AssistedChat] Checking if user exists in database:', address);
          
          // Crear usuario si no existe
          try {
            await databaseService.current.getUser(address);
          } catch (error) {
            console.log('[AssistedChat] User not found, creating new user:', address);
            await databaseService.current.createUser(address);
          }
          
          // Obtener las conversaciones del usuario
          let conversations;
          try {
            conversations = await databaseService.current.getConversations(address);
            console.log('[AssistedChat] Retrieved user conversations:', conversations);
          } catch (error) {
            console.error('[AssistedChat] Error getting conversations:', error);
            conversations = [];
          }
          
          // Si no hay conversaciones, crear una por defecto
          if (!conversations || conversations.length === 0) {
            console.log('[AssistedChat] No conversations found, creating default conversation');
            try {
              const newConversation = await databaseService.current.createConversation(
                address, 
                'My First Chat'
              );
              
              console.log('[AssistedChat] Created default conversation:', newConversation);
              conversations = [newConversation];
            } catch (error) {
              console.error('[AssistedChat] Error creating default conversation:', error);
            }
          }

          // Usar el ID de la conversación más reciente
          if (conversations && conversations.length > 0) {
            const mostRecentChat = conversations[0];
            console.log('[AssistedChat] Using most recent chat:', mostRecentChat);

            // Desconectar WebSocket actual si existe
            chatService.current.disconnect();
            
            // Establecer el ID del chat y conectar WebSocket
            chatService.current.setCurrentChatId(mostRecentChat.id);
            chatService.current.connect(address, mostRecentChat.id);

            // Actualizar el contexto activo
            if (chatContextService.current) {
              await chatContextService.current.initializeChat(mostRecentChat.id, false);
            }
          }
          
        } catch (error) {
          console.error('[AssistedChat] Error initializing user and conversations:', error);
        }
      })();
    }
    
    return () => {
      // Limpiar la referencia global al desmontar el componente
      if ((window as any).__chatContextService === chatContextService.current) {
        delete (window as any).__chatContextService;
      }
    };
  }, [address]);

  // Handle file selection from FileExplorer
  const handleFileSelect = useCallback((path: string | null) => {
    if (!path) {
      setSelectedFile(null);
      return;
    }
    
    setSelectedFile(path);
    
    // Read file content and set appropriate state
    virtualFS.readFile(path).then(content => {
      if (path.endsWith('.sol')) {
        setCurrentCode(content);
        setShowCodeEditor(true);
        compileCode(content);
      }
      // Update active context with selected file info
      setActiveContext(prevContext => {
        if (!prevContext) return undefined;
        return {
          ...prevContext,
          currentFile: path
        };
      });
    }).catch(error => {
      console.error('[AssistedChat] Error reading file:', error);
      addConsoleMessage(`Error reading file: ${error}`, 'error');
    });
  }, [compileCode]);

  const menuItems = [
    { path: '/dashboard', icon: HomeIcon, text: 'Dashboard' },
    { path: '/chat', icon: ChatBubbleLeftRightIcon, text: 'Solidity Assistant' },
    { path: '/templates', icon: DocumentDuplicateIcon, text: 'Contract Templates' },
    { path: '/deploy', icon: CogIcon, text: 'Deploy' },
    { path: '/admin', icon: WrenchScrewdriverIcon, text: 'Contract Admin' },
    { path: '/bonding-tokens', icon: CurrencyDollarIcon, text: 'Bonding Tokens' },
    { path: '/social', icon: UsersIcon, text: 'Social' },
  ];

  // Funciones del contexto de chat usando el servicio
  const createNewChat = async () => {
    if (!address) {
      console.error('[AssistedChat] Cannot create new chat without wallet address');
      return;
    }
    
    try {
      // 1. Obtener chats existentes de la base de datos
      const existingChats = await databaseService.current.getConversations(address);
      console.log('[AssistedChat] Existing chats:', existingChats);
      
      let chatId: string;
      let isNewChat = false;
      
      if (!existingChats || existingChats.length === 0) {
        // 2. Si no hay chats existentes, crear uno nuevo en la base de datos
        const newDbConversation = await databaseService.current.createConversation(
          address,
          'New Chat'
        );
        
        if (!newDbConversation || !newDbConversation.id) {
          throw new Error('Failed to create conversation in database');
        }
        
        chatId = newDbConversation.id;
        isNewChat = true;
        console.log('[AssistedChat] Created new chat in database:', chatId);
      } else {
        // Usar el chat más reciente
        chatId = existingChats[0].id;
        console.log('[AssistedChat] Using existing chat:', chatId);
      }
      
      // 3. Desconectar WebSocket actual si existe
      chatService.current.disconnect();
      
      // 4. Establecer el ID del chat y reconectar WebSocket
      chatService.current.setCurrentChatId(chatId);
      chatService.current.connect(address, chatId);
      
      // 5. Inicializar el contexto local
      if (chatContextService.current) {
        await chatContextService.current.initializeChat(chatId, isNewChat);
        addConsoleMessage('Chat initialized successfully.', 'info');
      } else {
        throw new Error('Chat context service not available');
      }
    } catch (error) {
      console.error('[AssistedChat] Error in chat initialization:', error);
      addConsoleMessage('Failed to initialize chat.', 'error');
    }
  };
  
  const handleContextSwitch = (contextId: string) => {
    if (chatContextService.current) {
      chatContextService.current.handleContextSwitch(contextId);
    }
  };
  
  const handleContextDelete = (contextId: string) => {
    if (chatContextService.current) {
      chatContextService.current.handleContextDelete(contextId);
    }
  };

  // WebSocket connection effect
  useEffect(() => {
    const service = chatService.current;
    
    // Prevenir reconexiones innecesarias si ya estamos conectados
    if (service.isConnected() && wsConnected) {
      console.log('[AssistedChat] WebSocket already connected, skipping reconnection');
      return () => {}; // No necesitamos desconectar si no nos conectamos
    }

    console.log('[AssistedChat] Setting up WebSocket connection handlers');
    
    // Configurar manejador de chats cargados
    service.onChatsLoaded((chats) => {
      console.log('[AssistedChat] Chats loaded handler called with chats:', chats);
      
      if (Array.isArray(chats) && chats.length > 0) {
        // Procesar los chats recibidos
        const processedContexts = chats.map(ctx => ({
          ...ctx,
          messages: ctx.messages || [],
          virtualFiles: ctx.virtualFiles || {},
          active: false,
          workspaces: ctx.workspaces || {},
          createdAt: ctx.created_at
        }));
        
        // Establecer el chat más reciente como activo
        const lastContext = processedContexts[processedContexts.length - 1];
        lastContext.active = true;
        
        console.log('[AssistedChat] Setting active context from chats loaded:', lastContext.id);
        setActiveContext(lastContext);
        
        // Actualizar los mensajes del chat activo
        if (lastContext.messages && lastContext.messages.length > 0) {
          console.log('[AssistedChat] Setting messages from active context:', lastContext.messages.length);
          setMessages(lastContext.messages);
        }
        
        // Actualizar el ID actual en el servicio
        service.setCurrentChatId(lastContext.id);
        
        // Buscar y mostrar el código Solidity si existe
        if (lastContext.virtualFiles) {
          const solidityFiles = Object.entries(lastContext.virtualFiles)
            .filter(([_, file]: [string, any]) => file.language === 'solidity');
          
          if (solidityFiles.length > 0) {
            const [path, lastSolidityFile]: [string, any] = solidityFiles[solidityFiles.length - 1];
            console.log(`[AssistedChat] Loading Solidity file from context: ${path}`);
            setCurrentCode(lastSolidityFile.content);
            setShowCodeEditor(true);
            setSelectedFile(path);
            
            // Compilar el código si es posible
            if (editorRef.current && monacoRef.current) {
              console.log('[AssistedChat] Compiling loaded Solidity code');
              compileCode(lastSolidityFile.content);
            }
          }
        }
        
        // Actualizar la lista de contextos de conversación
        console.log('[AssistedChat] Updating conversation contexts with loaded chats');
        setConversationContexts(processedContexts);
      } else {
        console.warn('[AssistedChat] Received empty or invalid chats array:', chats);
      }
    });
    
    service.onConnectionChange((connected: boolean) => {
      console.log(`[AssistedChat] WebSocket connection status changed: ${connected}`);
      setWsConnected(connected);
      
      // Si perdimos la conexión, intentar reconectar con el chat activo
      if (!connected && activeContext?.id) {
        console.log('[AssistedChat] Lost connection, will attempt to reconnect with active chat');
        setTimeout(() => {
          if (address) {
            service.connect(address, activeContext.id);
          }
        }, 1000);
      }
    });

    service.onMessage((response: AgentResponse) => {
      console.log('[AssistedChat] Received message:', response);
      
      if (response.type === 'context_switched') {
        try {
          let contextData;
          try {
            contextData = JSON.parse(response.content);
          } catch (error) {
            // Si no se puede parsear, intentar usar el contenido directamente
            contextData = response.content;
          }
          
          console.log('[AssistedChat] Context switched event received:', contextData);
          
          if (contextData && contextData.id) {
            const switchedContext = {
              id: contextData.id,
              name: contextData.name || 'Unnamed Chat',
              messages: contextData.messages || [],
              virtualFiles: contextData.virtualFiles || {},
              workspaces: contextData.workspaces || {},
              active: true,
              createdAt: contextData.created_at || new Date().toISOString()
            };
            
            console.log('[AssistedChat] Setting active context from context_switched:', switchedContext.id);
            setActiveContext(switchedContext);
            
            // Actualizar mensajes
            if (switchedContext.messages && switchedContext.messages.length > 0) {
              console.log('[AssistedChat] Setting messages from switched context:', switchedContext.messages.length);
              setMessages(switchedContext.messages);
            }
            
            // Cargar archivos si existen
            if (switchedContext.virtualFiles) {
              const solidityFiles = Object.entries(switchedContext.virtualFiles)
                .filter(([_, file]: [string, any]) => file.language === 'solidity');
              
              if (solidityFiles.length > 0) {
                const [path, solFile]: [string, any] = solidityFiles[solidityFiles.length - 1];
                console.log(`[AssistedChat] Loading Solidity file from switched context: ${path}`);
                setCurrentCode(solFile.content);
                setShowCodeEditor(true);
                setSelectedFile(path);
                
                if (editorRef.current && monacoRef.current) {
                  console.log('[AssistedChat] Compiling loaded Solidity code from switched context');
                  compileCode(solFile.content);
                }
              }
            }
            
            // Actualizar contextos de conversación
            setConversationContexts(prevContexts => 
              prevContexts.map(ctx => ({
                ...ctx,
                active: ctx.id === switchedContext.id
              }))
            );
          }
        } catch (error) {
          console.error('[AssistedChat] Error processing context_switched:', error);
        }
      } else if (response.type === 'context_created') {
        try {
          const contextData = JSON.parse(response.content);
          console.log('[AssistedChat] New context created:', contextData);
          
          if (contextData && contextData.id) {
            const newChatContext = {
              id: contextData.id,
              name: contextData.name || 'New Chat',
              messages: [],
              virtualFiles: {},
              workspaces: {},
              active: true,
              createdAt: new Date().toISOString()
            };
            
            // Actualizar el contexto activo
            setActiveContext(newChatContext);
            
            // Actualizar la lista de contextos
            setConversationContexts(prevContexts => {
              // Desactivar todos los contextos anteriores
              const updatedContexts = prevContexts.map(ctx => ({
                ...ctx,
                active: false
              }));
              
              // Añadir el nuevo contexto
              return [...updatedContexts, newChatContext];
            });
            
            // Limpiar mensajes para el nuevo contexto
            setMessages([]);
          }
        } catch (error) {
          console.error('[AssistedChat] Error processing context_created:', error);
        }
      } else if (response.type === 'chat_message') {
        try {
          const messageData = JSON.parse(response.content);
          console.log('[AssistedChat] Received chat message:', messageData);
          
          if (messageData && messageData.text) {
            // Crear un nuevo mensaje
            const newMessage: Message = {
              id: generateUniqueId(),
              text: messageData.text,
              sender: 'ai',
              timestamp: Date.now(),
              isTyping: false
            };
            
            // Añadir el mensaje al estado
            setMessages(prev => [...prev, newMessage]);
            
            // Actualizar el contexto activo
            if (activeContext) {
              setActiveContext(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: [...prev.messages, newMessage]
                };
              });
              
              // Actualizar la lista de contextos
              setConversationContexts(prev => 
                prev.map(ctx => ctx.id === activeContext.id ?
                  { ...ctx, messages: [...ctx.messages, newMessage] } : ctx
                )
              );
            }
            
            // Actualizar estado de typing
            setIsTyping(false);
          }
        } catch (error) {
          console.error('[AssistedChat] Error processing chat_message:', error);
        }
      } else if (response.type === 'message') {
        // Handle regular message
        try {
          console.log('[AssistedChat] Received regular message:', response.content.substring(0, 50) + (response.content.length > 50 ? '...' : ''));
          
          // Create a new message
          const newMessage: Message = {
            id: generateUniqueId(),
            text: response.content,
            sender: 'ai',
            timestamp: Date.now(),
            isTyping: false
          };
          
          // Add the message to the state
          setMessages(prev => [...prev, newMessage]);
          
          // Update the active context
          if (activeContext) {
            setActiveContext(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: [...prev.messages, newMessage]
              };
            });
            
            // Update the contexts list
            setConversationContexts(prev => 
              prev.map(ctx => ctx.id === activeContext.id ?
                { ...ctx, messages: [...ctx.messages, newMessage] } : ctx
              )
            );
          }
          
          // Update typing state
          setIsTyping(false);
        } catch (error) {
          console.error('[AssistedChat] Error processing message:', error);
        }
      } else if (response.type === 'file_create' && response.metadata?.path) {
        try {
          console.log('[AssistedChat] Processing file creation:', response.metadata.path);
          const path = response.metadata.path;
          const language = response.metadata.language || 'solidity';
          const content = response.content;
          
          // Add file to virtual file system
          virtualFS.writeFile(path, content).then(() => {
            console.log('[AssistedChat] File written to virtual FS:', path);
            
            // Update active context with file info
            if (activeContext) {
              // Guarda el archivo en el contexto activo usando el método correcto
              // Ya que addFileToContext no existe, actualizamos el contexto manualmente
              const updatedVirtualFiles = {
                ...activeContext.virtualFiles,
                [path]: { content, language, timestamp: Date.now() }
              };
              
              const updatedContext = {
                ...activeContext,
                virtualFiles: updatedVirtualFiles
              };
              
              setActiveContext(updatedContext);
              
              // Update conversation contexts
              setConversationContexts(prevContexts => 
                prevContexts.map(ctx => 
                  ctx.id === activeContext.id ? updatedContext : ctx
                )
              );
            }
            
            // If it's a Solidity file, show it in the editor
            if (path.endsWith('.sol')) {
              setCurrentCode(content);
              setShowCodeEditor(true);
              setSelectedFile(path);
              compileCode(content);
              
              // Dispatch events to notify components about the code update
              const codeUpdateEvent = new CustomEvent('code_updated', { 
                detail: { path, content, language } 
              });
              window.dispatchEvent(codeUpdateEvent);
            }
          }).catch(error => {
            console.error('[AssistedChat] Error writing file:', error);
          });
        } catch (error) {
          console.error('[AssistedChat] Error processing file creation:', error);
        }
      } else if (response.type === 'code_edit' && response.metadata?.path) {
        try {
          console.log('[AssistedChat] Processing code edit:', response.metadata.path);
          const path = response.metadata.path;
          const language = response.metadata.language || 'solidity';
          const content = response.content;
          
          // Add or update file in virtual file system
          virtualFS.writeFile(path, content).then(() => {
            console.log('[AssistedChat] Code edited and written to virtual FS:', path);
            
            // Update active context with file info
            if (activeContext) {
              // Update the file in the active context
              const updatedVirtualFiles = {
                ...activeContext.virtualFiles,
                [path]: { content, language, timestamp: Date.now() }
              };
              
              const updatedContext = {
                ...activeContext,
                virtualFiles: updatedVirtualFiles
              };
              
              setActiveContext(updatedContext);
              
              // Update conversation contexts
              setConversationContexts(prevContexts => 
                prevContexts.map(ctx => 
                  ctx.id === activeContext.id ? updatedContext : ctx
                )
              );
            }
            
            // If it's a Solidity file, show it in the editor and compile it
            if (path.endsWith('.sol')) {
              setCurrentCode(content);
              setShowCodeEditor(true);
              setSelectedFile(path);
              compileCode(content);
              
              // Dispatch events to notify components about the code update
              const codeUpdateEvent = new CustomEvent('code_updated', { 
                detail: { path, content, language } 
              });
              window.dispatchEvent(codeUpdateEvent);
            }
          }).catch(error => {
            console.error('[AssistedChat] Error writing code edit to file:', error);
          });
        } catch (error) {
          console.error('[AssistedChat] Error processing code edit:', error);
        }
      }
    });

    // Solo conectar si tenemos una dirección de wallet y no estamos ya conectados
    if (address && !wsConnected) {
      console.log('[AssistedChat] Initializing WebSocket connection');
      
      // Usar el ID del chat activo si está disponible
      const activeContextId = activeContext?.id;
      if (activeContextId) {
        console.log('[AssistedChat] Connecting with active context ID:', activeContextId);
      } else {
        console.log('[AssistedChat] Connecting without active context ID');
      }
      
      // Conectar con la dirección de wallet y el ID de contexto activo
      service.connect(address, activeContextId);
    }

    return () => {
      // Solo desconectar si estamos saliendo de la aplicación o cambiando de dirección
      if (wsConnected) {
        console.log('[AssistedChat] Cleaning up WebSocket connection');
        service.disconnect();
      }
    };
  }, [address, wsConnected, compileCode]);

  const handleSubmit = (message: string) => {
    // Verificar si tenemos un contexto activo
    if (!activeContext) {
      console.error('[AssistedChat] No active context found when submitting message');
      addConsoleMessage('Error: No active conversation context. Creating a new one...', 'warning');
      
      // Crear un nuevo contexto si no existe ninguno
      createNewChat();
      
      // Posponer el envío del mensaje hasta que tengamos un contexto
      setTimeout(() => handleSubmit(message), 500);
      return;
    }

    // Verificar que el contexto tiene un ID válido y existe en la base de datos
    if (activeContext.id) {
      (async () => {
        try {
          // Verificar si la conversación existe en la base de datos
          const conversationExists = await databaseService.current.checkConversationExists(activeContext.id);
          
          if (!conversationExists && address) {
            console.log('[AssistedChat] Conversation does not exist in database, creating:', activeContext.id);
            
            try {
              // Crear la conversación en la base de datos
              const result = await databaseService.current.createConversation(
                address, 
                activeContext.name || 'New Conversation'
              );
              
              console.log('[AssistedChat] Created conversation in database:', result);
              
              // Si la conversación se creó con un ID diferente, actualizar el contexto local
              if (result.id && result.id !== activeContext.id) {
                console.log('[AssistedChat] Updating local context with database ID:', result.id);
                
                // Crear un nuevo contexto con el ID de la base de datos
                const newContext = await conversationService.createNewContext(
                  activeContext.name || 'New Conversation',
                  result.id
                );
                
                // Actualizar estados
                setActiveContext({...newContext, active: true});
                setConversationContexts(prev => 
                  prev.map(ctx => ctx.id === activeContext.id ? 
                    {...newContext, active: true} : 
                    {...ctx, active: false}
                  )
                );
              }
            } catch (error) {
              console.error('[AssistedChat] Failed to create conversation in database:', error);
              addConsoleMessage('Warning: Could not register conversation in database. Some features may be limited.', 'warning');
            }
          }
          
          // Continuar con el envío del mensaje
          proceedWithMessageSending(message);
          
        } catch (error) {
          console.error('[AssistedChat] Error checking conversation existence:', error);
          // Continuar con el envío del mensaje de todos modos
          proceedWithMessageSending(message);
        }
      })();
    } else {
      // Si no hay ID de contexto, simplemente continuar
      proceedWithMessageSending(message);
    }
  };

  // Función auxiliar para continuar con el envío del mensaje
  const proceedWithMessageSending = (message: string) => {
    // Usar el servicio para añadir el mensaje del usuario
    if (chatContextService.current) {
      chatContextService.current.addMessageToContext(message, true, activeContext);
    }

    setIsTyping(true);

    // Log the current state for debugging
    console.log('[AssistedChat] Current code state:', {
      showCodeEditor,
      hasCode: Boolean(currentCode),
      codeLength: currentCode?.length
    });

    // Create context with current code and file information
    const context = {
      currentCode: showCodeEditor && currentCode ? currentCode : undefined,
      currentArtifact: currentArtifact,
      virtualFiles: activeContext?.virtualFiles || {},
      currentFile: selectedFile,
      fileSystem: activeContext?.virtualFiles || {},
      // Add code directly in the message content if available
      code: currentCode || undefined
    };

    // Log the context for debugging
    console.log('[AssistedChat] Sending context:', {
      hasCurrentCode: Boolean(context.currentCode),
      hasCode: Boolean(context.code),
      currentFile: context.currentFile
    });

    // Modify message to include code if available
    const enhancedMessage = currentCode 
      ? `${message}\n\nCódigo actual:\n\`\`\`solidity\n${currentCode}\n\`\`\``
      : message;

    // Send message to agent with context
    chatService.current.sendMessage(enhancedMessage, context);
  };

  // Effect to ensure UI updates when messages change
  useEffect(() => {
    if (messages.length > 0) {
      console.log('[AssistedChat] Messages updated, refreshing UI components');
      // Trigger a state update to force re-render of child components
      setShowCodeEditor(prev => prev);
      
      // If we have new messages and the last one contains code, make sure UI reflects this
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.text && lastMessage.text.includes('```') && currentCode) {
        // Dispatch a code update event
        const codeUpdateEvent = new CustomEvent('code_updated', { 
          detail: { content: currentCode } 
        });
        window.dispatchEvent(codeUpdateEvent);
      }
    }
  }, [messages, currentCode]);

  // Efecto para asegurar que el código se cargue después de recargar la página
  useEffect(() => {
    if (activeContext && !currentCode) {
      console.log('[AssistedChat] Checking for code in active context after page reload');
      
      // Buscar archivos Solidity en el contexto activo
      if (activeContext.virtualFiles) {
        const solidityFiles = Object.entries(activeContext.virtualFiles)
          .filter(([_, file]: [string, any]) => file.language === 'solidity');
        
        if (solidityFiles.length > 0) {
          // Tomar el archivo Solidity más reciente
          const [path, lastSolidityFile]: [string, any] = solidityFiles[solidityFiles.length - 1];
          console.log(`[AssistedChat] Found Solidity file in context after reload: ${path}`);
          
          // Actualizar el código y mostrar el editor
          setCurrentCode(lastSolidityFile.content);
          setShowCodeEditor(true);
          setSelectedFile(path);
          
          // Compilar el código si es posible
          if (editorRef.current && monacoRef.current) {
            console.log('[AssistedChat] Compiling loaded Solidity code after reload');
            compileCode(lastSolidityFile.content);
          } else {
            console.log('[AssistedChat] Editor refs not ready, scheduling compilation for later');
            // Programar la compilación para cuando el editor esté listo
            setTimeout(() => {
              if (editorRef.current && monacoRef.current) {
                compileCode(lastSolidityFile.content);
              }
            }, 1000);
          }
        }
      }
      
      // También verificar en los workspaces del contexto activo
      if (activeContext.workspaces && activeContext.activeWorkspace) {
        const activeWorkspace = activeContext.workspaces[activeContext.activeWorkspace];
        if (activeWorkspace && activeWorkspace.files) {
          const solidityFiles = Object.entries(activeWorkspace.files)
            .filter(([_, file]: [string, any]) => file.language === 'solidity');
          
          if (solidityFiles.length > 0) {
            const [path, solFile]: [string, any] = solidityFiles[0];
            console.log(`[AssistedChat] Found Solidity file in active workspace after reload: ${path}`);
            
            setCurrentCode(solFile.content);
            setShowCodeEditor(true);
            setSelectedFile(path);
            
            if (editorRef.current && monacoRef.current) {
              compileCode(solFile.content);
            } else {
              setTimeout(() => {
                if (editorRef.current && monacoRef.current) {
                  compileCode(solFile.content);
                }
              }, 1000);
            }
          }
        }
      }
    }
  }, [activeContext, currentCode, editorRef.current, monacoRef.current, compileCode]);

  // Calculate initial widths
  useEffect(() => {
    const calculateWidths = () => {
      const totalAvailableWidth = window.innerWidth - (isSidebarOpen ? 256 : 64);
      const artifactInitialWidth = Math.floor(totalAvailableWidth * 0.5);
      setArtifactWidth(artifactInitialWidth);
    };

    calculateWidths();
    window.addEventListener('resize', calculateWidths);
    return () => window.removeEventListener('resize', calculateWidths);
  }, [isSidebarOpen]);

  // Workspace management handlers
  const handleWorkspaceCreate = (name: string, description?: string) => {
    if (!activeContext) return;
    
    const newWorkspace = conversationService.createWorkspace(
      activeContext.id, 
      name,
      description
    );
    
    if (newWorkspace) {
      // Update active context to include the new workspace
      setActiveContext(prevContext => {
        if (!prevContext) return undefined;
        return {
          ...prevContext,
          workspaces: {
            ...prevContext.workspaces,
            [newWorkspace.id]: newWorkspace
          },
          activeWorkspace: newWorkspace.id
        };
      });
      
      // Update conversation contexts
      setConversationContexts(prevContexts => 
        prevContexts.map(ctx => 
          ctx.id === activeContext.id 
            ? {
                ...ctx,
                workspaces: {
                  ...ctx.workspaces,
                  [newWorkspace.id]: newWorkspace
                },
                activeWorkspace: newWorkspace.id
              }
            : ctx
        )
      );
      
      addConsoleMessage(`Created workspace: ${name}`, 'info');
    }
  };
  
  const handleWorkspaceSwitch = (workspaceId: string) => {
    if (!activeContext) return;
    
    const success = conversationService.setActiveWorkspace(
      activeContext.id,
      workspaceId
    );
    
    if (success) {
      // Update active context
      setActiveContext(prevContext => {
        if (!prevContext) return undefined;
        return {
          ...prevContext,
          activeWorkspace: workspaceId
        };
      });
      
      // Update conversation contexts
      setConversationContexts(prevContexts => 
        prevContexts.map(ctx => 
          ctx.id === activeContext.id 
            ? {
                ...ctx,
                activeWorkspace: workspaceId
              }
            : ctx
        )
      );
      
      // Load files from the selected workspace
      const workspace = activeContext.workspaces[workspaceId];
      if (workspace) {
        // If there's a Solidity file in this workspace, load the first one
        const solidityFiles = Object.entries(workspace.files)
          .filter(([_, file]) => file.language === 'solidity');
          
        if (solidityFiles.length > 0) {
          const [path, file] = solidityFiles[0];
              setCurrentCode(file.content);
              setShowCodeEditor(true);
          setSelectedFile(path);
          compileCode(file.content);
        }
      }
    }
  };

  // Handler for when a user wants to view a specific conversation from version history
  const handleViewConversation = (contextId: string) => {
    if (contextId === activeContext?.id) {
      // Already in this context
      return;
    }
    
    // Switch to the selected conversation context
    handleContextSwitch(contextId);
  };

  // Si el usuario no está conectado, mostrar mensaje de conexión requerida
  if (!isConnected) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-center p-8 max-w-md mx-auto bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Wallet Connection Required</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to access the Zephyrus Contract Builder Agent.</p>
          <div className="flex justify-center">
            <appkit-button />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-900">
      {/* Main Header - Now spans full width */}
      <div className="flex-none h-16 border-b border-gray-700 bg-gray-800/80 backdrop-blur-sm px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Zephyrus Agent</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className={`text-sm ${wsConnected ? 'text-green-500' : 'text-red-500'}`}>
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Now starts below header */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] glass-morphism border-r border-gray-700 transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-16'
        } z-50`}>
          <div className="h-full px-3 py-4">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`gradient-border flex items-center p-3 text-base font-medium rounded-lg transition-all duration-200 group ${
                        isActive
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'text-gray-300 hover:bg-gray-800/50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 transition-colors duration-200 ${
                        isActive
                          ? 'text-blue-400'
                          : 'text-gray-400 group-hover:text-white'
                      }`} />
                      {isSidebarOpen && <span className="ml-3">{item.text}</span>}
                      {isSidebarOpen && isActive && (
                        <div className="ml-auto w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed left-0 bottom-4 w-8 h-8 bg-gray-800 text-gray-300 rounded-r-lg flex items-center justify-center hover:bg-gray-700 transition-all duration-200 z-50"
        >
          {isSidebarOpen ? (
            <ChevronLeftIcon className="w-5 h-5" />
          ) : (
            <ChevronRightIcon className="w-5 h-5" />
          )}
        </button>

        {/* Main Chat and Artifact Area */}
        <div className={`flex-1 flex ${isSidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300`}>
          {/* File Explorer Panel */}
          <div className={`flex-none ${isFileExplorerOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden`}>
            <FileExplorer 
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
            />
          </div>
          
          {/* Toggle FileExplorer Button */}
          <button
            onClick={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
            className="absolute left-[calc(16rem+64px)] top-20 w-6 h-16 bg-gray-800 text-gray-300 rounded-r-lg flex items-center justify-center hover:bg-gray-700 transition-all duration-200 z-40"
            style={{ left: `calc(${isSidebarOpen ? '16rem' : '4rem'} + ${isFileExplorerOpen ? '16rem' : '0px'})` }}
          >
            {isFileExplorerOpen ? (
              <ChevronLeftIcon className="w-4 h-4" />
            ) : (
              <FolderIcon className="w-4 h-4" />
            )}
          </button>

          {/* Main Chat and Artifact Area */}
          <ResizableBox
            width={window.innerWidth - artifactWidth - (isSidebarOpen ? 256 : 64) - (isFileExplorerOpen ? 256 : 0)}
            height={Infinity}
            axis="x"
            resizeHandles={['e']}
            minConstraints={[
              Math.floor((window.innerWidth - (isSidebarOpen ? 256 : 64) - (isFileExplorerOpen ? 256 : 0)) * 0.3),
              window.innerHeight
            ]}
            maxConstraints={[
              Math.floor((window.innerWidth - (isSidebarOpen ? 256 : 64) - (isFileExplorerOpen ? 256 : 0)) * 0.7),
              window.innerHeight
            ]}
            onResizeStart={() => setIsResizing(true)}
            onResizeStop={(_e, { size }) => {
              setIsResizing(false);
              setArtifactWidth(window.innerWidth - size.width - (isSidebarOpen ? 256 : 64) - (isFileExplorerOpen ? 256 : 0));
            }}
            handle={
              <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize bg-gray-700 hover:bg-blue-500 z-10" />
            }
          >
            <div className={`flex-1 h-full p-6 transition-all duration-300 ${
              isChatMaximized ? 'fixed inset-4 z-50 bg-gray-900/95 backdrop-blur-md' : ''
            }`}>
              <div className="flex flex-col h-full bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl">
                {/* Chat Header */}
                <div className="flex-none h-16 border-b border-gray-700 px-6 flex items-center justify-between bg-gray-800/95 rounded-t-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Chat</h2>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                        <span className={`text-sm ${wsConnected ? 'text-green-500' : 'text-red-500'}`}>
                          {wsConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Workspace Manager Toggle Button */}
                    <button
                      onClick={() => setShowWorkspaceManager(!showWorkspaceManager)}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        showWorkspaceManager 
                          ? 'text-blue-400 bg-blue-500/20 hover:bg-blue-500/30' 
                          : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 hover:bg-gray-900/80'
                      }`}
                      title="Manage Workspaces"
                    >
                      <FolderIcon className="w-5 h-5" />
                    </button>

                    {/* Code Editor Toggle Button - Existing */}
                    <button
                      onClick={() => setShowCodeEditor(!showCodeEditor)}
                      className="p-2 text-gray-400 hover:text-blue-400 bg-gray-900/50 rounded-lg hover:bg-gray-900/80 transition-all duration-200"
                      title={showCodeEditor ? "Show Contract Demo" : "Show Contract Code"}
                    >
                      <CodeBracketIcon className="w-5 h-5" />
                      <span className="text-sm">{showCodeEditor ? "Show Demo" : "Show Code"}</span>
                    </button>
                  </div>
                </div>

                {/* Workspace Manager Panel - Conditionally shown */}
                {showWorkspaceManager && activeContext && (
                  <div className="flex-none border-b border-gray-700">
                    <WorkspaceManager
                      contextId={activeContext.id}
                      workspaces={Object.values(activeContext.workspaces || {})}
                      activeWorkspaceId={activeContext.activeWorkspace}
                      onWorkspaceSwitch={handleWorkspaceSwitch}
                      onWorkspaceCreate={handleWorkspaceCreate}
                    />
                  </div>
                )}

                {/* Chat List */}
                <ChatContexts
                  contexts={conversationContexts}
                  onContextSwitch={handleContextSwitch}
                  onContextDelete={handleContextDelete}
                  onCreateNewChat={createNewChat}
                />

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900/50 to-gray-800/30">
                  <ChatArea
                    messages={messages}
                    input={input}
                    isTyping={isTyping}
                    isChatMaximized={isChatMaximized}
                    onInputChange={setInput}
                    onSubmit={handleSubmit}
                  />
                </div>

                
                <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent"></div>

                
              </div>
            </div>
          </ResizableBox>

          
          {currentArtifact && (
            <div 
              className={`flex-none flex flex-col p-6 transition-all duration-300 ease-in-out ${
                isMaximized ? 'fixed inset-4 z-50 bg-gray-900/95 backdrop-blur-md' : ''
              }`}
              style={{ width: isMaximized ? 'auto' : `${artifactWidth}px` }}
            >
              <div className="flex-1 flex flex-col bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl">
                <ContractViewer
                  currentArtifact={currentArtifact}
                  currentCode={currentCode}
                  showCodeEditor={showCodeEditor}
                  isMaximized={isMaximized}
                  consoleHeight={consoleHeight}
                  consoleMessages={consoleMessages}
                  onCodeChange={(value: string | undefined) => setCurrentCode(value || '')}
                  onCompile={compileCode}
                  onConsoleResize={setConsoleHeight}
                  editorRef={editorRef}
                  monacoRef={monacoRef}
                  conversationId={activeContext?.id || ''}
                  addConsoleMessage={addConsoleMessage}
                  conversationContexts={conversationContexts}
                  onViewConversation={handleViewConversation}
                  onArtifactUpdated={(updatedArtifact) => setCurrentArtifact(updatedArtifact)}
                />
              </div>
            </div>
          )}

          {/* Overlay to prevent interaction while resizing */}
          {isResizing && (
            <div className="fixed inset-0 bg-transparent z-50" />
          )}
        </div>
      </div>
    </div>
  );
};

export default AssistedChat;