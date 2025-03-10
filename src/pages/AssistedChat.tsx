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
import { ChatInfo } from '../services/chatService';


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
  const apiService = useRef(ApiService.getInstance());
  const [] = useState(false);
  const lastProcessedMessageRef = useRef<string | null>(null);
  const lastProcessedCodeRef = useRef<string | null>(null);
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

            // Disconnect current WebSocket if it exists
            chatService.current.disconnect();
            
            // Set chat ID and connect WebSocket
            chatService.current.setCurrentChatId(mostRecentChat.id);
            chatService.current.connect(address, mostRecentChat.id);

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

  // WebSocket connection effect
  useEffect(() => {
    const service = chatService.current;
    const handleChatConnection = (connected: boolean) => {
      setWsConnected(connected);
      
      if (connected) {
        console.log('[AssistedChat] WebSocket connected, loading chats if needed');
        
        // Get contexts after the connection is established
        const loadedContexts = conversationService.getContexts();
        console.log('[AssistedChat] Initial contexts from local service:', loadedContexts);
        
        if (loadedContexts.length === 0 && address) {
          console.log('[AssistedChat] No contexts loaded, loading from database');
          databaseService.current.getConversations(address)
            .then(conversations => {
              console.log('[AssistedChat] Got conversations from database:', conversations);
              
              if (Array.isArray(conversations) && conversations.length > 0) {
                console.log('[AssistedChat] Syncing database conversations with chat service');
                service.syncContextsWithDatabase(conversations);
                
                // Set active context to first conversation
                setActiveContext({
                  id: conversations[0].id,
                  name: conversations[0].name,
                  messages: conversations[0].messages || [],
                  virtualFiles: conversations[0].virtualFiles || {},
                  workspaces: conversations[0].workspaces || {},
                  active: true,
                  createdAt: conversations[0].created_at || new Date().toISOString()
                });
              }
            })
            .catch(err => {
              console.error('[AssistedChat] Error loading conversations:', err);
              addConsoleMessage('Error loading conversations', 'error');
            });
        }
      }
    };
    
    service.onConnectionChange(handleChatConnection);
    
    // Registrar manejador de mensajes
    service.onMessage((message: AgentResponse) => {
      console.log('[AssistedChat] Message received from WebSocket:', message);
      
      // Procesando diferentes tipos de mensajes
      if (message.type === 'message') {
        // Crear un nuevo mensaje para la UI
        const newMessage: Message = {
          id: message.metadata?.id || generateUniqueId(),
          text: message.content,
          sender: 'ai',
          timestamp: Date.now(),
          isTyping: false,
          showAnimation: false
        };
        
        // Actualizar los mensajes en el estado
        setMessages(prevMessages => {
          // Si hay un mensaje de IA incompleto, reemplazarlo
          const lastAiMessageIndex = [...prevMessages].reverse().findIndex(m => m.sender === 'ai' && m.isTyping);
          if (lastAiMessageIndex >= 0) {
            const updatedMessages = [...prevMessages];
            updatedMessages[prevMessages.length - 1 - lastAiMessageIndex] = newMessage;
            return updatedMessages;
          }
          
          // Si no, añadir como un nuevo mensaje
          return [...prevMessages, newMessage];
        });
        
        // Actualizar contexto activo con el nuevo mensaje
        if (activeContext) {
          const updatedContext = {
            ...activeContext,
            messages: [...(activeContext.messages || []), newMessage]
          };
          
          setActiveContext(updatedContext);
          
          // Actualizar la lista de contextos
          setConversationContexts(prevContexts => 
            prevContexts.map(ctx => 
              ctx.id === activeContext.id ? updatedContext : ctx
            )
          );
        }
        
        // Si contiene código, ya no procesarlo aquí
        // El código será procesado por el efecto useEffect para
        // evitar actualizaciones redundantes y bucles infinitos
      } else if (message.type === 'code_edit' || message.type === 'file_create') {
        // Procesamiento de ediciones de código o creación de archivos
        console.log(`[AssistedChat] Processing ${message.type}:`, message);
        
        if (message.metadata?.path && message.content) {
          // Actualizar archivos virtuales
          if (activeContext) {
            const path = message.metadata.path;
            const language = message.metadata.language || 'solidity';
            
            // Verificar si el contenido ha cambiado para evitar actualizaciones innecesarias
            const currentFileContent = activeContext.virtualFiles?.[path]?.content;
            if (currentFileContent === message.content) {
              console.log(`[AssistedChat] Skipping update for ${path} - content unchanged`);
              return;
            }
            
            // Crear o actualizar archivo virtual
            const updatedVirtualFiles = {
              ...(activeContext.virtualFiles || {}),
              [path]: {
                content: message.content,
                language,
                timestamp: Date.now()
              }
            };
            
            // Actualizar el contexto activo
            const updatedContext = {
              ...activeContext,
              virtualFiles: updatedVirtualFiles
            };
            
            setActiveContext(updatedContext);
            
            // Actualizar lista de contextos
            setConversationContexts(prevContexts => 
              prevContexts.map(ctx => 
                ctx.id === activeContext.id ? updatedContext : ctx
              )
            );
            
            // Actualizar el código actual solo si es el archivo seleccionado
            if (path === selectedFile || !selectedFile) {
              // Evitar actualizar si el código no ha cambiado
              if (currentCode !== message.content) {
                setCurrentCode(message.content);
                setShowCodeEditor(true);
                
                // Actualizar el archivo seleccionado solo si no hay uno seleccionado
                if (!selectedFile) {
                  setSelectedFile(path);
                }
                
                // Compilar el código si es Solidity y se permite la compilación
                if (language === 'solidity' && !message.metadata.noCompile) {
                  // Usar setTimeout para evitar sobrecargar con compilaciones
                  if (compilationTimeoutRef.current) {
                    clearTimeout(compilationTimeoutRef.current);
                  }
                  compilationTimeoutRef.current = setTimeout(() => {
                    compileCode(message.content);
                    compilationTimeoutRef.current = null;
                  }, 1000);
                }
              }
            }
          }
        }
      }
    });
    
    // Eliminar mensajes duplicados antes de procesarlos
    const processUniqueMessages = (loadedChats: ChatInfo[]) => {
      if (!Array.isArray(loadedChats) || loadedChats.length === 0) return;
      
      console.log('[AssistedChat] Processing loaded chats:', loadedChats);
      
      // Usar el chat más reciente o el que coincida con el contexto activo
      const selectedChat = activeContext && loadedChats.find(chat => chat.id === activeContext.id) || 
                         loadedChats[loadedChats.length - 1];
      
      if (selectedChat && Array.isArray(selectedChat.messages)) {
        // Ordenar mensajes por tiempo
        const sortedMessages = [...selectedChat.messages].sort((a: any, b: any) => {
          const timestampA = a.timestamp || a.created_at || 0;
          const timestampB = b.timestamp || b.created_at || 0;
          return new Date(timestampA).getTime() - new Date(timestampB).getTime();
        });
        
        // Eliminar duplicados
        const uniqueMessages: any[] = [];
        const messageMap = new Map();
        
        sortedMessages.forEach((msg: any) => {
          // Crear una clave única para cada mensaje
          const senderKey = msg.sender || msg.role || 'unknown';
          const contentKey = typeof msg.text === 'string' ? msg.text : 
                      (typeof msg.content === 'string' ? msg.content : 
                      JSON.stringify(msg.content || ''));
          
          const messageKey = `${senderKey}:${contentKey}`;
          
          if (!messageMap.has(messageKey)) {
            messageMap.set(messageKey, true);
            uniqueMessages.push(msg);
          }
        });
        
        console.log(`[AssistedChat] Processed ${selectedChat.messages.length} messages, found ${uniqueMessages.length} unique messages`);
        
        // Convertir a formato UI
        const uiMessages: Message[] = uniqueMessages.map((msg: any) => ({
          id: msg.id || generateUniqueId(),
          text: msg.text || msg.content || '',
          sender: msg.sender || (msg.role === 'user' ? 'user' : 'ai'),
          timestamp: msg.timestamp || Date.now(),
          isFullMessage: true, // Marcar como mensajes completos para evitar reemplazos
          noCompile: msg.noCompile || false
        }));
        
        // Actualizar el estado de mensajes
        setMessages(uiMessages);
        
        // Actualizar el contexto activo con mensajes únicos
        if (activeContext) {
          const updatedContext = {
            ...activeContext,
            messages: uiMessages
          };
          
          setActiveContext(updatedContext);
          
          // Actualizar la lista de contextos
          setConversationContexts(prevContexts => 
            prevContexts.map(ctx => 
              ctx.id === activeContext.id ? updatedContext : ctx
            )
          );
        }
      }
    };
    
    // Subscribe to chat loaded events
    service.onChatsLoaded((chats) => {
      console.log('[AssistedChat] Chats loaded event:', chats);
      
      if (Array.isArray(chats) && chats.length > 0) {
        processUniqueMessages(chats);
        
        // Actualizar lista de contextos
        const loadedContexts = chats.map(chat => ({
          id: chat.id,
          name: chat.name || 'Untitled Chat',
          messages: chat.messages || [],
          virtualFiles: chat.virtualFiles || {},
          workspaces: chat.workspaces || {},
          active: chat.id === service.getCurrentChatId(),
          createdAt: chat.created_at || new Date().toISOString()
        }));
        
        setConversationContexts(loadedContexts);
      }
    });

    // Only connect if we have a wallet address and we're not already connected
    if (address && !wsConnected) {
      console.log('[AssistedChat] Initializing WebSocket connection');
      
      // Use active chat ID if available
      const activeContextId = activeContext?.id;
      if (activeContextId) {
        console.log('[AssistedChat] Connecting with active context ID:', activeContextId);
      } else {
        console.log('[AssistedChat] Connecting without active context ID');
      }
      
      // Connect with wallet address and active context ID
      service.connect(address, activeContextId);
    }

    return () => {
      // Only disconnect if we're leaving the application or changing address
      if (wsConnected) {
        console.log('[AssistedChat] Cleaning up WebSocket connection');
        service.disconnect();
      }
    };
  }, [address, wsConnected, compileCode]);

  // Helper function to continue with message sending
  const proceedWithMessageSending = (message: string) => {
    // Use the service to add the user's message
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

    // Extract Solidity code if present in the message
    let extractedCode = '';
    if (message.includes('```solidity') && message.includes('contract')) {
      const codeBlockRegex = /```(?:solidity)?\s*([\s\S]*?)```/;
      const match = message.match(codeBlockRegex);
      
      if (match && match[1] && match[1].includes('contract') && match[1].includes('{')) {
        extractedCode = match[1].trim();
        console.log('[AssistedChat] Extracted Solidity code from user message:', extractedCode.substring(0, 50) + '...');
        
        // Set the code in the editor
        if (extractedCode && extractedCode !== currentCode) {
          setCurrentCode(extractedCode);
          setShowCodeEditor(true);
          
          // Set up the editor with the proper language and theme
          if (monacoRef.current && editorRef.current) {
            try {
              const monaco = monacoRef.current;
              const editor = editorRef.current;
              
              // Make sure Solidity language is registered
              if (!monaco.languages.getLanguages().some(lang => lang.id === 'solidity')) {
                monaco.languages.register({ id: 'solidity' });
                
                // Configure syntax highlighting for Solidity
                monaco.languages.setMonarchTokensProvider('solidity', {
                  defaultToken: '',
                  tokenPostfix: '.sol',
                  
                  keywords: [
                    'pragma', 'solidity', 'contract', 'library', 'interface',
                    'function', 'modifier', 'event', 'constructor',
                    'address', 'string', 'bool', 'uint', 'int', 'bytes',
                    'public', 'private', 'internal', 'external',
                    'pure', 'view', 'payable', 'virtual', 'override',
                    'returns', 'memory', 'storage', 'calldata',
                    'if', 'else', 'for', 'while', 'do', 'break', 'continue',
                    'return', 'emit', 'try', 'catch', 'revert', 'require',
                    'assert', 'mapping', 'struct', 'enum', 'this', 'super'
                  ],
                  
                  operators: [
                    '=', '>', '<', '!', '~', '?', ':',
                    '==', '<=', '>=', '!=', '&&', '||', '++', '--',
                    '+', '-', '*', '/', '&', '|', '^', '%', '<<',
                    '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
                    '^=', '%=', '<<=', '>>=', '>>>='
                  ],
                  
                  symbols: /[=><!~?:&|+\-*\/\^%]+/,
                  
                  tokenizer: {
                    root: [
                      [/[a-zA-Z_]\w*/, {
                        cases: {
                          '@keywords': 'keyword',
                          '@default': 'identifier'
                        }
                      }],
                      [/[{}()\[\]]/, '@brackets'],
                      [/@symbols/, {
                        cases: {
                          '@operators': 'operator',
                          '@default': ''
                        }
                      }],
                      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                      [/\d+/, 'number'],
                      [/[;,.]/, 'delimiter'],
                      [/"([^"\\]|\\.)*$/, 'string.invalid'],
                      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                      [/\/\/.*$/, 'comment'],
                      [/\/\*/, 'comment', '@comment'],
                    ],
                    string: [
                      [/[^\\"]+/, 'string'],
                      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
                      [/\\.[^"]*$/, 'string.invalid']
                    ],
                    comment: [
                      [/[^\/*]+/, 'comment'],
                      [/\*\//, 'comment', '@pop'],
                      [/[\/*]/, 'comment']
                    ]
                  }
                });
                
                // Define the Solidity theme
                monaco.editor.defineTheme('solidityTheme', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [
                    { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
                    { token: 'identifier', foreground: 'D4D4D4' },
                    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                    { token: 'string', foreground: 'CE9178' },
                    { token: 'number', foreground: 'B5CEA8' },
                    { token: 'operator', foreground: 'D4D4D4' },
                    { token: 'delimiter', foreground: 'D4D4D4' },
                  ],
                  colors: {}
                });
              }
              
              // Set up the model with the extracted code
              let model = editor.getModel();
              if (!model || model.getLanguageId() !== 'solidity') {
                console.log('[AssistedChat] Creating new Solidity model');
                model = monaco.editor.createModel(
                  extractedCode,
                  'solidity',
                  monaco.Uri.parse('file:///contracts/Contract.sol')
                );
                editor.setModel(model);
              } else {
                console.log('[AssistedChat] Updating existing model with Solidity code');
                model.setValue(extractedCode);
              }
              
              // Apply the Solidity theme
              monaco.editor.setTheme('solidityTheme');
              
              // Schedule compilation after a short delay
              setTimeout(() => {
                compileCode(extractedCode);
              }, 500);
            } catch (err) {
              console.error('[AssistedChat] Error setting up editor with extracted code:', err);
            }
          }
          
          // Save to virtual file system
          if (activeContext) {
            const path = 'contracts/Contract.sol';
            virtualFS.writeFile(path, extractedCode).then(() => {
              console.log('[AssistedChat] Saved extracted code to virtual file system');
              
              // Update context with the new file
              const updatedVirtualFiles = {
                ...activeContext.virtualFiles,
                [path]: { content: extractedCode, language: 'solidity', timestamp: Date.now() }
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
            }).catch(error => {
              console.error('[AssistedChat] Error writing extracted code to file system:', error);
            });
          }
        }
      }
    }

    // Create context with current code and file information
    const context = {
      currentCode: showCodeEditor && currentCode ? currentCode : extractedCode || undefined,
      currentArtifact: currentArtifact,
      virtualFiles: activeContext?.virtualFiles || {},
      currentFile: selectedFile,
      fileSystem: activeContext?.virtualFiles || {},
      // Add code directly in the message content if available
      code: currentCode || extractedCode || undefined
    };

    // Log the context for debugging
    console.log('[AssistedChat] Sending context:', {
      hasCurrentCode: Boolean(context.currentCode),
      hasCode: Boolean(context.code),
      currentFile: context.currentFile
    });

    // Modify message to include code if available
    const enhancedMessage = currentCode 
      ? `${message}\n\nCurrent code:\n\`\`\`solidity\n${currentCode}\n\`\`\``
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
    }
  }, [messages, currentCode]);

  // Effect to ensure code is loaded after page reload
  useEffect(() => {
    if (activeContext && !currentCode) {
      console.log('[AssistedChat] Checking for code in active context after page reload');
      
      // Search for Solidity files in the active context
      if (activeContext.virtualFiles) {
        const solidityFiles = Object.entries(activeContext.virtualFiles)
          .filter(([_, file]: [string, any]) => file.language === 'solidity');
        
        if (solidityFiles.length > 0) {
          // Take the most recent Solidity file
          const [path, lastSolidityFile]: [string, any] = solidityFiles[solidityFiles.length - 1];
          console.log(`[AssistedChat] Found Solidity file in context after reload: ${path}`);
          
          // Update code and show editor
          setCurrentCode(ensureStringContent(lastSolidityFile.content));
          setShowCodeEditor(true);
          setSelectedFile(path);
          
          // Compile code if possible
          if (editorRef.current && monacoRef.current) {
            console.log('[AssistedChat] Compiling loaded Solidity code after reload');
            compileCode(ensureStringContent(lastSolidityFile.content));
          } else {
            console.log('[AssistedChat] Editor refs not ready, scheduling compilation for later');
            // Schedule compilation for when the editor is ready
            setTimeout(() => {
              if (editorRef.current && monacoRef.current) {
                compileCode(ensureStringContent(lastSolidityFile.content));
              }
            }, 1000);
          }
        }
      }
      
      // Also check in the active context workspaces
      if (activeContext.workspaces && activeContext.activeWorkspace) {
        const activeWorkspace = activeContext.workspaces[activeContext.activeWorkspace];
        if (activeWorkspace && activeWorkspace.files) {
          const solidityFiles = Object.entries(activeWorkspace.files)
            .filter(([_, file]: [string, any]) => file.language === 'solidity');
          
          if (solidityFiles.length > 0) {
            const [path, solFile]: [string, any] = solidityFiles[0];
            console.log(`[AssistedChat] Found Solidity file in active workspace after reload: ${path}`);
            
            setCurrentCode(ensureStringContent(solFile.content));
            setShowCodeEditor(true);
            setSelectedFile(path);
            
            if (editorRef.current && monacoRef.current) {
              compileCode(ensureStringContent(solFile.content));
            } else {
              setTimeout(() => {
                if (editorRef.current && monacoRef.current) {
                  compileCode(ensureStringContent(solFile.content));
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
              setCurrentCode(ensureStringContent(file.content));
              setShowCodeEditor(true);
          setSelectedFile(path);
          compileCode(ensureStringContent(file.content));
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

  // Effect to extract Solidity code from messages and show it in the editor
  useEffect(() => {
    if (messages.length > 0) {
      console.log('[AssistedChat] Checking messages for Solidity code blocks');
      
      // Look for the most recent AI message with Solidity code block
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        
        // Skip if we already processed this message
        if (message.id === lastProcessedMessageRef.current) {
          console.log('[AssistedChat] Skipping already processed message:', message.id);
          break;
        }
        
        if (message.sender === 'ai' && message.text.includes('```solidity') && message.text.includes('contract')) {
          console.log('[AssistedChat] Found Solidity code in message:', message.id);
          
          // Extract the Solidity code from the message
          const extractSolidityCode = (text: string): string => {
            const codeBlockRegex = /```(?:solidity)?\s*([\s\S]*?)```/;
            const match = text.match(codeBlockRegex);
            
            if (match && match[1]) {
              console.log('[AssistedChat] Successfully extracted Solidity code block');
              return match[1].trim();
            }
            return '';
          };
          
          const solidityCode = extractSolidityCode(message.text);
          
          // Check if this code is already in the editor to avoid duplicate processing
          if (solidityCode && solidityCode.includes('contract') && solidityCode.includes('{') && solidityCode.includes('}')) {
            // Skip processing if code is unchanged or we already processed this code
            if (currentCode === solidityCode || lastProcessedCodeRef.current === solidityCode) {
              console.log('[AssistedChat] Skipping code processing - code unchanged');
              break;
            }
            
            // Mark this message and code as processed
            lastProcessedMessageRef.current = message.id;
            lastProcessedCodeRef.current = solidityCode;
            
            // If we don't already have this code in the editor
            console.log('[AssistedChat] Setting extracted Solidity code in editor');
            
            const path = 'contracts/Contract.sol';
            setCurrentCode(solidityCode);
            setShowCodeEditor(true);
            setSelectedFile(path);
            
            // Setup editor with Solidity configuration if Monaco is available
            if (monacoRef.current && editorRef.current) {
              const monaco = monacoRef.current;
              const editor = editorRef.current;
              
              // Make sure Solidity language is registered
              if (!monaco.languages.getLanguages().some(lang => lang.id === 'solidity')) {
                console.log('[AssistedChat] Registering Solidity language for syntax highlighting');
                
                // Register Solidity language
                monaco.languages.register({ id: 'solidity' });
                
                // Configure syntax highlighting for Solidity
                monaco.languages.setMonarchTokensProvider('solidity', {
                  defaultToken: '',
                  tokenPostfix: '.sol',
                  
                  keywords: [
                    'pragma', 'solidity', 'contract', 'library', 'interface',
                    'function', 'modifier', 'event', 'constructor',
                    'address', 'string', 'bool', 'uint', 'int', 'bytes',
                    'public', 'private', 'internal', 'external',
                    'pure', 'view', 'payable', 'virtual', 'override',
                    'returns', 'memory', 'storage', 'calldata',
                    'if', 'else', 'for', 'while', 'do', 'break', 'continue',
                    'return', 'emit', 'try', 'catch', 'revert', 'require',
                    'assert', 'mapping', 'struct', 'enum', 'this', 'super'
                  ],
                  
                  operators: [
                    '=', '>', '<', '!', '~', '?', ':',
                    '==', '<=', '>=', '!=', '&&', '||', '++', '--',
                    '+', '-', '*', '/', '&', '|', '^', '%', '<<',
                    '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
                    '^=', '%=', '<<=', '>>=', '>>>='
                  ],
                  
                  symbols: /[=><!~?:&|+\-*\/\^%]+/,
                  
                  tokenizer: {
                    root: [
                      [/[a-zA-Z_]\w*/, {
                        cases: {
                          '@keywords': 'keyword',
                          '@default': 'identifier'
                        }
                      }],
                      [/[{}()\[\]]/, '@brackets'],
                      [/@symbols/, {
                        cases: {
                          '@operators': 'operator',
                          '@default': ''
                        }
                      }],
                      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                      [/\d+/, 'number'],
                      [/[;,.]/, 'delimiter'],
                      [/"([^"\\]|\\.)*$/, 'string.invalid'],
                      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                      [/\/\/.*$/, 'comment'],
                      [/\/\*/, 'comment', '@comment'],
                    ],
                    string: [
                      [/[^\\"]+/, 'string'],
                      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
                      [/\\.[^"]*$/, 'string.invalid']
                    ],
                    comment: [
                      [/[^\/*]+/, 'comment'],
                      [/\*\//, 'comment', '@pop'],
                      [/[\/*]/, 'comment']
                    ]
                  }
                });
                
                // Define theme for Solidity
                monaco.editor.defineTheme('solidityTheme', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [
                    { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
                    { token: 'identifier', foreground: 'D4D4D4' },
                    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                    { token: 'string', foreground: 'CE9178' },
                    { token: 'number', foreground: 'B5CEA8' },
                    { token: 'operator', foreground: 'D4D4D4' },
                    { token: 'delimiter', foreground: 'D4D4D4' },
                  ],
                  colors: {}
                });
              }
              
              // Create a new model with Solidity language
              try {
                // Get current model or create new one
                let model = editor.getModel();
                if (!model || model.getLanguageId() !== 'solidity') {
                  console.log('[AssistedChat] Creating new Solidity model for editor');
                  model = monaco.editor.createModel(
                    solidityCode,
                    'solidity',
                    monaco.Uri.parse('file:///contracts/Contract.sol')
                  );
                  editor.setModel(model);
                } else {
                  console.log('[AssistedChat] Updating existing model with Solidity code');
                  model.setValue(solidityCode);
                }
                
                // Apply the Solidity theme
                monaco.editor.setTheme('solidityTheme');
              } catch (err) {
                console.error('[AssistedChat] Error creating/updating editor model:', err);
              }
            }
            
            // Compile the code after a short delay
            setTimeout(() => {
              // Skip compilation if noCompile flag is set
              if (message.noCompile) {
                console.log('[AssistedChat] Skipping compilation due to noCompile flag');
              } else {
                compileCode(solidityCode);
              }
            }, 500);
            
            // Store in virtual file system
            if (activeContext) {
              // Save to virtual file system
              virtualFS.writeFile(path, solidityCode).then(() => {
                console.log('[AssistedChat] Saved extracted code to virtual file system:', path);
                
                // Update active context with file info
                const updatedVirtualFiles = {
                  ...activeContext.virtualFiles,
                  [path]: { content: solidityCode, language: 'solidity', timestamp: Date.now() }
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
                
                // Dispatch events to notify components about the code update
                const codeUpdateEvent = new CustomEvent('code_updated', { 
                  detail: { path, content: solidityCode, language: 'solidity', noCompile: message.noCompile } 
                });
                window.dispatchEvent(codeUpdateEvent);
              }).catch(error => {
                console.error('[AssistedChat] Error writing file:', error);
              });
            }
          }
          break; // Stop after finding the first valid code block
        }
      }
    }
  }, [messages, activeContext, compileCode, currentCode, monacoRef, editorRef]);

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
              // Create the conversation in the database
              const result = await databaseService.current.createConversation(
                address, 
                activeContext.name || 'New Conversation'
              );
              
              console.log('[AssistedChat] Created conversation in database:', result);
                 
              // If the conversation was created with a different ID, update the local context
              if (result.id && result.id !== activeContext.id) {
                console.log('[AssistedChat] Updating local context with database ID:', result.id);
                
                // Create a new context with the database ID
                const newContext = await conversationService.createNewContext(
                  activeContext.name || 'New Conversation',
                  result.id
                );
                
                // Update states
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
               
          // Continue with message sending
          proceedWithMessageSending(message);
          
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