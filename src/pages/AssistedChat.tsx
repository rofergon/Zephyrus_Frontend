import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ChatService, type WebSocketResponse } from '../services/chatService';
import { virtualFS } from '../services/virtual-fs';
import { ResizableBox } from 'react-resizable';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  HomeIcon, 
  ChatBubbleLeftRightIcon,
  DocumentDuplicateIcon,
  CogIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  CurrencyDollarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  ClipboardDocumentIcon,
  UserCircleIcon,
  CommandLineIcon,
  PlusIcon,
  XMarkIcon,
  CodeBracketIcon,
  CheckIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  ChevronDownIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import 'react-resizable/css/styles.css';
import { conversationService, type ConversationContext, type Message as IMessage } from '../services/conversationService';
import { v4 as uuidv4 } from 'uuid';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import '../styles/editor.css';

// Asegurarse de que el ícono esté disponible globalmente
const ChevronDown = ChevronDownIcon;

// Estilos globales para scrollbars
const scrollbarStyle = `
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(31, 41, 55, 0.5);
    border-radius: 5px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(75, 85, 99, 0.5);
    border-radius: 5px;
    border: 2px solid rgba(31, 41, 55, 0.5);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(75, 85, 99, 0.8);
  }

  ::-webkit-scrollbar-corner {
    background: transparent;
  }
`;

// Añadir los estilos al documento
const styleSheet = document.createElement("style");
styleSheet.innerText = scrollbarStyle;
document.head.appendChild(styleSheet);

interface ContractFunction {
  name: string;
  description: string;
  type: 'function' | 'constructor' | 'event';
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
  inputs: Array<{
    name: string;
    type: string;
    description?: string;
    components?: Array<{
      name: string;
      type: string;
    }>;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
    components?: Array<{
      name: string;
      type: string;
    }>;
  }>;
}

interface ContractArtifact {
  name: string;
  description: string;
  functions: ContractFunction[];
  address?: string;
  abi?: any[];
}

// Función auxiliar para generar una descripción legible de una función
const generateFunctionDescription = (func: ContractFunction): string => {
  const inputsDesc = func.inputs
    .map(input => `${input.name} (${input.type})`)
    .join(', ');
  
  const outputsDesc = func.outputs && func.outputs.length > 0
    ? ` returns (${func.outputs.map(out => `${out.name || 'value'} (${out.type})`).join(', ')})`
    : '';
  
  const mutability = func.stateMutability ? ` [${func.stateMutability}]` : '';
  
  return `${func.name}(${inputsDesc})${outputsDesc}${mutability}`;
};

// Función para procesar el ABI y convertirlo en ContractFunction[]
const processABI = (abi: any[]): ContractFunction[] => {
  return abi
    .filter(item => item.type === 'function')
    .map(item => {
      const funcForDescription: ContractFunction = {
        name: item.name,
        description: '',
        type: item.type,
        stateMutability: item.stateMutability,
        inputs: item.inputs || [],
        outputs: item.outputs || []
      };
      
      return {
        name: item.name,
        description: generateFunctionDescription(funcForDescription),
        type: item.type,
        stateMutability: item.stateMutability,
        inputs: item.inputs.map((input: any) => ({
          name: input.name || 'value',
          type: input.type,
          description: `Input parameter of type ${input.type}`,
          components: input.components
        })),
        outputs: item.outputs?.map((output: any) => ({
          name: output.name || 'value',
          type: output.type,
          components: output.components
        }))
      };
    });
};

const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Función auxiliar para generar un valor de ejemplo basado en el tipo
const generateExampleValue = (type: string): string => {
  switch (type) {
    case 'uint256':
    case 'uint':
      return '1000000000000000000'; // 1 ETH en wei
    case 'uint8':
      return '100';
    case 'address':
      return '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    case 'bool':
      return 'true';
    case 'string':
      return '"Example String"';
    case 'bytes':
      return '0x0123456789abcdef';
    default:
      if (type.includes('[]')) {
        return '[]'; // Array vacío para tipos array
      }
      return '""'; // Valor por defecto para tipos desconocidos
  }
};

// Componente para mostrar una función individual
const FunctionCard: React.FC<{ func: ContractFunction }> = ({ func }) => {
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleInputChange = (name: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCopyFunction = () => {
    const functionText = `${func.name}(${func.inputs.map(input => `${input.type} ${input.name}`).join(', ')})`;
    navigator.clipboard.writeText(functionText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isViewOrPure = func.stateMutability === 'view' || func.stateMutability === 'pure';
  
  return (
    <div 
      className={`relative transform transition-all duration-200 ${
        isExpanded ? 'scale-100' : isHovered ? 'scale-[1.02]' : 'scale-100'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`
        relative overflow-hidden rounded-xl backdrop-blur-sm
        ${isExpanded ? 'ring-2' : 'hover:ring-1'} 
        ${isViewOrPure 
          ? 'bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 ring-emerald-500/30' 
          : 'bg-gradient-to-br from-blue-900/20 to-blue-800/10 ring-blue-500/30'
        }
        transition-all duration-300 ease-out
      `}>
        {/* Glowing effect on hover */}
        <div className={`
          absolute inset-0 opacity-0 transition-opacity duration-300
          ${isHovered ? 'opacity-20' : ''}
          ${isViewOrPure 
            ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0' 
            : 'bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0'
          }
        `} />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-white">
                  {func.name}
                </h3>
                <div className={`
                  px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${isViewOrPure 
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' 
                    : 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                  }
                `}>
                  {func.stateMutability}
                </div>
                <button
                  onClick={handleCopyFunction}
                  className={`
                    p-1.5 rounded-lg transition-all duration-200
                    ${isCopied 
                      ? 'bg-green-500/20 text-green-300' 
                      : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'
                    }
                  `}
                  title={isCopied ? "Copied!" : "Copy function signature"}
                >
                  {isCopied ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                {func.description}
              </p>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`
                p-2 rounded-lg transition-all duration-300
                ${isExpanded 
                  ? isViewOrPure ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                  : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'
                }
              `}
            >
              <ChevronDown className={`
                w-5 h-5 transform transition-transform duration-300
                ${isExpanded ? 'rotate-180' : 'rotate-0'}
              `} />
            </button>
          </div>

          {/* Expanded Content */}
          <div className={`
            space-y-6 transition-all duration-300 ease-out
            ${isExpanded ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden'}
          `}>
            {/* Inputs */}
            {func.inputs.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                  <DocumentTextIcon className="w-4 h-4" />
                  <span>Input Parameters</span>
                </h4>
                <div className="space-y-4">
                  {func.inputs.map((input, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">
                          <span className="text-gray-300">{input.name}</span>
                          <span className="text-gray-500 ml-2">({input.type})</span>
                        </label>
                        <button
                          onClick={() => handleInputChange(input.name, generateExampleValue(input.type))}
                          className={`
                            text-xs px-2 py-1 rounded-md transition-colors duration-200
                            ${isViewOrPure 
                              ? 'text-emerald-400 hover:bg-emerald-500/20' 
                              : 'text-blue-400 hover:bg-blue-500/20'
                            }
                          `}
                        >
                          Use example
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={inputValues[input.name] || ''}
                          onChange={(e) => handleInputChange(input.name, e.target.value)}
                          placeholder={`Enter ${input.type} value`}
                          className={`
                            w-full bg-gray-900/50 rounded-lg px-4 py-2.5 text-white text-sm
                            border transition-colors duration-200
                            ${isViewOrPure 
                              ? 'border-emerald-500/30 focus:border-emerald-500 focus:ring-emerald-500/50' 
                              : 'border-blue-500/30 focus:border-blue-500 focus:ring-blue-500/50'
                            }
                            focus:outline-none focus:ring-2 placeholder-gray-500
                          `}
                        />
                        {input.description && (
                          <p className="mt-1.5 text-xs text-gray-500">{input.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outputs */}
            {func.outputs && func.outputs.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                  <ArrowPathIcon className="w-4 h-4" />
                  <span>Return Values</span>
                </h4>
                <div className={`
                  rounded-lg p-3 space-y-2
                  ${isViewOrPure 
                    ? 'bg-emerald-900/20 border border-emerald-500/20' 
                    : 'bg-blue-900/20 border border-blue-500/20'
                  }
                `}>
                  {func.outputs.map((output, idx) => (
                    <div key={idx} className="text-sm flex items-center space-x-2">
                      <span className="text-gray-300">{output.name || `output${idx + 1}`}</span>
                      <span className="text-gray-500">({output.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Button */}
            <button
              className={`
                w-full px-4 py-3 rounded-lg text-white text-sm font-medium
                transition-all duration-200 transform hover:translate-y-[-1px]
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
                ${isViewOrPure 
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 focus:ring-emerald-500' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:ring-blue-500'
                }
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
              `}
              onClick={() => {
                // Aquí iría la lógica de ejecución
                console.log('Function inputs:', inputValues);
              }}
            >
              <span className="flex items-center justify-center space-x-2">
                {isViewOrPure ? (
                  <>
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    <span>Query</span>
                  </>
                ) : (
                  <>
                    <BoltIcon className="w-4 h-4" />
                    <span>Execute</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageComponent: React.FC<{ message: Message }> = ({ message }) => (
  <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
    <div className={`max-w-[80%] rounded-lg p-3 ${
      message.sender === 'user' 
        ? 'bg-blue-600 text-white' 
        : message.sender === 'system'
        ? 'bg-red-600/20 border border-red-500/30 text-red-200'
        : 'bg-gray-700 text-gray-200'
    }`}>
      <div>{message.text}</div>
      {message.actions && (
        <div className="mt-2 flex gap-2">
          {message.actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

interface ConsoleMessage {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
  timestamp: number;
}

interface CompilationResult {
  success: boolean;
  markers?: Array<{
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    message: string;
    severity: number;
  }>;
  output?: any;
  error?: string;
}

// Utilidad para manejar la compilación
const handleCompilationResult = (
  result: CompilationResult,
  monaco: typeof import('monaco-editor'),
  model: monaco.editor.ITextModel,
  addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void,
  setCurrentArtifact: (artifact: ContractArtifact | null) => void
) => {
  const { markers, error, output } = result;
  
  // Limpiar marcadores anteriores
  monaco.editor.setModelMarkers(model, 'solidity', []);
  
  if (error) {
    const errorMarker = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: error,
      severity: monaco.MarkerSeverity.Error
    };
    monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
    addConsoleMessage(error, 'error');
    return;
  }

  if (markers && markers.length > 0) {
    const processedMarkers = markers.map(marker => ({
      ...marker,
      severity: marker.severity >= 8 
        ? monaco.MarkerSeverity.Error 
        : monaco.MarkerSeverity.Warning
    }));
    
    monaco.editor.setModelMarkers(model, 'solidity', processedMarkers);
    
    // Usar Set para mensajes únicos
    const uniqueMessages = new Set<string>();
    markers.forEach(marker => {
      const message = `[Line ${marker.startLineNumber}:${marker.startColumn}] ${marker.message}`;
      if (!uniqueMessages.has(message)) {
        uniqueMessages.add(message);
        addConsoleMessage(message, marker.severity >= 8 ? 'error' : 'warning');
      }
    });
  }

  if (output?.contracts) {
    const contractName = Object.keys(output.contracts['Compiled_Contracts'])[0];
    if (contractName) {
      const abi = output.contracts['Compiled_Contracts'][contractName].abi;
      const processedFunctions = processABI(abi);
      setCurrentArtifact(prev => ({
        ...prev,
        name: contractName,
        description: `Smart contract ${contractName} interface`,
        functions: processedFunctions,
        abi: abi
      }));
      
      addConsoleMessage(`Contract "${contractName}" compiled successfully`, 'success');
    }
  }
};

const AssistedChat: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<ContractArtifact | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatService = useRef<ChatService>(new ChatService());
  const [artifactWidth, setArtifactWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isChatMaximized, setIsChatMaximized] = useState(false);
  const location = useLocation();
  const [conversationContexts, setConversationContexts] = useState<ConversationContext[]>([]);
  const [activeContext, setActiveContext] = useState<ConversationContext | undefined>();
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>('');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const compileTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCompilationRef = useRef<string>('');
  const [consoleHeight, setConsoleHeight] = useState(200);

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

  // Calculate initial widths
  useEffect(() => {
    const calculateWidths = () => {
      const totalAvailableWidth = window.innerWidth - (isSidebarOpen ? 256 : 64); // Total width minus sidebar
      const artifactInitialWidth = Math.floor(totalAvailableWidth * 0.5); // 50% for artifact
      setArtifactWidth(artifactInitialWidth);
    };

    calculateWidths();
    window.addEventListener('resize', calculateWidths);
    return () => window.removeEventListener('resize', calculateWidths);
  }, [isSidebarOpen]);

  // Update demo artifact with English text
  const demoArtifact: ContractArtifact = {
    name: "Smart Contract Demo",
    description: "A demonstration smart contract with basic functions",
    functions: [
      {
        name: "transfer",
        description: "Transfer tokens to another address",
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          {
            name: "amount",
            type: "uint256",
            description: "Amount of tokens to transfer"
          }
        ]
      },
      {
        name: "mint",
        description: "Create new tokens",
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          {
            name: "amount",
            type: "uint256",
            description: "Amount of tokens to mint"
          }
        ]
      },
      {
        name: "burn",
        description: "Burn (destroy) existing tokens",
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          {
            name: "amount",
            type: "uint256",
            description: "Amount of tokens to burn"
          }
        ]
      }
    ]
  };

  useEffect(() => {
    setCurrentArtifact(demoArtifact);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeContext?.messages]);

  const initializeConversation = useCallback(() => {
    try {
      const contexts = conversationService.getContexts();
      console.log('[Chat] Initializing with contexts:', contexts);
      
      if (contexts.length > 0) {
        // Usar el último contexto como activo
        const activeContext = contexts[contexts.length - 1];
        activeContext.active = true;
        
        // Actualizar los demás contextos como inactivos
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

  // WebSocket connection effect
  useEffect(() => {
    const service = chatService.current;

    service.onConnectionChange((connected: boolean) => {
      setWsConnected(connected);
    });

    service.onMessage((response: WebSocketResponse) => {
      console.log('[Chat] Received message:', response);
      if (response.type === 'message') {
        const newMessage: Message = {
          id: generateUniqueId(),
          text: response.content,
          sender: 'ai',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        setIsTyping(false);
      } else if (response.type === 'contexts_loaded') {
        try {
          const contexts = JSON.parse(response.content);
          console.log('[Chat] Parsed contexts:', contexts);
          
          if (Array.isArray(contexts)) {
            // Actualizar los contextos
            const processedContexts = contexts.map(ctx => ({
              ...ctx,
              messages: ctx.messages || [],
              virtualFiles: ctx.virtualFiles || {},
              active: false
            }));
            
            // Establecer el último contexto como activo
            if (processedContexts.length > 0) {
              processedContexts[processedContexts.length - 1].active = true;
            }
            
            setConversationContexts(processedContexts);
            
            // Establecer el contexto activo
            if (processedContexts.length > 0) {
              setActiveContext(processedContexts[processedContexts.length - 1]);
              // Cargar los mensajes del contexto activo
              setMessages(processedContexts[processedContexts.length - 1].messages || []);
            }
          }
        } catch (error) {
          console.error('[Chat] Error parsing contexts:', error);
        }
      }
    });

    // Connect with wallet address
    service.connect(address || undefined);

    return () => {
      service.disconnect();
    };
  }, [address]);

  // Actualizar el useEffect que maneja el cambio de contexto activo
  useEffect(() => {
    console.log('[AssistedChat] Active context changed:', activeContext);
    if (activeContext?.virtualFiles) {
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
  }, [activeContext]);

  const handleSubmit = (message: string) => {
    const newMessage: Message = {
      id: generateUniqueId(),
      text: message,
      sender: 'user',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
    setIsTyping(true);

    // Send message to agent
    chatService.current.sendMessage(message);
    setInput(''); // Clear input after sending
  };

  const handleFunctionCall = (func: ContractFunction) => {
    // Here we'll implement the actual contract interaction
    console.log('Calling function:', func.name);
  };

  const menuItems = [
    { path: '/dashboard', icon: HomeIcon, text: 'Dashboard' },
    { path: '/chat', icon: ChatBubbleLeftRightIcon, text: 'Solidity Assistant' },
    { path: '/templates', icon: DocumentDuplicateIcon, text: 'Contract Templates' },
    { path: '/deploy', icon: CogIcon, text: 'Deploy' },
    { path: '/admin', icon: WrenchScrewdriverIcon, text: 'Contract Admin' },
    { path: '/bonding-tokens', icon: CurrencyDollarIcon, text: 'Bonding Tokens' },
    { path: '/social', icon: UsersIcon, text: 'Social' },
  ];

  const createNewChat = () => {
    try {
      chatService.current.createNewChat("New Chat");
      setIsTyping(true);
    } catch (error) {
      console.error('[Chat] Error creating new chat:', error);
    }
  };

  const handleContextSwitch = (contextId: string) => {
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
      chatService.current.switchChat(contextId);
      
      console.log('[Chat] Context switch complete:', selectedContext);
    } catch (error) {
      console.error('[Chat] Error switching context:', error);
    }
  };

  const handleContextDelete = async (contextId: string) => {
    try {
      console.log('[Chat] Deleting context:', contextId);
      
      // Enviar mensaje al backend para borrar el chat
      await chatService.current?.sendMessage('', {
        type: 'delete_context',
        chat_id: contextId
      });
      
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

  const isConversationContext = (obj: any): obj is ConversationContext => {
    return obj && 
           typeof obj === 'object' && 
           'id' in obj && 
           'name' in obj && 
           'type' in obj && 
           'wallet_address' in obj &&
           'created_at' in obj &&
           'last_accessed' in obj &&
           'messages' in obj;
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
    if (!code) return;
    
    // Solo evitar compilación si está compilando actualmente
    if (isCompiling) return;
    
    setIsCompiling(true);
    addConsoleMessage("Starting compilation...", "info");
    
    try {
      if (!editorRef.current || !monacoRef.current) {
        throw new Error("Editor not initialized");
      }
      
      const model = editorRef.current.getModel();
      if (!model) {
        throw new Error("Editor model not found");
      }

      // Limpiar marcadores anteriores
      monacoRef.current.editor.setModelMarkers(model, 'solidity', []);

      const workerUrl = new URL('../workers/solc.worker.js', import.meta.url);
      const worker = new Worker(workerUrl, { type: 'module' });
      
      worker.onmessage = (event) => {
        const { markers, error, output } = event.data;
        console.log('[AssistedChat] Compilation result:', { markers, error, output });
        
        handleCompilationResult(
          {
            success: !error,
            markers,
            error,
            output
          },
          monacoRef.current!,
          model,
          addConsoleMessage,
          setCurrentArtifact
        );
        
        worker.terminate();
        setIsCompiling(false);
        lastCompilationRef.current = code;
      };
      
      worker.onerror = (error) => {
        console.error('[AssistedChat] Worker error:', error);
        handleCompilationResult(
          { 
            success: false, 
            error: `Worker error: ${error.message}`
          },
          monacoRef.current!,
          model,
          addConsoleMessage,
          setCurrentArtifact
        );
        worker.terminate();
        setIsCompiling(false);
      };
      
      worker.postMessage({
        sourceCode: code,
        sourcePath: 'main.sol'
      });
      
    } catch (error) {
      console.error('[AssistedChat] Compilation error:', error);
      addConsoleMessage(`Compilation error: ${error instanceof Error ? error.message : String(error)}`, "error");
      setIsCompiling(false);
    }
  }, [isCompiling]);

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
            onResizeStop={(e, { size }) => {
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
                </div>

                {/* Conversation Contexts Tabs */}
                <div className="flex-none border-b border-gray-700 bg-gray-900/50">
                  <div className="flex items-center px-4 py-2">
                    <div className="flex-1 overflow-x-auto flex items-center space-x-2">
                      {conversationContexts.map((context) => (
                        <div key={context.id} className="flex items-center">
                        <button
                          onClick={() => handleContextSwitch(context.id)}
                            className={`group flex items-center px-4 py-2 space-x-2 border-b-2 transition-colors whitespace-nowrap rounded-t-lg ${
                            context.active
                                ? 'border-blue-500 text-blue-400 bg-gray-800'
                                : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                          }`}
                        >
                            <ChatBubbleLeftRightIcon className="w-4 h-4" />
                          <span>{context.name}</span>
                          {context.active && (
                            <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </button>
                          <button
                            onClick={() => {
                              if (window.confirm('¿Estás seguro de que quieres borrar este chat? Esta acción no se puede deshacer.')) {
                                handleContextDelete(context.id);
                              }
                            }}
                            className="ml-2 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                            title="Borrar chat permanentemente"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={createNewChat}
                      className="ml-2 p-2 text-gray-400 hover:text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700/50 flex items-center space-x-1"
                      title="New Chat"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span className="text-sm">New Chat</span>
                    </button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900/50 to-gray-800/30">
                  <div className="max-w-4xl mx-auto h-full flex flex-col">
                    <div className="flex-1 min-h-0"></div>
                    <div className="p-6 space-y-6">
                      {messages.map((message) => (
                        <MessageComponent key={message.id} message={message} />
                      ))}
                      {isTyping && (
                        <div className="flex justify-start group animate-fade-in">
                          <div className="flex-shrink-0 mr-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                              <CommandLineIcon className="w-5 h-5 text-blue-400" />
                            </div>
                          </div>
                          <div className="flex flex-col items-start maxw-[85%] lg:max-w-[75%]">
                            <div className="relative rounded-2xl px-6 py-4 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 text-gray-100 border border-gray-700/50 mr-12">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 px-2 mt-1 text-xs text-gray-500">
                              <span>{format(Date.now(), 'HH:mm')}</span>
                              <span>•</span>
                              <span>Assistant is typing...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>

                {/* Visual Separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent"></div>

                {/* Input Area */}
                <div className={`flex-none bg-gradient-to-b from-gray-800/95 to-gray-900/95 backdrop-blur-sm ${isChatMaximized ? 'mx-auto w-3/4 max-w-3xl' : 'mx-4'} mb-4 rounded-2xl shadow-lg border border-gray-700/50`}>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) {
                      handleSubmit(input);
                      setInput('');
                    }
                  }} className="relative">
                    <div className="p-4">
                      <div className="relative group">
                        <textarea
                          value={input}
                          onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, isChatMaximized ? 200 : 288) + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (input.trim()) {
                                handleSubmit(input);
                                setInput('');
                              }
                            }
                          }}
                          className="w-full bg-gray-900/80 text-white rounded-xl pl-4 pr-24 py-3.5 
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                            resize-none overflow-y-auto border border-gray-700/50
                            transition-all duration-200
                            group-hover:border-gray-600/50 group-hover:bg-gray-900/90"
                          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                          style={{
                            minHeight: '48px',
                            maxHeight: '288px',
                          }}
                          rows={1}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                          <button
                            type="button"
                            className="p-2 text-gray-400 hover:text-gray-300 bg-gray-800/80 rounded-lg 
                              hover:bg-gray-700 transition-all duration-200 border border-gray-700/50
                              hover:border-gray-600/50 hover:shadow-lg"
                            title="Attach document"
                          >
                            <PaperClipIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="submit"
                            disabled={!input.trim()}
                            className="p-2 text-blue-400 hover:text-blue-300 bg-blue-500/10 rounded-lg 
                              hover:bg-blue-500/20 transition-all duration-200 border border-blue-500/30
                              hover:border-blue-500/50 hover:shadow-lg
                              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500/10"
                            title="Send message"
                          >
                            <PaperAirplaneIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </ResizableBox>

          {/* Contract Artifact Section with new layout */}
          {currentArtifact && (
            <div 
              className={`flex-none flex flex-col p-6 transition-all duration-300 ease-in-out ${
                isMaximized ? 'fixed inset-4 z-50 bg-gray-900/95 backdrop-blur-md' : ''
              }`}
              style={{ width: isMaximized ? 'auto' : `${artifactWidth}px` }}
            >
              <div className="flex-1 flex flex-col bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl">
                {/* Header with Toggle Button */}
                <div className="flex-none h-16 border-b border-gray-700 px-6 flex items-center justify-between bg-gray-800/95 rounded-t-lg">
                  <div>
                    <h2 className="text-xl font-bold text-white">{currentArtifact.name}</h2>
                    <p className="text-sm text-gray-400">{currentArtifact.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowCodeEditor(!showCodeEditor)}
                      className="p-2 text-gray-400 hover:text-blue-400 bg-gray-900/50 rounded-lg hover:bg-gray-900/80 transition-all duration-200 flex items-center space-x-2"
                      title={showCodeEditor ? "Show Contract Demo" : "Show Contract Code"}
                    >
                      <CodeBracketIcon className="w-5 h-5" />
                      <span className="text-sm">{showCodeEditor ? "Show Demo" : "Show Code"}</span>
                    </button>
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      className="p-2 text-gray-400 hover:text-blue-400 bg-gray-900/50 rounded-lg hover:bg-gray-900/80 transition-all duration-200"
                      title={isMaximized ? "Minimize" : "Maximize"}
                    >
                      {isMaximized ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col">
                  <ResizableBox
                    width={Infinity}
                    height={window.innerHeight - 400}
                    axis="y"
                    resizeHandles={['s']}
                    minConstraints={[Infinity, window.innerHeight * 0.3]}
                    maxConstraints={[Infinity, window.innerHeight * 0.7]}
                    handle={
                      <div className="h-2 cursor-ns-resize bg-gray-700 hover:bg-blue-500 transition-colors absolute bottom-0 left-0 right-0" />
                    }
                  >
                    <div className="h-full overflow-hidden">
                      {showCodeEditor ? (
                        <Editor
                          height="100%"
                          defaultLanguage="solidity"
                          value={currentCode}
                          theme="solidityTheme"
                          options={{
                            minimap: { enabled: true },
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            fontSize: 14,
                            tabSize: 2,
                            wordWrap: 'on',
                            renderValidationDecorations: 'on',
                            glyphMargin: true,
                            lightbulb: {
                              enabled: monaco.editor.ShowLightbulbIconMode.OnCode
                            },
                            hover: {
                              enabled: true,
                              delay: 300
                            },
                            suggest: {
                              showWords: true
                            },
                            quickSuggestions: {
                              other: true,
                              comments: true,
                              strings: true
                            },
                            folding: true,
                            lineDecorationsWidth: 10,
                            renderLineHighlight: 'all',
                            occurrencesHighlight: "singleFile",
                            renderWhitespace: 'none',
                            bracketPairColorization: {
                              enabled: true
                            },
                            guides: {
                              bracketPairs: true,
                              indentation: true
                            }
                          }}
                          onMount={(editor, monaco) => {
                            editorRef.current = editor;
                            monacoRef.current = monaco;

                            // Registrar el lenguaje Solidity
                            monaco.languages.register({ id: 'solidity' });

                            // Configurar el resaltado de sintaxis para Solidity
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
                                      '@keywords': { token: 'keyword', foreground: '569CD6' },
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

                            // Definir el tema personalizado para Solidity
                            monaco.editor.defineTheme('solidityTheme', {
                              base: 'vs-dark',
                              inherit: true,
                              rules: [
                                { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
                                { token: 'identifier', foreground: 'D4D4D4' },
                                { token: 'type', foreground: '4EC9B0' },
                                { token: 'number', foreground: 'B5CEA8' },
                                { token: 'string', foreground: 'CE9178' },
                                { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                                { token: 'operator', foreground: 'D4D4D4' },
                                { token: 'delimiter', foreground: 'D4D4D4' },
                                { token: 'brackets', foreground: 'FFD700' }
                              ],
                              colors: {
                                'editor.background': '#1E1E1E',
                                'editor.foreground': '#D4D4D4',
                                'editor.lineHighlightBackground': '#2F3337',
                                'editorCursor.foreground': '#FFFFFF',
                                'editor.selectionBackground': '#264F78',
                                'editor.inactiveSelectionBackground': '#3A3D41'
                              }
                            });

                            // Aplicar el tema
                            monaco.editor.setTheme('solidityTheme');
                          }}
                          onChange={(value) => {
                            if (!value) return;
                            setCurrentCode(value);
                            
                            // Reducir el debounce a 300ms para una mejor respuesta
                            if (compileTimeoutRef.current) {
                              clearTimeout(compileTimeoutRef.current);
                            }
                            
                            compileTimeoutRef.current = setTimeout(() => {
                              compileCode(value);
                            }, 300);
                          }}
                        />
                      ) : (
                        <div className="h-full overflow-y-auto">
                          <div className="p-6 space-y-8">
                            {/* Contract Header */}
                            <div className="flex items-center justify-between">
                              <div>
                                <h2 className="text-2xl font-bold text-white">{currentArtifact.name}</h2>
                                <p className="text-gray-400 mt-1">{currentArtifact.description}</p>
                              </div>
                              {currentArtifact.address && (
                                <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                  <span className="text-sm text-gray-400">Deployed at:</span>
                                  <code className="text-sm text-blue-400">{currentArtifact.address}</code>
                                </div>
                              )}
                            </div>

                            {/* View/Pure Functions */}
                            {currentArtifact.functions.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure').length > 0 && (
                              <div className="relative">
                                <div className="sticky top-0 z-10 backdrop-blur-sm bg-gray-900/80 -mx-6 px-6 py-4 border-b border-gray-700/50">
                                  <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                      <MagnifyingGlassIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-semibold text-white">Read Functions</h3>
                                      <p className="text-sm text-gray-400">Query contract state without gas fees</p>
                                    </div>
                                  </div>
                                </div>
                                <div className={`mt-6 grid grid-cols-1 ${
                                  isMaximized ? 'lg:grid-cols-4' : 'lg:grid-cols-2'
                                } gap-6`}>
                                  {currentArtifact.functions
                                    .filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure')
                                    .map((func, index) => (
                                      <FunctionCard key={index} func={func} />
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Write Functions */}
                            {currentArtifact.functions.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure').length > 0 && (
                              <div className="relative mt-8">
                                <div className="sticky top-0 z-10 backdrop-blur-sm bg-gray-900/80 -mx-6 px-6 py-4 border-b border-gray-700/50">
                                  <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                      <BoltIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-semibold text-white">Write Functions</h3>
                                      <p className="text-sm text-gray-400">Modify contract state (requires gas)</p>
                                    </div>
                                  </div>
                                </div>
                                <div className={`mt-6 grid grid-cols-1 ${
                                  isMaximized ? 'lg:grid-cols-4' : 'lg:grid-cols-2'
                                } gap-6`}>
                                  {currentArtifact.functions
                                    .filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure')
                                    .map((func, index) => (
                                      <FunctionCard key={index} func={func} />
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Empty State */}
                            {currentArtifact.functions.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="p-4 rounded-full bg-gray-800/50 mb-4">
                                  <CodeBracketIcon className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-300">No Functions Available</h3>
                                <p className="text-gray-500 mt-2 max-w-md">
                                  This contract doesn't have any functions defined yet. Add some functions to your contract to see them here.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </ResizableBox>

                  {/* Console Area */}
                  <div className="flex-none border-t border-gray-700 mt-2">
                    <div 
                      className="h-1 bg-gray-700 hover:bg-blue-500 cursor-ns-resize transition-colors"
                      onMouseDown={(e) => {
                        const startY = e.clientY;
                        const startHeight = consoleHeight;
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const delta = startY - moveEvent.clientY;
                          const newHeight = Math.min(Math.max(startHeight + delta, 150), window.innerHeight * 0.6);
                          setConsoleHeight(newHeight);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    />
                    <div 
                      className="bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl overflow-hidden flex flex-col"
                      style={{ height: `${consoleHeight}px` }}
                    >
                      <div className="flex-none h-10 border-b border-gray-700 px-4 flex items-center justify-between bg-gray-800/95">
                        <h3 className="text-sm font-medium text-gray-300">Console Log</h3>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                        <div className="space-y-2">
                          {consoleMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`console-message ${msg.type} flex items-start space-x-2 opacity-0 animate-fade-slide-up`}
                              style={{
                                animationDelay: '100ms',
                                animationFillMode: 'forwards'
                              }}
                            >
                              <div className={`flex-shrink-0 w-4 h-4 mt-1 rounded-full status-indicator ${msg.type} ${
                                msg.type === 'error' ? 'bg-red-500' :
                                msg.type === 'warning' ? 'bg-yellow-500' :
                                msg.type === 'success' ? 'bg-green-500' :
                                'bg-blue-500'
                              }`}></div>
                              <div className={`flex-1 ${
                                msg.type === 'error' ? 'text-red-400' :
                                msg.type === 'warning' ? 'text-yellow-400' :
                                msg.type === 'success' ? 'text-green-400' :
                                'text-blue-400'
                              }`}>
                                <div className="font-semibold mb-0.5">
                                  {msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}
                                </div>
                                <div className="opacity-90">
                                  {msg.message}
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-xs text-gray-500 mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          ))}
                          {consoleMessages.length === 0 && (
                            <div className="text-gray-500 text-center py-4">
                              No messages to display
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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