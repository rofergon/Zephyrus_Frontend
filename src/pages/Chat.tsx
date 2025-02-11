import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Editor, { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ResizableBox } from 'react-resizable';
import FileExplorer from '../components/FileExplorer';
import { virtualFS } from '../services/virtual-fs';
import { ChatService, type SessionInfo } from '../services/chatService';
import 'react-resizable/css/styles.css';
import { XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import SessionList from '../components/SessionList';
import { sessionService } from '../services/sessionService';
import { useAccount } from 'wagmi';
import AssistedChat from './AssistedChat';

// Asegurarse de que virtualFS está inicializado
if (!virtualFS) {
  console.error('[Chat] VirtualFileSystem instance not found');
  throw new Error('VirtualFileSystem instance not found');
}

console.log('[Chat] VirtualFileSystem instance found');

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp?: number;
}

interface Marker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: number;
}

interface Snippets {
  [key: string]: string;
}

interface WorkerMessage {
  markers?: Marker[];
  error?: string;
  output?: any;
}

interface AgentResponse {
  type: 'message' | 'code_edit' | 'file_create' | 'file_delete';
  content: string;
  metadata?: {
    fileName?: string;
    path?: string;
    language?: string;
  };
}

// Generador de IDs únicos usando UUID v4
const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Add new ModeSelection component
const ModeSelection = ({ onModeSelect }: { onModeSelect: (mode: 'advanced' | 'assisted') => void }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-95 z-50">
      <div className="max-w-2xl w-full mx-4">
        <div className="glass-morphism rounded-lg p-8 space-y-6">
          <h2 className="text-3xl font-bold text-center text-white mb-8">
            Choose Your Development Mode
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Advanced Mode */}
            <button
              onClick={() => onModeSelect('advanced')}
              className="group relative p-6 rounded-lg border border-gray-700 hover:border-blue-500 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-blue-800/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <h3 className="text-xl font-semibold text-blue-400 mb-2">Advanced Mode</h3>
              <p className="text-gray-300 text-sm">
                Full code editor with direct contract manipulation. Perfect for experienced developers who want complete control.
              </p>
            </button>

            {/* Assisted Mode */}
            <button
              onClick={() => onModeSelect('assisted')}
              className="group relative p-6 rounded-lg border border-gray-700 hover:border-emerald-500 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-emerald-800/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <h3 className="text-xl font-semibold text-emerald-400 mb-2">Assisted Mode</h3>
              <p className="text-gray-300 text-sm">
                Guided development with AI assistance. Perfect for beginners or those who prefer a more intuitive approach.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function Chat() {
  const { address } = useAccount();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('// Your Solidity contract will appear here');
  const [isTyping, setIsTyping] = useState(false);
  const [chatHeight, setChatHeight] = useState(250);
  const [editorHeight, setEditorHeight] = useState('100%');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [fileExplorerWidth, setFileExplorerWidth] = useState(256);
  const [chatWidth, setChatWidth] = useState(400);
  const [debugConsoleHeight, setDebugConsoleHeight] = useState(200);
  const [wsConnected, setWsConnected] = useState(false);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [compilationErrors, setCompilationErrors] = useState<Marker[]>([]);
  const [isMobileFileExplorerOpen, setIsMobileFileExplorerOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [mode, setMode] = useState<'advanced' | 'assisted' | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatService = useRef<ChatService>(new ChatService());
  const debugConsoleRef = useRef<HTMLDivElement>(null);

  const snippets: Snippets = {
    'SPDX License': '// SPDX-License-Identifier: MIT\n',
    'Basic Contract': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyContract {
    constructor() {
    }
}`,
    'ERC20 Token': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor() ERC20("MyToken", "MTK") {
    }
}`
  };

  // Función para añadir mensajes a la consola de debug
  const addDebugMessage = (message: string) => {
    setDebugMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    setTimeout(() => {
      if (debugConsoleRef.current) {
        debugConsoleRef.current.scrollTop = debugConsoleRef.current.scrollHeight;
      }
    }, 100);
  };

  useEffect(() => {
    if (location.state?.templateCode) {
      const createTemplateFile = async () => {
        try {
          const timestamp = new Date().getTime();
          const fileName = `contracts/Template_${timestamp}.sol`;
          
          await virtualFS.writeFile(fileName, location.state.templateCode);
          
          setCode(location.state.templateCode);
          setSelectedFile(fileName);
          
          addDebugMessage(`Created new template file: ${fileName}`);
        } catch (error) {
          console.error('Error creating template file:', error);
          addDebugMessage(`Error creating template file: ${error.message}`);
        }
      };

      createTemplateFile();
    }
  }, [location.state?.templateCode]);

  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.offsetHeight);
    }

    const handleResize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const calculateHeights = () => {
      if (chatContainerRef.current) {
        const totalHeight = window.innerHeight - 64; // 4rem = 64px
        const newEditorHeight = totalHeight - chatHeight;
        setEditorHeight(`${newEditorHeight}px`);
      }
    };

    calculateHeights();
    window.addEventListener('resize', calculateHeights);
    return () => window.removeEventListener('resize', calculateHeights);
  }, [chatHeight]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Registrar el lenguaje Solidity
    monacoInstance.languages.register({ id: 'solidity' });
    
    // Configurar el resaltado de sintaxis para Solidity
    monacoInstance.languages.setMonarchTokensProvider('solidity', {
      defaultToken: '',
      tokenPostfix: '.sol',

      brackets: [
        { token: 'delimiter.curly', open: '{', close: '}' },
        { token: 'delimiter.parenthesis', open: '(', close: ')' },
        { token: 'delimiter.square', open: '[', close: ']' },
        { token: 'delimiter.angle', open: '<', close: '>' }
      ],

      keywords: [
        'pragma', 'solidity', 'contract', 'interface', 'library', 'is', 'public',
        'private', 'internal', 'external', 'pure', 'view', 'payable', 'storage',
        'memory', 'calldata', 'constant', 'immutable', 'constructor', 'function',
        'modifier', 'event', 'emit', 'anonymous', 'indexed', 'returns', 'return',
        'mapping', 'struct', 'enum', 'address', 'bool', 'string', 'bytes', 'uint',
        'int', 'fixed', 'ufixed', 'require', 'revert', 'assert', 'if', 'else',
        'for', 'while', 'do', 'break', 'continue', 'throw', 'import', 'using',
        'abstract', 'virtual', 'override'
      ],
      
      typeKeywords: [
        'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uint128', 'uint256',
        'int', 'int8', 'int16', 'int32', 'int64', 'int128', 'int256',
        'bytes', 'bytes1', 'bytes2', 'bytes3', 'bytes4', 'bytes5', 'bytes6', 'bytes7',
        'bytes8', 'bytes9', 'bytes10', 'bytes11', 'bytes12', 'bytes13',
        'bytes14', 'bytes15', 'bytes16', 'bytes17', 'bytes18', 'bytes19', 'bytes20',
        'bytes21', 'bytes22', 'bytes23', 'bytes24', 'bytes25', 'bytes26', 'bytes27',
        'bytes28', 'bytes29', 'bytes30', 'bytes31', 'bytes32', 'bool', 'address',
        'string'
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
              '@typeKeywords': 'type',
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

    // Definir el tema oscuro personalizado
    monacoInstance.editor.defineTheme('solidityDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'type', foreground: '4EC9B0', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'DCDCAA' },
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
        'editor.lineHighlightBackground': '#2A2A2A',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.selectionHighlightBackground': '#2D2D30',
        'editor.wordHighlightBackground': '#575757',
        'editorCursor.foreground': '#A6A6A6',
        'editorWhitespace.foreground': '#3B3B3B',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editor.findMatchBackground': '#515C6A',
        'editor.findMatchHighlightBackground': '#314365',
        'minimap.background': '#1E1E1E',
        'scrollbarSlider.background': '#404040',
        'scrollbarSlider.hoverBackground': '#505050',
        'scrollbarSlider.activeBackground': '#606060'
      }
    });

    // Aplicar el tema oscuro
    monacoInstance.editor.setTheme('solidityDark');
  };

  const handleFileSelect = async (path: string): Promise<void> => {
    try {
      const content = await virtualFS.readFile(path);
      setCode(content);
      setSelectedFile(path);
      addDebugMessage(`Opened file: ${path}`);
    } catch (error) {
      console.error('Error loading file:', error);
      addDebugMessage(`Error loading file: ${error.message}`);
    }
  };

  const validateSolidity = async (codeContent: string): Promise<Marker[]> => {
    console.log('[Chat] Starting validation for code:', codeContent.substring(0, 100) + '...');
    return new Promise((resolve) => {
      try {
        // Extraer la versión del pragma
        const pragmaMatch = codeContent.match(/pragma solidity\s+(\^?\d+\.\d+\.\d+);/);
        let version = '0.8.20'; // Fixed version
        
        // Verificar si la versión es mayor a 0.8.20 (última versión estable disponible)
        const versionParts = version.split('.').map(Number);
        if (versionParts[0] === 0 && versionParts[1] === 8 && versionParts[2] > 20) {
          resolve([{
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1000,
            message: `La versión ${version} no está disponible. La última versión estable es 0.8.20. Por favor, actualiza el pragma solidity a una versión disponible.`,
            severity: 8
          }]);
          return;
        }

        // Create and initialize the worker
        const workerUrl = new URL('../workers/solc.worker.js', import.meta.url);
        const worker = new Worker(workerUrl, { type: 'module' });

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const { markers, error, output } = event.data;
          if (error) {
            console.error('[Chat] Compilation error:', error);
            resolve([{
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 1000,
              message: error,
              severity: 8
            }]);
          } else {
            console.log('[Chat] Compilation successful:', output);
            resolve(markers || []);
          }
          worker.terminate();
        };

        worker.onerror = (error: ErrorEvent) => {
          console.error('[Chat] Worker error:', error);
          resolve([{
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1000,
            message: `Error de compilación: ${error.message}`,
            severity: 8
          }]);
          worker.terminate();
        };

        // Send the code to the worker
        console.log('[Chat] Sending code to worker');
        worker.postMessage({
          sourceCode: codeContent,
          sourcePath: selectedFile || 'main.sol'
        });

      } catch (error) {
        console.error('[Chat] Error creating worker:', error);
        resolve([{
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1000,
          message: `Error inesperado: ${error instanceof Error ? error.message : String(error)}`,
          severity: 8
        }]);
      }
    });
  };

  // Efecto para validación de código
  useEffect(() => {
    const updateMarkers = async () => {
      if (editorRef.current && monacoRef.current) {
        console.log('[Chat] Updating markers for code change');
        const model = editorRef.current.getModel();
        if (model) {
          const markers = await validateSolidity(code);
          console.log('[Chat] Setting markers in editor:', markers);
          monacoRef.current.editor.setModelMarkers(model, 'solidity', markers);
        }
      }
    };

    const debounceTimer = setTimeout(() => {
      updateMarkers();
    }, 500); // Debounce de 500ms para evitar validaciones muy frecuentes

    return () => clearTimeout(debounceTimer);
  }, [code]);

  const handleCodeChange = async (newCode: string | undefined): Promise<void> => {
    if (newCode === undefined) return;
    
    setCode(newCode);
    if (selectedFile) {
      try {
        await virtualFS.writeFile(selectedFile, newCode);
      } catch (error) {
        console.error('Error saving file:', error);
      }
    }
  };

  // Efecto para inicializar el virtualFS
  useEffect(() => {
    const initializeFS = async () => {
      try {
        console.log('[Chat] Checking VirtualFileSystem initialization');
        const isInit = await virtualFS.isInitialized();
        console.log('[Chat] VirtualFileSystem initialization status:', isInit);
        if (!isInit) {
          console.error('[Chat] VirtualFileSystem failed to initialize');
          setMessages(prev => [...prev, {
            id: generateUniqueId(),
            text: 'Error: File system initialization failed. Some features may not work correctly.',
            sender: 'system'
          }]);
        }
      } catch (error) {
        console.error('[Chat] Error checking VirtualFileSystem initialization:', error);
      }
    };

    initializeFS();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: Message = {
      id: generateUniqueId(),
      text: input,
      sender: 'user',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsTyping(true);
    addDebugMessage('Sending message to Zephyrus agent...');

    try {
      console.log('[Chat] Checking file system before sending message');
      const isInit = await virtualFS.isInitialized();
      console.log('[Chat] File system initialization status:', isInit);
      
      if (!isInit) {
        throw new Error('Virtual file system not initialized');
      }

      console.log('[Chat] Getting files from virtual file system');
      const files = await virtualFS.getFiles();
      console.log('[Chat] Retrieved files:', Object.keys(files));
      
      console.log('[Chat] Sending message to agent with context');
      chatService.current.sendMessage(input, {
        currentFile: selectedFile,
        currentCode: code,
        fileSystem: files
      });
    } catch (error) {
      console.error('[Chat] Error in handleSubmit:', error);
      addDebugMessage(`Error sending message: ${error instanceof Error ? error.message : 'Could not send message'}`);
      setIsTyping(false);
    }
  };

  const handleImportOpenZeppelin = async (): Promise<void> => {
    try {
      const newMessage: Message = {
        id: generateUniqueId(),
        text: `Importing OpenZeppelin contracts and dependencies...\nThis may take a moment.`,
        sender: 'system',
      };
      setMessages(prev => [...prev, newMessage]);

      const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["'](@openzeppelin\/contracts\/.*?)["']/g;
      const matches = [...code.matchAll(importRegex)];
      const importPaths = matches.map(match => match[1]);

      for (const importPath of importPaths) {
        try {
          await virtualFS.resolveImport(importPath);
        } catch (error) {
          console.error(`Error importing ${importPath}:`, error);
        }
      }

      const successMessage: Message = {
        id: generateUniqueId(),
        text: 'All OpenZeppelin contracts and dependencies have been imported successfully.',
        sender: 'system',
      };
      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('Error importing OpenZeppelin contracts:', error);
      const errorMessage: Message = {
        id: generateUniqueId(),
        text: `Error importing contracts: ${error.message}`,
        sender: 'system',
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const renderEditorToolbar = (): JSX.Element => (
    <div className="border-b border-gray-700 p-2 flex items-center justify-between">
      <div className="text-sm text-gray-300">
        {selectedFile || 'No file selected'}
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleImportOpenZeppelin}
          className="px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700 hover:bg-gray-700"
        >
          Import Dependencies
        </button>
        <button
          onClick={() => {
            const action = editorRef.current?.getAction('editor.action.formatDocument');
            action?.run();
          }}
          className="px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700 hover:bg-gray-700"
        >
          Format
        </button>
      </div>
    </div>
  );

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Efecto para manejar la conexión y sesiones
  useEffect(() => {
    const service = chatService.current;

    service.onConnectionChange((connected: boolean) => {
      setWsConnected(connected);
      addDebugMessage(`WebSocket ${connected ? 'connected' : 'disconnected'}`);
    });

    service.onMessage((response: AgentResponse) => {
      console.log('[Chat] Received agent response:', response);
      
      // Manejar el mensaje según su tipo
      if (response.type === 'message') {
        setMessages(prev => [...prev, {
          id: generateUniqueId(),
          text: response.content,
          sender: 'ai',
          timestamp: Date.now()
        }]);
      } else if (response.type === 'code_edit' || response.type === 'file_create') {
        // Actualizar el código en el editor
        if (response.metadata?.path) {
          setSelectedFile(response.metadata.path);
          setCode(response.content);
          virtualFS.writeFile(response.metadata.path, response.content)
            .then(() => {
              addDebugMessage(`File ${response.metadata?.path} updated/created successfully`);
            })
            .catch(error => {
              addDebugMessage(`Error updating/creating file: ${error.message}`);
            });
        }
      } else if (response.type === 'file_delete') {
        if (response.metadata?.path) {
          virtualFS.deleteFile(response.metadata.path)
            .then(() => {
              addDebugMessage(`File ${response.metadata?.path} deleted successfully`);
              if (selectedFile === response.metadata.path) {
                setSelectedFile(null);
                setCode('// Your Solidity contract will appear here');
              }
            })
            .catch(error => {
              addDebugMessage(`Error deleting file: ${error.message}`);
            });
        }
      }
      setIsTyping(false);
    });

    service.onSessionEstablished((sessionInfo: SessionInfo) => {
      setCurrentClientId(sessionInfo.clientId);
      setCurrentSessionId(sessionInfo.sessionId);
      addDebugMessage(`Session established: ${sessionInfo.sessionName}`);
      setMessages(prev => [...prev, {
        id: generateUniqueId(),
        text: `Connected to session: ${sessionInfo.sessionName}`,
        sender: 'system',
        timestamp: Date.now()
      }]);
    });

    // Iniciar conexión sin sessionId (creará una nueva)
    service.connect(undefined, address || undefined);

    return () => {
      service.disconnect();
    };
  }, [address]);

  const handleSessionSelect = async (sessionId: string) => {
    try {
      // Limpiar el estado actual
      setMessages([]);
      setCode('// Your Solidity contract will appear here');
      setSelectedFile(null);
      
      // Desconectar la sesión actual
      chatService.current.disconnect();
      
      // Esperar un momento para asegurar la desconexión
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Conectar a la nueva sesión
      chatService.current.connect(sessionId, address || undefined);
      
      setShowSessionList(false);
      
      // Agregar mensaje de sistema
      setMessages([{
        id: generateUniqueId(),
        text: 'Switching to selected session...',
        sender: 'system'
      }]);
    } catch (error) {
      console.error('Error switching session:', error);
      addDebugMessage('Error switching session');
    }
  };

  const handleCreateSession = async () => {
    try {
      if (!currentClientId) return;
      
      const sessionName = prompt('Enter session name:');
      if (!sessionName) return;

      const newSession = await sessionService.createSession(
        currentClientId,
        sessionName,
        address || undefined
      );
      
      // Esperar un momento antes de cambiar de sesión
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Cambiar a la nueva sesión
      await handleSessionSelect(newSession.session_id);
      
      // Recargar la lista de sesiones
      setShowSessionList(true);
    } catch (error) {
      console.error('Error creating session:', error);
      addDebugMessage('Error creating session');
      alert('Failed to create session');
    }
  };

  // Modificar el header del chat para incluir el botón de sesiones
  const renderChatHeader = () => (
    <div className="flex-none border-b border-gray-700 bg-gray-800/80 backdrop-blur-sm">
      <div className="p-4 flex items-center justify-between">
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
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSessionList(!showSessionList)}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors duration-200"
          >
            Sessions
          </button>
          {isSmallScreen && (
            <button
              onClick={() => setIsMobileChatOpen(false)}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors duration-200"
            >
              <XMarkIcon className="w-6 h-6 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Efecto para detectar tamaño de pantalla
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsMobileFileExplorerOpen(false);
        setIsMobileChatOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // If no mode is selected, show mode selection
  if (!mode) {
    return <ModeSelection onModeSelect={setMode} />;
  }

  // Render appropriate interface based on mode
  if (mode === 'assisted') {
    return <AssistedChat />;
  }

  // Rest of the existing Chat component (Advanced Mode)
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-900">
      {/* Mobile Header - Fixed at top */}
      {isSmallScreen && (
        <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
          <button
            onClick={() => setShowFileExplorer(!showFileExplorer)}
            className="text-gray-400 hover:text-white"
          >
            <span className="sr-only">Toggle File Explorer</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div 
          className={`${
            isSmallScreen 
              ? 'fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out'
              : 'w-64 border-r border-gray-700'
          } ${
            isMobileFileExplorerOpen || !isSmallScreen ? 'translate-x-0' : '-translate-x-full'
          } ${
            isSmallScreen ? 'mt-12' : ''
          } bg-gray-900 border-r border-gray-700`}
          style={{ 
            width: isSmallScreen ? '80%' : `${fileExplorerWidth}px`, 
            minWidth: isSmallScreen ? 'auto' : '200px',
            maxWidth: isSmallScreen ? '300px' : 'none'
          }}
        >
          <div className="h-full overflow-hidden flex flex-col">
            <FileExplorer 
              onFileSelect={(path) => {
                handleFileSelect(path);
                if (isSmallScreen) setIsMobileFileExplorerOpen(false);
              }}
              selectedFile={selectedFile} 
            />
          </div>
          {!isSmallScreen && (
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-gray-700 hover:bg-blue-500"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startWidth = fileExplorerWidth;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const newWidth = Math.max(200, Math.min(startWidth + moveEvent.clientX - startX, window.innerWidth * 0.4));
                  setFileExplorerWidth(newWidth);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          )}
        </div>

        {/* Editor and Debug Console Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editor Container */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {renderEditorToolbar()}
            <div className="flex-1 relative">
              <Editor
                height="100%"
                defaultLanguage="solidity"
                value={code}
                theme="vs-dark"
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: !isSmallScreen },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true
                }}
              />
            </div>
          </div>

          {/* Debug Console */}
          <div
            className="flex-none border-t border-gray-700"
            style={{ height: `${debugConsoleHeight}px` }}
          >
            <div
              className="absolute left-0 right-0 h-1 cursor-row-resize bg-gray-700 hover:bg-blue-500"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const startHeight = debugConsoleHeight;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const newHeight = Math.max(100, Math.min(startHeight + startY - moveEvent.clientY, window.innerHeight * 0.4));
                  setDebugConsoleHeight(newHeight);
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
              ref={debugConsoleRef}
              className="h-full overflow-y-auto bg-gray-900 text-gray-300 font-mono text-sm p-4"
            >
              {debugMessages.map((msg, index) => (
                <div key={index} className="mb-1">{msg}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div 
          className={`${
            isSmallScreen 
              ? 'fixed inset-y-0 right-0 z-40 transform transition-transform duration-300 ease-in-out'
              : 'relative flex-none'
          } ${
            isMobileChatOpen || !isSmallScreen ? 'translate-x-0' : 'translate-x-full'
          } ${isSmallScreen ? 'mt-12' : ''} bg-gray-800`}
          style={{ 
            width: isSmallScreen ? '80%' : `${chatWidth}px`,
            minWidth: isSmallScreen ? 'auto' : '300px',
            maxWidth: isSmallScreen ? '300px' : 'none'
          }}
        >
          <div className="h-full flex flex-col">
            {renderChatHeader()}
            
            {/* Session List Overlay */}
            {showSessionList && (
              <div className="absolute inset-0 z-10 bg-gray-900/95 backdrop-blur-sm">
                <SessionList
                  clientId={currentClientId}
                  currentSessionId={currentSessionId}
                  walletAddress={address || undefined}
                  onSessionSelect={handleSessionSelect}
                  onSessionCreate={handleCreateSession}
                />
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-800 to-gray-900">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-200'
                  }`}>
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="flex-none border-t border-gray-700">
              <div className="p-4">
                <form onSubmit={handleSubmit} className="flex space-x-4">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type your message..."
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;