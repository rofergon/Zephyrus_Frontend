import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ChatService, type AgentResponse } from '../services/chatService';
import { virtualFS } from '../services/virtual-fs';
import { ResizableBox } from 'react-resizable';
import { 
  HomeIcon, ChatBubbleLeftRightIcon, DocumentDuplicateIcon, CogIcon, UsersIcon, WrenchScrewdriverIcon, CurrencyDollarIcon, ChevronLeftIcon, ChevronRightIcon,
  CodeBracketIcon} from '@heroicons/react/24/outline';
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

interface VirtualFile {
  content: string;
  language: string;
  timestamp: number;
}

const demoArtifact: ContractArtifact = {
  name: "Contract Preview",
  description: "Your smart contract interface will appear here after compilation",
  functions: []
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
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>('');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(200);
  const compilationService = useRef<CompilationService>(CompilationService.getInstance());

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

  const initializeConversation = useCallback(() => {
    try {
      const contexts = conversationService.getContexts();
      console.log('[Chat] Initializing with contexts:', contexts);
      
      if (contexts.length > 0) {
        const activeContext = contexts[contexts.length - 1];
        activeContext.active = true;
        
        const updatedContexts = contexts.map(ctx => ({
          ...ctx,
          active: ctx.id === activeContext.id
        }));
        
        setConversationContexts(updatedContexts);
        setActiveContext(activeContext);
        conversationService.setActiveContext(activeContext.id);
        chatService.current.setCurrentChatId(activeContext.id);
        
        console.log('[Chat] Initialized contexts:', updatedContexts);
        console.log('[Chat] Active context:', activeContext);
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
    }
  }, []);

  const handleSubmit = (message: string) => {
    const newMessage: Message = {
      id: generateUniqueId(),
      text: message,
      sender: 'user',
      timestamp: Date.now()
    };

    // Actualizar el estado de mensajes de manera inmutable
    setMessages(prevMessages => [...prevMessages, newMessage]);
    // Actualizar el contexto activo y los contextos
    setActiveContext(prevContext => {
      if (!prevContext) return undefined;
      const updatedContext = {
        ...prevContext,
        messages: [...prevContext.messages, newMessage]
      };
      
      // Actualizar los contextos en el servicio
      conversationService.addMessage(prevContext.id, newMessage);
      
      // Actualizar el estado de los contextos
      setConversationContexts(prevContexts => 
        prevContexts.map(ctx => 
          ctx.id === prevContext.id ? updatedContext : ctx
        )
      );
      
      return updatedContext;
    });

    setIsTyping(true);

    // Create context with current code and file information
    const context = {
      currentCode: currentCode,
      currentArtifact: currentArtifact,
      virtualFiles: activeContext?.virtualFiles || {},
      currentFile: activeContext?.virtualFiles ? Object.keys(activeContext.virtualFiles).find(path => path.endsWith('.sol')) : null,
      fileSystem: activeContext?.virtualFiles || {}
    };

    // Send message to agent with context
    chatService.current.sendMessage(message, context);
  };

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
            console.log('[AssistedChat] Updated contexts:', processedContexts);
          }
        } catch (error) {
          console.error('[AssistedChat] Error parsing contexts:', error);
        }
      } else if (response.type === 'file_create') {
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
              compileCode(content);
            }
          }
        } catch (error) {
          console.error('[AssistedChat] Error handling file create:', error);
        }
      } else if (response.type === 'message') {
        // Crear el nuevo mensaje
        const newMessage: Message = {
          id: generateUniqueId(),
          text: response.content,
          sender: 'ai',
          timestamp: Date.now()
        };

        // Actualizar el estado de manera inmutable
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Actualizar el contexto activo y los contextos
        setActiveContext(prevContext => {
          if (!prevContext) return undefined;
          const updatedContext = {
            ...prevContext,
            messages: [...prevContext.messages, newMessage]
          };
          
          // Actualizar los contextos en el servicio
          conversationService.addMessage(prevContext.id, newMessage);
          
          // Actualizar el estado de los contextos
          setConversationContexts(prevContexts => 
            prevContexts.map(ctx => 
              ctx.id === prevContext.id ? updatedContext : ctx
            )
          );

          // Buscar código Solidity en el mensaje y actualizar el editor si se encuentra
          const solidityCodeMatch = response.content.match(/```solidity\n([\s\S]*?)```/);
          if (solidityCodeMatch) {
            const solidityCode = solidityCodeMatch[1];
            setCurrentCode(solidityCode);
            setShowCodeEditor(true);
            if (editorRef.current && monacoRef.current) {
              compileCode(solidityCode);
            }
          }
          
          return updatedContext;
        });
      }
      setIsTyping(false);
    });

    // Only connect if we have a valid wallet address
    if (address && address.startsWith('0x')) {
      service.connect(address);
      // Initialize conversation after connection
      initializeConversation();
    }

    return () => {
      service.disconnect();
    };
  }, [address, initializeConversation]);

  // Add useEffect to monitor conversation contexts
  useEffect(() => {
    console.log('[AssistedChat] Conversation contexts updated:', conversationContexts);
  }, [conversationContexts]);

  // Actualizar el useEffect que maneja el cambio de contexto activo
  useEffect(() => {
    console.log('[AssistedChat] Active context changed:', activeContext);
    if (activeContext) {
      // Cargar los mensajes del contexto activo
      setMessages(activeContext.messages || []);
      
      if (activeContext.virtualFiles) {
        console.log('[AssistedChat] Found virtual files in context:', activeContext.virtualFiles);
        // Limpiar el sistema de archivos virtual
        virtualFS.clear();
        
        // Restaurar los archivos del contexto activo
        Object.entries(activeContext.virtualFiles).forEach(([path, file]: [string, { content: string; language: string; timestamp: number }]) => {
          console.log('[AssistedChat] Restoring file:', path);
          virtualFS.writeFile(path, file.content)
            .then(() => {
              console.log('[AssistedChat] Successfully restored file:', path);
              if (file.language === 'solidity') {
                console.log('[AssistedChat] Setting Solidity code:', file.content);
                setCurrentCode(file.content);
                setShowCodeEditor(true);
                compileCode(file.content);
              }
            })
            .catch(error => console.error('[AssistedChat] Error restoring file:', path, error));
        });
      } else {
        console.log('[AssistedChat] No virtual files found in context');
        setCurrentCode('');
        setShowCodeEditor(false);
      }
    }
  }, [activeContext]);


  const menuItems = [
    { path: '/dashboard', icon: HomeIcon, text: 'Dashboard' },
    { path: '/chat', icon: ChatBubbleLeftRightIcon, text: 'Solidity Assistant' },
    { path: '/templates', icon: DocumentDuplicateIcon, text: 'Contract Templates' },
    { path: '/deploy', icon: CogIcon, text: 'Deploy' },
    { path: '/admin', icon: WrenchScrewdriverIcon, text: 'Contract Admin' },
    { path: '/bonding-tokens', icon: CurrencyDollarIcon, text: 'Bonding Tokens' },
    { path: '/social', icon: UsersIcon, text: 'Social' },
  ];

  const createNewChat = async () => {
    try {
      if (!address) {
        console.error('[Chat] No wallet address available');
        return;
      }

      // Crear una nueva conversación en la base de datos
      const newContext = await conversationService.createNewContext("New Chat");
      
      if (!newContext) {
        console.error('[Chat] Failed to create new context');
        return;
      }

      // Actualizar el estado local
      const updatedContexts = [
        ...conversationContexts.map(ctx => ({ ...ctx, active: false })),
        { ...newContext, active: true }
      ];

      setConversationContexts(updatedContexts);
      setActiveContext({ ...newContext, active: true });
      
      // Actualizar los servicios
      conversationService.setActiveContext(newContext.id);
      chatService.current.setCurrentChatId(newContext.id);
      
      console.log('[Chat] New context created:', newContext);
    } catch (error) {
      console.error('[Chat] Error creating new chat:', error);
    }
  };

  const handleContextSwitch = async (contextId: string) => {
    try {
      console.log('[Chat] Switching to context:', contextId);
      
      // Encontrar el contexto seleccionado
      const selectedContext = conversationContexts.find(ctx => ctx.id === contextId);
      if (!selectedContext) {
        console.error('[Chat] Context not found:', contextId);
        return;
      }
      
      // Actualizar el estado local
      const updatedContexts = conversationContexts.map(ctx => ({
        ...ctx,
        active: ctx.id === contextId
      }));
      
      setConversationContexts(updatedContexts);
      setActiveContext({...selectedContext, active: true});
      
      // Actualizar los servicios
      conversationService.setActiveContext(contextId);
      chatService.current.setCurrentChatId(contextId);

      // Cargar los mensajes del contexto seleccionado
      setMessages(selectedContext.messages || []);
      
      // Manejar archivos virtuales
      if (selectedContext.virtualFiles) {
        console.log('[Chat] Found virtual files in context:', selectedContext.virtualFiles);
        // Limpiar el sistema de archivos virtual
        await virtualFS.clear();
        
        // Restaurar los archivos del contexto seleccionado
        for (const [path, file] of Object.entries(selectedContext.virtualFiles)) {
          try {
            await virtualFS.writeFile(path, file.content);
            console.log('[Chat] Restored file:', path);
            if (file.language === 'solidity') {
              setCurrentCode(file.content);
              setShowCodeEditor(true);
              await compileCode(file.content);
            }
          } catch (error) {
            console.error('[Chat] Error restoring file:', path, error);
          }
        }
      } else {
        console.log('[Chat] No virtual files found in context');
        setCurrentCode('');
        setShowCodeEditor(false);
      }
      
      console.log('[Chat] Context switch complete:', selectedContext);
    } catch (error) {
      console.error('[Chat] Error switching context:', error);
    }
  };

  const handleContextDelete = async (contextId: string) => {
    try {
      console.log('[Chat] Deleting context:', contextId);
      
      // Usar el nuevo método deleteContext
      chatService.current?.deleteContext(contextId);
      
      // Actualizar el estado local
      const updatedContexts = conversationContexts.filter(ctx => ctx.id !== contextId);
      
      // Si el contexto que se está borrando es el activo, activar el último contexto
      if (activeContext?.id === contextId && updatedContexts.length > 0) {
        const lastContext = updatedContexts[updatedContexts.length - 1];
        lastContext.active = true;
        setActiveContext(lastContext);
        conversationService.setActiveContext(lastContext.id);
        chatService.current.setCurrentChatId(lastContext.id);
      }
      
      setConversationContexts(updatedContexts);
      conversationService.setContexts(updatedContexts);
      
      console.log('[Chat] Context deleted, remaining contexts:', updatedContexts);
    } catch (error) {
      console.error('[Chat] Error deleting context:', error);
    }
  };


  // Función para añadir mensajes a la consola
  const addConsoleMessage = (message: string, type: ConsoleMessage['type']) => {
    const newMessage: ConsoleMessage = {
      id: generateUniqueId(),
      type,
      message,
      timestamp: Date.now()
    };
    setConsoleMessages(prev => [...prev, newMessage]);
  };

  const compileCode = useCallback(async (code: string) => {
    if (!code || !editorRef.current || !monacoRef.current) return;
      
    const model = editorRef.current.getModel();
    if (!model) return;

    try {
      await compilationService.current.compileCode(code, monacoRef.current, model, addConsoleMessage, setCurrentArtifact);
    } catch (error) {
      console.error('[AssistedChat] Compilation error:', error);
      addConsoleMessage(`Compilation error: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }, []);

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
          <ResizableBox
            width={window.innerWidth - artifactWidth - (isSidebarOpen ? 256 : 64)}
            height={Infinity}
            axis="x"
            resizeHandles={['e']}
            minConstraints={[
              Math.floor((window.innerWidth - (isSidebarOpen ? 256 : 64)) * 0.3),
              window.innerHeight
            ]}
            maxConstraints={[
              Math.floor((window.innerWidth - (isSidebarOpen ? 256 : 64)) * 0.7),
              window.innerHeight
            ]}
            onResizeStart={() => setIsResizing(true)}
            onResizeStop={(_e, { size }) => {
              setIsResizing(false);
              setArtifactWidth(window.innerWidth - size.width - (isSidebarOpen ? 256 : 64));
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