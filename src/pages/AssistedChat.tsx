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

const AssistedChat: React.FC = () => {
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
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);
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

  // Inicializar el servicio de contexto de chat - Ahora después de definir las funciones que necesita
  const chatContextService = useRef<ChatContextService>(
    new ChatContextService({
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
    })
  );
  
  // Actualizar la configuración del servicio de contexto cuando cambie la dirección
  useEffect(() => {
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
  }, [address, compileCode]);

  // Handle file selection from FileExplorer
  const handleFileSelect = useCallback((path: string) => {
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
  const createNewChat = () => chatContextService.current.createNewChat();
  const handleContextSwitch = (contextId: string) => chatContextService.current.handleContextSwitch(contextId);
  const handleContextDelete = (contextId: string) => chatContextService.current.handleContextDelete(contextId);

  // WebSocket connection effect
  useEffect(() => {
    const service = chatService.current;

    service.onConnectionChange((connected: boolean) => {
      setWsConnected(connected);
    });

    service.onMessage((response: AgentResponse) => {
      console.log('[AssistedChat] Received message:', response);
      
      if (response.type === 'contexts_loaded') {
        try {
          const contexts = JSON.parse(response.content);
          console.log('[AssistedChat] Loaded contexts:', contexts);
          
          if (Array.isArray(contexts)) {
            // Actualizar los contextos de manera inmutable
            const processedContexts = contexts.map(ctx => ({
              ...ctx,
              messages: ctx.messages || [],
              virtualFiles: ctx.virtualFiles || {},
              active: false
            }));
            
            // Establecer el último contexto como activo
            if (processedContexts.length > 0) {
              const lastContext = processedContexts[processedContexts.length - 1];
              lastContext.active = true;
              setActiveContext(lastContext);
              // Actualizar los mensajes del contexto activo de manera inmediata
              setMessages(lastContext.messages || []);

              // Si hay archivos Solidity, cargar el último en el editor
              if (lastContext.virtualFiles) {
                const solidityFiles = Object.entries(lastContext.virtualFiles)
                  .filter(([_, file]) => (file as VirtualFile).language === 'solidity');
                if (solidityFiles.length > 0) {
                  const [_, lastSolidityFile] = solidityFiles[solidityFiles.length - 1];
                  setCurrentCode((lastSolidityFile as VirtualFile).content);
                  setShowCodeEditor(true);
                  if (editorRef.current && monacoRef.current) {
                    compileCode((lastSolidityFile as VirtualFile).content);
                  }
                }
              }
            }
            
            setConversationContexts(processedContexts);
          }
        } catch (error) {
          console.error('[AssistedChat] Error parsing contexts:', error);
        }
      } else if (response.type === 'code_edit') {
        try {
          // Intentar parsear el contenido si viene como string
          let content = response.content;
          let metadata = response.metadata;
          
          if (typeof content === 'string' && content.trim().startsWith('{')) {
            const parsed = JSON.parse(content);
            content = parsed.content || content;
            metadata = parsed.metadata || metadata;
          }

          console.log('[AssistedChat] Processing code edit:', { content, metadata });
          
          // Actualizar el código en el editor
          setCurrentCode(content);
          setShowCodeEditor(true);
          
          // Compilar el código después de un breve retraso
          if (editorRef.current && monacoRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              // Asegurarnos de que el modelo del editor se actualice
              model.setValue(content);
              // Compilar después de que el editor se haya actualizado
              setTimeout(() => {
                console.log('[AssistedChat] Compiling updated code');
                compileCode(content);
              }, 100);
            }
          }
        } catch (error) {
          console.error('[AssistedChat] Error handling code edit:', error);
        }
      } else if (response.type === 'file_create' || response.type === 'file_update') {
        try {
          // El contenido puede venir como string directo o como objeto JSON
          let fileData;
          let content;
          let metadata;
          
          try {
            // Intentar parsear como JSON primero
            fileData = JSON.parse(response.content);
            content = fileData.content;
            metadata = fileData.metadata;
          } catch {
            // Si falla el parse, asumir que es contenido directo
            content = response.content;
            // Intentar detectar si es Solidity por el contenido
            const isSolidity = content.includes('pragma solidity') || content.includes('contract ');
            metadata = {
              language: isSolidity ? 'solidity' : undefined,
              path: isSolidity ? 'Contract.sol' : undefined
            };
          }

          if (metadata?.language === 'solidity' || metadata?.path?.endsWith('.sol')) {
            console.log('[AssistedChat] Loading Solidity file into editor:', { content, metadata });
            setCurrentCode(content);
            setShowCodeEditor(true);
            if (editorRef.current && monacoRef.current) {
              // Compilar el código después de un breve retraso para asegurar que el editor se haya actualizado
              setTimeout(() => compileCode(content), 100);
            }
          }
        } catch (error) {
          console.error('[AssistedChat] Error handling file create/update:', error);
        }
      } else if (response.type === 'message') {
        // Usar el servicio para añadir mensajes
        chatContextService.current.addMessageToContext(response.content, false, activeContext);
        
        // Si el mensaje contiene código Solidity, actualizarlo y compilar
        if (response.content.includes('```solidity')) {
          const codeMatch = response.content.match(/```solidity\n([\s\S]*?)```/);
          if (codeMatch && codeMatch[1]) {
            const newCode = codeMatch[1].trim();
            setCurrentCode(newCode);
            setShowCodeEditor(true);
            // Compilar el código después de un breve retraso para asegurar que el editor se haya actualizado
            setTimeout(() => compileCode(newCode), 100);
          }
        }
      }
      setIsTyping(false);
    });

    // Only connect if we have a valid wallet address
    if (address && address.startsWith('0x')) {
      service.connect(address);
      // Initialize conversation after connection
      chatContextService.current.initializeConversation();
    }

    return () => {
      service.disconnect();
    };
  }, [address, compileCode]);

  const handleSubmit = (message: string) => {
    // Usar el servicio para añadir el mensaje del usuario
    chatContextService.current.addMessageToContext(message, true, activeContext);

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