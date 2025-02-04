import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Editor, { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ResizableBox } from 'react-resizable';
import FileExplorer from '../components/FileExplorer';
import { virtualFS } from '../services/virtual-fs';
import 'react-resizable/css/styles.css';

// Asegurarse de que virtualFS está inicializado
if (!virtualFS) {
  console.error('[Chat] VirtualFileSystem not initialized');
  throw new Error('VirtualFileSystem not initialized');
}

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai' | 'system';
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

function Chat() {
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const snippets: Snippets = {
    'SPDX License': '// SPDX-License-Identifier: MIT\n',
    'Basic Contract': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyContract {
    constructor() {
    }
}`,
    'ERC20 Token': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor() ERC20("MyToken", "MTK") {
    }
}`
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
          
          setMessages([{
            id: Date.now(),
            text: `I've loaded the template and created it as ${fileName}. Feel free to ask any questions about the contract or request modifications!`,
            sender: 'ai',
          }]);
        } catch (error) {
          console.error('Error creating template file:', error);
          setMessages([{
            id: Date.now(),
            text: "There was an error creating the template file. Please try again.",
            sender: 'system',
          }]);
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
    } catch (error) {
      console.error('Error loading file:', error);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
    };

    setMessages([...messages, newMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse: Message = {
        id: Date.now() + 1,
        text: "I understand you want to create a smart contract. Could you provide more details about the functionality you're looking for?",
        sender: 'ai',
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleImportOpenZeppelin = async (): Promise<void> => {
    try {
      const newMessage: Message = {
        id: Date.now(),
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
        id: Date.now(),
        text: 'All OpenZeppelin contracts and dependencies have been imported successfully.',
        sender: 'system',
      };
      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('Error importing OpenZeppelin contracts:', error);
      const errorMessage: Message = {
        id: Date.now(),
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

  return (
    <>
      {/* Main container with proper height calculation to account for navbar */}
      <div className="flex flex-col h-screen">
        {/* Navbar space */}
        <div className="h-16 flex-shrink-0"></div>
        
        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer with resize handle */}
          <div className="relative" style={{ width: `${fileExplorerWidth}px`, minWidth: '150px' }}>
            <div className="h-full">
              <FileExplorer onFileSelect={handleFileSelect} selectedFile={selectedFile} />
            </div>
            {/* Vertical resize handle */}
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/20 transition-colors"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startWidth = fileExplorerWidth;
                
                const handleMouseMove = (moveEvent) => {
                  const delta = moveEvent.clientX - startX;
                  const newWidth = Math.max(150, Math.min(startWidth + delta, window.innerWidth * 0.8));
                  setFileExplorerWidth(newWidth);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div className="w-1 h-full bg-gray-600 opacity-0 hover:opacity-100"></div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor Section */}
            <div 
              className="flex-1 bg-gray-900 min-h-0 relative"
              style={{ height: `calc(100% - ${chatHeight}px)` }}
            >
              {renderEditorToolbar()}
              <div className="h-[calc(100%-40px)]">
                <Editor
                  height="100%"
                  defaultLanguage="solidity"
                  defaultValue={code}
                  theme="solidityDark"
                  value={code}
                  onChange={handleCodeChange}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    padding: { top: 16 },
                    lineNumbers: 'on',
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    folding: true,
                    bracketPairColorization: {
                      enabled: true
                    },
                    guides: {
                      bracketPairs: true,
                      indentation: true
                    }
                  }}
                  beforeMount={(monaco) => {
                    monaco.editor.defineTheme('solidityDark', {
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
                    monaco.editor.setTheme('solidityDark');
                  }}
                />
              </div>
              
              {/* Resize handle between editor and chat */}
              <div
                className="absolute bottom-0 left-0 w-full h-2 cursor-row-resize group bg-transparent hover:bg-blue-500/20 transition-colors z-10"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startHeight = chatHeight;
                  const totalHeight = window.innerHeight - 64; // 4rem for top bar
                  
                  const handleMouseMove = (moveEvent) => {
                    const delta = startY - moveEvent.clientY;
                    const newChatHeight = Math.min(
                      Math.max(150, startHeight + delta),
                      totalHeight - 200 // Ensure minimum editor height of 200px
                    );
                    setChatHeight(newChatHeight);
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.cursor = 'default';
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  document.body.style.cursor = 'row-resize';
                }}
              >
                <div className="w-full h-0.5 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>

            {/* Chat Section */}
            <div 
              ref={chatContainerRef}
              className="bg-gray-900 border-t border-gray-700"
              style={{ height: `${chatHeight}px` }}
            >
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-lg ${
                          message.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex items-center space-x-2 text-gray-400">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ask about smart contracts..."
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      Send
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Chat;