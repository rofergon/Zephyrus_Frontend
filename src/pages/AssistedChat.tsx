import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ChatService } from '../services/chatService';
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
import { ApiService } from '../services/apiService';


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

const AssistedChat: React.FC = (): JSX.Element => {
  const { address, isConnected } = useAccount();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<ContractArtifact | null>(demoArtifact);
  const [wsConnected, setWsConnected] = useState(false);
  const chatService = useRef<ChatService>(new ChatService());
  const [artifactWidth, setArtifactWidth] = useState(window.innerWidth * 0.3);
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
  const apiService = useRef(ApiService.getInstance());
  const [] = useState(false);
  const lastCompiledCodeRef = useRef<string | null>(null);

  // Add this helper function at the top level of the component
  const ensureStringContent = (content: any): string => {
    if (content === null || content === undefined) {
      console.warn('[AssistedChat] Content is null or undefined, using empty string');
      return '';
    }
    
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object') {
      console.warn('[AssistedChat] Content is an object, attempting to extract string value', content);
      
      // Check for content in 'replace' property (used by edit actions)
      if ('replace' in content) {
        console.log('[AssistedChat] Extracting content from "replace" property');
        return typeof content.replace === 'string' ? content.replace : String(content.replace);
      } 
      // Check for content in 'content' property
      else if ('content' in content) {
        console.log('[AssistedChat] Extracting content from "content" property');
        return typeof content.content === 'string' ? content.content : String(content.content);
      }
      // Check for new edit format
      else if ('edit' in content && typeof content.edit === 'object' && content.edit !== null) {
        console.log('[AssistedChat] Extracting content from "edit" object');
        if ('replace' in content.edit) {
          return typeof content.edit.replace === 'string' ? content.edit.replace : String(content.edit.replace);
        }
      }
      // Try using toString if it's not Object.prototype.toString
      else if (content.toString && content.toString !== Object.prototype.toString) {
        console.log('[AssistedChat] Using toString() method');
        return content.toString();
      } 
      // Last resort: JSON.stringify
      else {
        try {
          console.log('[AssistedChat] Converting to JSON string');
          return JSON.stringify(content, null, 2);
        } catch (err) {
          console.error('[AssistedChat] Failed to convert to JSON:', err);
          return '// Error: Could not convert content to string';
        }
      }
    }
    
    // For any other type, convert to string
    return String(content);
  };

  // Function to add messages to the console
  const addConsoleMessage = (message: string, type: ConsoleMessage['type']) => {
    const newMessage: ConsoleMessage = {
      id: generateUniqueId(),
      type,
      content: message,
      timestamp: Date.now()
    };
    setConsoleMessages(prev => [...prev, newMessage]);
  };

  // Improved compilation function with stronger debouncing
  const compileCode = useCallback(async (code: string): Promise<void> => {
    if (!code || !editorRef.current || !monacoRef.current) return;
      
    const model = editorRef.current.getModel();
    if (!model) return;
    
    // Check if a compilation is already in progress
    if (compilationInProgressRef.current) {
      console.log('[AssistedChat] Compilation already in progress, queuing:', code.substring(0, 20) + '...');
      compilationQueueRef.current.push({
        code,
        timestamp: Date.now()
      });
      
      // Set a timeout to check if the compilation completes within 2 seconds
      setTimeout(() => {
        if (compilationQueueRef.current.length > 0 && !compilationInProgressRef.current) {
          const nextCompilation = compilationQueueRef.current.pop();
          if (nextCompilation) {
            compileCode(nextCompilation.code);
          }
          compilationQueueRef.current = [];
        }
      }, 2000);
      
      return;
    }

    // Skip if the code is identical to the last compiled code
    if (lastCompiledCodeRef.current === code) {
      console.log('[AssistedChat] Skipping compilation - code already compiled');
      return;
    }

    // Mark compilation as in progress
    compilationInProgressRef.current = true;
    lastCompilationRef.current = code;
    lastCompiledCodeRef.current = code;

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
          // Increased delay to 1000ms
          setTimeout(() => {
            compileCode(nextCompilation.code);
          }, 1000);
        }
      }
    }
  }, []);

  // Initialize chat context service
  useEffect(() => {
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

      // Store the service in window for debugging
      (window as any).__chatContextService = chatContextService.current;
    } else if (address) {
      // Update the address in the config when it changes
      console.log('[AssistedChat] Updating wallet address in ChatContextService:', address);
      chatContextService.current.updateWalletAddress(address);
    }
    
    // Update wallet address in the database service
    if (address) {
      (async () => {
        try {
          console.log('[AssistedChat] Loading user data and conversations:', address);
          
          // Load conversations from the API
          let loadedConversations = await apiService.current.getConversations(address);
          console.log('[AssistedChat] Retrieved conversations from API:', loadedConversations);
          
          // If there are no conversations, create the first one
          if (!loadedConversations || loadedConversations.length === 0) {
            console.log('[AssistedChat] No conversations found, creating first chat');
            
            try {
              // Create new conversation in the database
              const newConversation = await apiService.current.createConversation(
                address,
                'My First Chat'
              );
              
              console.log('[AssistedChat] Created first conversation:', newConversation);
              loadedConversations = [newConversation];
              
              // Show welcome message
              addConsoleMessage('Welcome! Your first chat has been created.', 'success');
            } catch (error) {
              console.error('[AssistedChat] Error creating first conversation:', error);
              addConsoleMessage('Error creating your first chat.', 'error');
              return;
            }
          }

          // Use the most recent conversation
          if (loadedConversations && loadedConversations.length > 0) {
            const mostRecentChat = loadedConversations[0];
            console.log('[AssistedChat] Using most recent chat:', mostRecentChat);

            // Disconnect any existing WebSocket connection
            chatService.current.disconnect();
            
            // Important: Set the chat ID before connecting
            chatService.current.setCurrentChatId(mostRecentChat.id);
            
            // Important: Make sure conversationService is aware of this ID
            await conversationService.initializeSession(mostRecentChat.id);
            
            // Important: Clear any existing contexts to avoid duplicates
            conversationService.clearContexts();
            
            // Now it's safe to connect the WebSocket with the correct ID
            chatService.current.connect(address, mostRecentChat.id);

            // Set the active context in the UI
            const newContext: ConversationContext = {
              id: mostRecentChat.id,
              name: mostRecentChat.name || 'Loaded Chat',
              messages: mostRecentChat.messages || [],
              virtualFiles: mostRecentChat.virtualFiles || {},
              workspaces: mostRecentChat.workspaces || {},
              active: true,
              createdAt: mostRecentChat.created_at || new Date().toISOString()
            };
            
            // Update UI states
            setActiveContext(newContext);
            setConversationContexts([newContext]);

            // IMPORTANTE: Deduplicar mensajes antes de establecerlos
            if (Array.isArray(mostRecentChat.messages) && mostRecentChat.messages.length > 0) {
              console.log('[AssistedChat] Deduplicating messages before setting UI state');
              
              // Usamos un Map para deduplicar por ID y un Set para deduplicar por contenido
              const uniqueMessagesMap = new Map();
              const messageSignatures = new Set();
              
              const deduplicatedMessages = mostRecentChat.messages.filter((msg: { id: any; text: string; sender: any; }) => {
                // Si no tiene ID o no tiene texto, no es un mensaje válido
                if (!msg.id || !msg.text) return false;
                
                // Crear una firma única basada en contenido y remitente
                const signature = `${msg.sender}:${msg.text.substring(0, 100)}`;
                
                // Si ya hemos visto este mensaje (por ID o por contenido similar), filtrarlo
                if (uniqueMessagesMap.has(msg.id) || messageSignatures.has(signature)) {
                  console.log(`[AssistedChat] Filtered duplicate message: ${signature.substring(0, 30)}...`);
                  return false;
                }
                
                // Si es único, agregarlo a nuestros conjuntos de seguimiento
                uniqueMessagesMap.set(msg.id, true);
                messageSignatures.add(signature);
                return true;
              });
              
              console.log(`[AssistedChat] Deduplication: ${mostRecentChat.messages.length} -> ${deduplicatedMessages.length}`);
              setMessages(deduplicatedMessages);
            } else {
              setMessages(mostRecentChat.messages || []);
            }

            // Initialize chat with loaded history
            if (chatContextService.current) {
              await chatContextService.current.initializeChat(mostRecentChat.id, false);
            }
          }
        } catch (error) {
          console.error('[AssistedChat] Error initializing chat data:', error);
          addConsoleMessage('Error loading chat history. Please try again later.', 'error');
        }
      })();
    }
    
    return () => {
      if ((window as any).__chatContextService === chatContextService.current) {
        delete (window as any).__chatContextService;
      }
    };
  }, [address]);

  // WebSocket connection effect - Modify to prevent duplicate connection
  useEffect(() => {
    const service = chatService.current;
    const handleChatConnection = (connected: boolean) => {
      setWsConnected(connected);
      
      if (connected) {
        console.log('[AssistedChat] WebSocket connected, loading chats if needed');
      }
    };
    
    // Register the connection change handler
    service.onConnectionChange(handleChatConnection);
    
    // Register the message handler to update the UI
    service.onMessage((response) => {
      // Add to messages state
      setMessages(prevMessages => {
        // Append the new message if it's not already in the list
        const isDuplicate = prevMessages.some(msg => 
          msg.text === response.content && msg.sender === 'ai'
        );
        
        if (isDuplicate) {
          console.log('[AssistedChat] Duplicate message detected, not adding to UI:', response.content.substring(0, 20) + '...');
          return prevMessages;
        }
        
        // Create a new message object
        const newMessage: Message = {
          id: generateUniqueId(),
          text: response.content,
          sender: 'ai',
          timestamp: Date.now(),
          isTyping: false,
          showAnimation: false,
          noCompile: response.metadata?.noCompile || false
        };
        
        console.log('[AssistedChat] Adding new message to UI:', newMessage.text.substring(0, 20) + '...');
        
        // Add the new message to the state
        return [...prevMessages, newMessage];
      });
      
      // Set typing state to false when a message is received
      setIsTyping(false);
    });
    
    // Register the context handler to update the UI
    service.onChatsLoaded((chats) => {
      console.log('[AssistedChat] Chats loaded handler called with:', chats.length, 'chats');
      
      if (chats.length > 0) {
        // Map the chats to conversation contexts
        const contexts = chats.map(chat => ({
          id: chat.id,
          name: chat.name || 'Unnamed Chat',
          messages: chat.messages || [],
          virtualFiles: chat.virtualFiles || {},
          workspaces: chat.workspaces || {},
          active: chat.id === service.getCurrentChatId(),
          createdAt: chat.created_at
        }));
        
        // Update the UI with the conversation contexts
        setConversationContexts(contexts);
        
        // Set the active context
        const activeContext = contexts.find(ctx => ctx.active);
        if (activeContext) {
          setActiveContext(activeContext);
          
          // Also update the messages state with deduplication
          if (Array.isArray(activeContext.messages)) {
            console.log('[AssistedChat] Deduplicating messages in onChatsLoaded');
            
            // Usamos un Map para deduplicar por ID y un Set para deduplicar por contenido
            const uniqueMessagesMap = new Map();
            const messageSignatures = new Set();
            
            const deduplicatedMessages = activeContext.messages.filter(msg => {
              // Si no tiene ID o no tiene texto, no es un mensaje válido
              if (!msg.id || !msg.text) return false;
              
              // Crear una firma única basada en contenido y remitente
              const signature = `${msg.sender}:${msg.text.substring(0, 100)}`;
              
              // Si ya hemos visto este mensaje (por ID o por contenido similar), filtrarlo
              if (uniqueMessagesMap.has(msg.id) || messageSignatures.has(signature)) {
                console.log(`[AssistedChat] Filtered duplicate message: ${signature.substring(0, 30)}...`);
                return false;
              }
              
              // Si es único, agregarlo a nuestros conjuntos de seguimiento
              uniqueMessagesMap.set(msg.id, true);
              messageSignatures.add(signature);
              return true;
            });
            
            console.log(`[AssistedChat] onChatsLoaded deduplication: ${activeContext.messages.length} -> ${deduplicatedMessages.length}`);
            setMessages(deduplicatedMessages);
          }
        }
      }
    });
    
    return () => {
      // Cleanup - but don't disconnect the WebSocket
      console.log('[AssistedChat] Cleaning up WebSocket connection handlers');
      // We're only cleaning up event handlers, not closing the connection
    };
  }, []);

  // Effect to compile code when currentCode changes
  useEffect(() => {
    if (currentCode && currentCode.trim() !== '' && !isMaximized && !compilationInProgressRef.current) {
      console.log('[AssistedChat] Current code updated, triggering compilation');
      // Debounce compilation to avoid rapid recompilations
      if (compilationTimeoutRef.current) {
        clearTimeout(compilationTimeoutRef.current);
      }
      
      compilationTimeoutRef.current = setTimeout(() => {
        compileCode(currentCode);
      }, 1000); // Delay compilation by 1 second
    }
  }, [currentCode, compileCode, isMaximized]);

  // Effect to handle window resize and maintain proper artifact width proportions
  useEffect(() => {
    const handleResize = () => {
      // Maintain the artifact width as 30% of window if not manually resized
      if (!isResizing) {
        const newWidth = Math.floor(window.innerWidth * 0.3);
        setArtifactWidth(newWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initialize with a reasonable default width (30% of screen)
    if (artifactWidth === 0) {
      setArtifactWidth(Math.floor(window.innerWidth * 0.3));
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [artifactWidth, isResizing]);

  // Efecto para sincronizar código del contrato con el editor cuando se carga un chat
  useEffect(() => {
    if (!activeContext || !activeContext.virtualFiles) return;
    
    console.log('[AssistedChat] Checking for contract files in active context:', activeContext.id);
    
    // Buscar archivos Solidity en los archivos virtuales del contexto
    const solidityFiles = Object.entries(activeContext.virtualFiles)
      .filter(([path, file]) => {
        const typedFile = file as { content: string, language: string, timestamp: number };
        return path.endsWith('.sol') && typedFile.language === 'solidity';
      })
      .sort(([, a], [, b]) => {
        const fileA = a as { content: string, language: string, timestamp: number };
        const fileB = b as { content: string, language: string, timestamp: number };
        return fileB.timestamp - fileA.timestamp; // Ordenar por timestamp descendente
      });
    
    if (solidityFiles.length > 0) {
      // Usar el archivo Solidity más reciente
      const [filePath, fileData] = solidityFiles[0];
      const typedFileData = fileData as { content: string, language: string, timestamp: number };
      const content = typedFileData.content;
      
      console.log(`[AssistedChat] Found Solidity file in context: ${filePath}, loading into editor`);
      
      // Actualizar el código en el editor
      setCurrentCode(content);
      setShowCodeEditor(true);
      setSelectedFile(filePath);
      
      // Compilar el código después de un breve retraso
      setTimeout(() => {
        console.log('[AssistedChat] Compiling loaded Solidity file:', filePath);
        compileCode(content);
      }, 500);
    } else {
      console.log('[AssistedChat] No Solidity files found in active context');
    }
  }, [activeContext, compileCode, setSelectedFile]);

  // Efecto para seleccionar automáticamente archivos Solidity recién creados
  useEffect(() => {
    // Función que maneja la selección automática de archivos
    const handleAutoSelectFile = (event: CustomEvent) => {
      const { path, content } = event.detail;
      console.log(`[AssistedChat] Auto-selecting file: ${path}`);
      
      // Actualizar los estados necesarios para mostrar el archivo
      setSelectedFile(path);
      
      if (path.endsWith('.sol')) {
        const processedContent = ensureStringContent(content);
        setCurrentCode(processedContent);
        setShowCodeEditor(true);
        
        // Compilar el código después de un breve retraso para permitir que el editor se actualice
        setTimeout(() => {
          console.log('[AssistedChat] Compiling newly created Solidity file');
          compileCode(processedContent);
        }, 500);
        
        // Actualizar el contexto activo
        setActiveContext(prevContext => {
          if (!prevContext) return undefined;
          return {
            ...prevContext,
            currentFile: path
          };
        });
      }
    };
    
    // Registrar el listener para el evento personalizado
    window.addEventListener('auto-select-file', handleAutoSelectFile as EventListener);
    
    // Limpiar el listener cuando el componente se desmonte
    return () => {
      window.removeEventListener('auto-select-file', handleAutoSelectFile as EventListener);
    };
  }, [compileCode]);

  // Connection initialization effect - Separated to prevent multiple connections
  useEffect(() => {
    if (address) {
      console.log('[AssistedChat] Initializing WebSocket connection');
      
      if (activeContext) {
        console.log(`[AssistedChat] Connecting with active context ID: ${activeContext.id}`);
        chatService.current.connect(address, activeContext.id);
      } else {
        console.log('[AssistedChat] Connecting without active context ID');
        chatService.current.connect(address);
      }
    }
    
    return () => {
      // Only disconnect when component unmounts or address changes
      chatService.current.disconnect();
    };
  }, [address]); // Only re-run if address changes

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
        setCurrentCode(ensureStringContent(content));
        setShowCodeEditor(true);
        compileCode(ensureStringContent(content));
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
      addConsoleMessage('Please connect your wallet first', 'error');
      return;
    }

    try {
      console.log('[AssistedChat] Creating new chat for wallet:', address);
      
      // Crear nueva conversación usando el servicio de contexto
      if (chatContextService.current) {
        await chatContextService.current.createNewChat();
        addConsoleMessage('New chat created successfully', 'success');
      } else {
        throw new Error('Chat context service not initialized');
      }
    } catch (error) {
      console.error('[AssistedChat] Error creating new chat:', error);
      addConsoleMessage('Failed to create new chat', 'error');
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

  // Add missing handler for viewing a conversation from contract viewer
  const handleViewConversation = (conversationId: string) => {
    console.log(`[AssistedChat] Viewing conversation: ${conversationId}`);
    handleContextSwitch(conversationId);
  };

  // Add missing handler for workspace operations
  const handleWorkspaceSwitch = (workspaceId: string) => {
    if (activeContext && conversationService) {
      console.log(`[AssistedChat] Switching to workspace: ${workspaceId}`);
      conversationService.setActiveWorkspace(activeContext.id, workspaceId);
    }
  };

  const handleWorkspaceCreate = (name: string, description?: string) => {
    if (activeContext && conversationService) {
      console.log(`[AssistedChat] Creating new workspace: ${name}`);
      return conversationService.createWorkspace(activeContext.id, name, description);
    }
    return null;
  };

  // Helper function to proceed with message sending
  const proceedWithMessageSending = (message: string) => {
    if (!activeContext) {
      console.error('[AssistedChat] No active context for sending message');
      return;
    }
    
    console.log('[AssistedChat] Proceeding with message sending:', message.substring(0, 20) + '...');
    setIsTyping(true);
    
    // Add the user message to the UI immediately
    const userMessage: Message = {
      id: generateUniqueId(),
      text: message,
      sender: 'user',
      timestamp: Date.now()
    };
    
    // Update the messages state
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    // Also update the active context with the new message
    setActiveContext(prevContext => {
      if (!prevContext) return undefined;
      const updatedContext = {
        ...prevContext,
        messages: [...(prevContext.messages || []), userMessage]
      };
      
      // Also update conversationContexts to keep everything in sync
      setConversationContexts(prevContexts => 
        prevContexts.map(ctx => 
          ctx.id === updatedContext.id ? updatedContext : ctx
        )
      );
      
      return updatedContext;
    });
    
    // Save message to database directly (in addition to WebSocket)
    if (activeContext.id && address) {
      try {
        databaseService.current.saveMessageViaAPI(
          activeContext.id,
          message,
          'user',
          { timestamp: Date.now() }
        ).then(() => {
          console.log('[AssistedChat] Message saved to database via API');
        }).catch(error => {
          console.error('[AssistedChat] Error saving message to database:', error);
        });
      } catch (error) {
        console.error('[AssistedChat] Error saving message to database:', error);
      }
    }
    
    // Send message to backend via the configured chatService
    if (chatService.current) {
      chatService.current.sendMessage(message);
    } else {
      console.error('[AssistedChat] Chat service not initialized');
      setIsTyping(false);
    }
  };

  // Handle form submission
  const handleSubmit = (message: string) => {
    // Verify if we have an active context
    if (!activeContext) {
      console.error('[AssistedChat] No active context found when submitting message');
      addConsoleMessage('Error: No active conversation context. Creating a new one...', 'warning');

      // Create a new context if none exists
      createNewChat();
      
      // Postpone message sending until we have a context
      setTimeout(() => handleSubmit(message), 500);
      return;
    }

    // Verify that the context has a valid ID and exists in the database
    if (activeContext.id) {
      (async () => {
        try {
          // Verify if the conversation exists in the database
          const conversationExists = await databaseService.current.checkConversationExists(activeContext.id);
          
          if (!conversationExists && address) {
            console.log('[AssistedChat] Conversation does not exist in database, creating:', activeContext.id);
            
            try {
              // IMPORTANT: Use the existing ID when creating in the database to avoid duplicates
              // Create the conversation in the database with the same ID as the active context
              
              // We don't want to use the database ID since it might differ - we should keep our local ID
              // Instead of replacing it with a new one, let's use the existing one
              proceedWithMessageSending(message);
            } catch (error) {
              console.error('[AssistedChat] Failed to create conversation in database:', error);
              addConsoleMessage('Warning: Could not register conversation in database. Some features may be limited.', 'warning');
              proceedWithMessageSending(message);
            }
          } else {
            // Continue with message sending
            proceedWithMessageSending(message);
          }
        } catch (error) {
          console.error('[AssistedChat] Error checking conversation existence:', error);
          // Continue with message sending anyway
          proceedWithMessageSending(message);
        }
      })();
    } else {
      // If there's no context ID, simply continue
      proceedWithMessageSending(message);
    }
  };

  // If the user is not connected, show connection required message
  if (!isConnected) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-center p-8 max-w-md mx-auto bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <img 
              src="/zephyrus logo.png" 
              alt="Zephyrus Logo" 
              className="w-14 h-14 object-contain" 
            />
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
          <div className="w-10 h-10 flex items-center justify-center">
            <img 
              src="/zephyrus logo.png" 
              alt="Zephyrus Logo" 
              className="w-9 h-9 object-contain" 
            />
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
                    <div className="w-10 h-10 flex items-center justify-center">
                      <img 
                        src="/zephyrus logo.png" 
                        alt="Zephyrus Logo" 
                        className="w-9 h-9 object-contain" 
                      />
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