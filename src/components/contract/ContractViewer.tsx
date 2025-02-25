import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import {   MagnifyingGlassIcon,  BoltIcon,  RocketLaunchIcon,} from '@heroicons/react/24/outline';
import FunctionCard from '../FunctionCard';
import { ContractArtifact, ConsoleMessage } from '../../types/contracts';
import { useDeployment } from '../../services/deploymentService';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import 'react-resizable/css/styles.css';

interface ContractViewerProps {
  currentArtifact: ContractArtifact | null;
  currentCode: string;
  showCodeEditor: boolean;
  isMaximized: boolean;
  consoleHeight: number;
  consoleMessages: ConsoleMessage[];
  onCodeChange: (value: string | undefined) => void;
  onCompile: (code: string) => void;
  onConsoleResize: (height: number) => void;
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<typeof monaco | null>;
  conversationId: string;
  addConsoleMessage: (message: string, type: ConsoleMessage['type']) => void;
}

const ContractViewer: React.FC<ContractViewerProps> = ({
  currentArtifact,
  currentCode,
  showCodeEditor,
  isMaximized,
  consoleHeight,
  consoleMessages,
  onCodeChange,
  onCompile,
  onConsoleResize,
  editorRef,
  monacoRef,
  conversationId,
  addConsoleMessage,
}) => {
  const compileTimeoutRef = useRef<NodeJS.Timeout>();
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const consoleContentRef = useRef<HTMLDivElement>(null);
  const { deployContract } = useDeployment();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<{
    success?: boolean;
    contractAddress?: string;
    transactionHash?: string;
    error?: string;
    timestamp?: number;
  } | null>(null);
  const [constructorArgs, setConstructorArgs] = useState<any[]>([]);
  const [, setError] = useState<string | null>(null);
  const previousCodeRef = useRef(currentCode);
  const [autoScroll, setAutoScroll] = useState(true);

  // Effect to update deployment result when contract address changes
  useEffect(() => {
    if (currentArtifact?.address) {
      console.log('[ContractViewer] Contract address detected:', currentArtifact.address);
      setDeploymentResult({
        success: true,
        contractAddress: currentArtifact.address
      });
    }
  }, [currentArtifact?.address]);

  // Efecto para manejar cambios automáticos en el código
  useEffect(() => {
    if (currentCode !== previousCodeRef.current) {
      console.log('[ContractViewer] Code changed externally, triggering compilation');
      previousCodeRef.current = currentCode;
      
      if (editorRef.current && monacoRef.current) {
        // Actualizar el contenido del editor
        const model = editorRef.current.getModel();
        if (model) {
          // Preservar la posición del cursor
          const position = editorRef.current.getPosition();
          model.setValue(currentCode);
          if (position) {
            editorRef.current.setPosition(position);
          }
        }

        // Limpiar timeout anterior si existe
        if (compileTimeoutRef.current) {
          clearTimeout(compileTimeoutRef.current);
        }
        
        // Programar nueva compilación
        compileTimeoutRef.current = setTimeout(() => {
          console.log('[ContractViewer] Compiling after external code change');
          onCompile(currentCode);
        }, 1000);
      }
    }
  }, [currentCode, onCompile]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (compileTimeoutRef.current) {
        clearTimeout(compileTimeoutRef.current);
      }
    };
  }, []);

  // Function to scroll console to bottom
  const scrollToBottom = () => {
    if (consoleContainerRef.current) {
      const container = consoleContainerRef.current;
      // Force scroll to the very bottom
      container.scrollTop = container.scrollHeight + 9999;
    }
  };

  // Add effect for auto-scrolling when new messages arrive
  useEffect(() => {
    // Use multiple approaches to ensure scroll happens after rendering
    requestAnimationFrame(() => {
      scrollToBottom();
    });
    
    // Also try with timeouts at different intervals
    setTimeout(scrollToBottom, 50);
    setTimeout(scrollToBottom, 200);
    setTimeout(scrollToBottom, 500);
  }, [consoleMessages]);

  // Also scroll on deployment result changes
  useEffect(() => {
    if (deploymentResult) {
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
    }
  }, [deploymentResult]);

  // Use mutation observer to detect DOM changes in the console and scroll to bottom
  useEffect(() => {
    if (consoleContentRef.current) {
      const observer = new MutationObserver(() => {
        if (autoScroll) {
          scrollToBottom();
        }
      });
      
      observer.observe(consoleContentRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      return () => observer.disconnect();
    }
  }, [autoScroll]);

  // Handle scroll events to determine if auto-scroll should be enabled/disabled
  const handleConsoleScroll = () => {
    if (consoleContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleContainerRef.current;
      // If user has scrolled up more than 50px from bottom, disable auto-scroll
      // If user scrolls to bottom again, re-enable auto-scroll
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  // Función para obtener el constructor del ABI
  const getConstructor = () => {
    if (!currentArtifact?.abi) return null;
    return currentArtifact.abi.find((item: any) => item.type === 'constructor');
  };

  const handleDeploy = async () => {
    if (!currentArtifact?.abi || !currentArtifact?.bytecode || !isConnected || !conversationId) {
      console.error('No contract compiled, wallet not connected, or no conversation ID');
      setError('Missing required data for deployment');
      return;
    }

    // Asegurarse de que estamos en la red Sonic Blaze Testnet
    if (chainId !== 57054) {
      await switchChain?.({ chainId: 57054 });
      return;
    }

    setIsDeploying(true);
    setDeploymentResult(null);

    try {
      const result = await deployContract(
        currentArtifact.abi,
        currentArtifact.bytecode,
        constructorArgs,
        conversationId,
        currentArtifact.name,
        currentCode
      );

      // Add timestamp to deployment result
      const resultWithTimestamp = {
        ...result,
        timestamp: Date.now()
      };
      
      setDeploymentResult(resultWithTimestamp);
      
      // Add a success message to the console
      if (result.success) {
        const successMessage = `Deployment Successful! Contract address: ${result.contractAddress}`;
        // Use the addConsoleMessage prop to add message to console
        addConsoleMessage(successMessage, 'info');
        // Ensure console is visible
        onConsoleResize(Math.max(consoleHeight, 200));
      }
    } catch (error) {
      setDeploymentResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now()
      });
      
      // Add error message to console
      addConsoleMessage(
        `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`, 
        'error'
      );
    } finally {
      setIsDeploying(false);
    }
  };

  // Función para manejar cambios en los argumentos del constructor
  const handleConstructorArgChange = (index: number, value: string) => {
    setConstructorArgs(prev => {
      const newArgs = [...prev];
      newArgs[index] = value;
      return newArgs;
    });
  };

  if (!currentArtifact) return null;

  const constructor = getConstructor();

  return (
    <div className="flex flex-col h-full relative">
      {/* Main Content Area - Editor/Function Cards con scroll propio */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Editor Container */}
        <div className={`flex-1 relative ${!showCodeEditor ? 'hidden' : ''}`}>
          <div className="absolute inset-0">
            <Editor
              height="100%"
              defaultLanguage="solidity"
              defaultValue={currentCode}
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

                // Establecer el valor inicial
                const model = editor.getModel();
                if (model) {
                  model.setValue(currentCode);
                }

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

                // Configurar el editor para mostrar los marcadores de error
                editor.updateOptions({
                  glyphMargin: true,
                  lineNumbers: 'on',
                  folding: true,
                  renderValidationDecorations: 'on',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  lineDecorationsWidth: 10,
                  renderLineHighlight: 'all',
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  },
                  suggest: {
                    showWords: true
                  }
                });

                // Configurar el tema con soporte para marcadores de error
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
                    'editor.inactiveSelectionBackground': '#3A3D41',
                    'editorError.foreground': '#F14C4C',
                    'editorError.border': '#F14C4C',
                    'editorWarning.foreground': '#CCA700',
                    'editorWarning.border': '#CCA700',
                    'editorGutter.background': '#1E1E1E',
                    'editorGutter.modifiedBackground': '#4B9FD6',
                    'editorGutter.addedBackground': '#487E02',
                    'editorGutter.deletedBackground': '#F14C4C',
                    'editorOverviewRuler.errorForeground': '#F14C4C',
                    'editorOverviewRuler.warningForeground': '#CCA700'
                  }
                });

                // Aplicar el tema
                monaco.editor.setTheme('solidityTheme');
                // Configure custom decorations for errors
                const decorations = editor.createDecorationsCollection();

                // Subscribe to marker changes
                const disposable = monaco.editor.onDidChangeMarkers(([resource]) => {
                  if (resource.toString() === editor.getModel()?.uri.toString()) {
                    const markers = monaco.editor.getModelMarkers({ resource });
                    const model = editor.getModel();
                    
                    if (!model) return;

                    const newDecorations = markers.map(marker => {
                      // Get the content of the line where the error occurs
                      const lineContent = model.getLineContent(marker.startLineNumber);
                      
                      // Calculate the actual error range
                      let startColumn = marker.startColumn;
                      let endColumn = marker.endColumn;
                      
                      // If we have a specific column in the error
                      if (marker.startColumn > 0) {
                        // Look for the closest token around the error position
                        const beforeError = lineContent.substring(0, marker.startColumn - 1);
                        const afterError = lineContent.substring(marker.startColumn - 1);
                        
                        // Find the last word boundary before the error
                        const lastWord = beforeError.match(/\w+$/);
                        if (lastWord) {
                          startColumn = marker.startColumn - lastWord[0].length;
                        }
                        
                        // Find the next word boundary after the error
                        const nextWord = afterError.match(/^\w+/);
                        if (nextWord) {
                          endColumn = marker.startColumn + nextWord[0].length;
                        } else {
                          // If no word is found, try to find the next symbol
                          const nextSymbol = afterError.match(/^[^\s\w]*/);
                          if (nextSymbol) {
                            endColumn = marker.startColumn + nextSymbol[0].length;
                          }
                        }
                      } else {
                        // If no specific column, highlight the first problematic token in the line
                        const tokenMatch = lineContent.match(/[^\s]+/);
                        if (tokenMatch) {
                          startColumn = tokenMatch.index! + 1;
                          endColumn = startColumn + tokenMatch[0].length;
                        }
                      }

                      return {
                        range: new monaco.Range(
                          marker.startLineNumber,
                          startColumn,
                          marker.startLineNumber,
                          endColumn
                        ),
                        options: {
                          isWholeLine: false,
                          className: marker.severity === monaco.MarkerSeverity.Error ? 'error-decoration' : 'warning-decoration',
                          glyphMarginClassName: 'glyph-margin-error',
                          hoverMessage: { value: marker.message },
                          overviewRuler: {
                            color: marker.severity === monaco.MarkerSeverity.Error ? '#F14C4C' : '#CCA700',
                            position: monaco.editor.OverviewRulerLane.Right
                          }
                        }
                      };
                    });

                    decorations.set(newDecorations);
                  }
                });

                // Manejar cambios en el contenido
                editor.onDidChangeModelContent(() => {
                  const newCode = editor.getValue();
                  onCodeChange(newCode);
                  
                  // Limpiar timeout anterior
                  if (compileTimeoutRef.current) {
                    clearTimeout(compileTimeoutRef.current);
                  }
                  
                  // Programar nueva compilación
                  compileTimeoutRef.current = setTimeout(() => {
                    console.log('[ContractViewer] Compiling after content change');
                    onCompile(newCode);
                  }, 1000);
                });

                // Cleanup
                return () => {
                  if (compileTimeoutRef.current) {
                    clearTimeout(compileTimeoutRef.current);
                  }
                  disposable.dispose();
                };
              }}
            />
          </div>
        </div>

        {/* Function Cards Container con scroll propio y márgenes fijos */}
        {!showCodeEditor && (
          <div className="flex-1 relative">
            <div className="absolute inset-0 overflow-auto">
              <div className="min-w-[640px]"> {/* Ancho mínimo para evitar compresión excesiva */}
                <div className="p-4 lg:p-6 space-y-6 lg:space-y-8 pb-20"> {/* Padding bottom extra para margen inferior */}
                  {/* Contract Header - Mejorado para móviles y scroll horizontal */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
                    <div className="flex-shrink-0">
                      <h2 className="text-xl lg:text-2xl font-bold text-white">{currentArtifact.name}</h2>
                      <p className="text-sm lg:text-base text-gray-400 mt-1">{currentArtifact.description}</p>
                    </div>
                    {currentArtifact.address && (
                      <div className="flex-shrink-0 flex items-center space-x-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <span className="text-sm text-gray-400 whitespace-nowrap">Deployed at:</span>
                        <code className="text-sm text-blue-400 break-all">{currentArtifact.address}</code>
                      </div>
                    )}
                  </div>

                  {/* Functions Grid - Mejorada la responsividad y scroll */}
                  {currentArtifact.functions && currentArtifact.functions.length > 0 ? (
                    <>
                      {/* View/Pure Functions */}
                      {currentArtifact.functions.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure').length > 0 && (
                        <div className="relative">
                          <div className="sticky top-0 z-10 backdrop-blur-sm bg-gray-900/80 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 border-b border-gray-700/50">
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
                          <div className={`mt-6 grid gap-4 lg:gap-6 min-w-0
                            ${isMaximized 
                              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                              : 'grid-cols-1 sm:grid-cols-2'
                            }`}>
                            {currentArtifact.functions
                              .filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure')
                              .map((func, index) => (
                                <FunctionCard 
                                  key={index} 
                                  func={func} 
                                  contractAddress={currentArtifact.address}
                                  abi={currentArtifact.abi}
                                  deploymentResult={deploymentResult}
                                />
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Write Functions - Similar grid improvement */}
                      {currentArtifact.functions.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure').length > 0 && (
                        <div className="relative mt-8">
                          <div className="sticky top-0 z-10 backdrop-blur-sm bg-gray-900/80 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 border-b border-gray-700/50">
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
                          <div className={`mt-6 grid gap-4 lg:gap-6 min-w-0
                            ${isMaximized 
                              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                              : 'grid-cols-1 sm:grid-cols-2'
                            }`}>
                            {currentArtifact.functions
                              .filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure')
                              .map((func, index) => (
                                <FunctionCard 
                                  key={index} 
                                  func={func} 
                                  contractAddress={currentArtifact.address}
                                  abi={currentArtifact.abi}
                                  deploymentResult={deploymentResult}
                                />
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-400 text-center py-8">
                      No functions found in contract
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Console y Deploy Section - Contenedor fijo en la parte inferior */}
      <div className="flex-none">
        {/* Console Area */}
        <div className="mx-4 lg:mx-6 mb-4">
          {/* Barra de resize superior */}
          <div 
            className="h-1 bg-gray-700 hover:bg-blue-500 cursor-ns-resize transition-colors relative group"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startHeight = consoleHeight;
              const editorContainer = document.querySelector('.flex-1.relative');
              const viewportHeight = window.innerHeight;
              const containerRect = editorContainer?.getBoundingClientRect();
              
              if (!containerRect) return;
              
              // Calculamos límites basados en el espacio disponible
              const minHeight = 100;
              const maxHeight = Math.min(
                containerRect.height * 0.6, // Máximo 60% del contenedor del editor
                viewportHeight * 0.8 // O 80% del viewport
              );
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                moveEvent.preventDefault();
                const delta = startY - moveEvent.clientY;
                const newHeight = Math.min(Math.max(startHeight + delta, minHeight), maxHeight);
                
                if (newHeight >= minHeight && newHeight <= maxHeight) {
                  onConsoleResize(newHeight);
                }
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = 'default';
              };
              
              document.body.style.cursor = 'ns-resize';
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            {/* Indicador visual de resize */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>

          {/* Contenedor de la consola */}
          <div 
            className="bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl overflow-hidden flex flex-col mt-1"
            style={{ 
              height: `${consoleHeight}px`,
              minHeight: '100px'
            }}
          >
            {/* Cabecera de la consola */}
            <div className="flex-none h-10 border-b border-gray-700 px-4 flex items-center justify-between bg-gray-800/95 sticky top-0 z-10">
              <h3 className="text-sm font-medium text-gray-300">Console Log</h3>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
            </div>

            {/* Contenido de la consola */}
            <div 
              ref={consoleContainerRef}
              className="flex-1 overflow-y-auto p-4 pb-2 font-mono text-sm scroll-smooth"
              onScroll={handleConsoleScroll}
            >
              <div ref={consoleContentRef} className="space-y-2">
                {consoleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start space-x-2 p-2 rounded-lg transition-all duration-200 animate-fade-in ${
                      msg.type === 'error' 
                        ? 'bg-red-500/10 text-red-400' 
                        : msg.type === 'warning'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-gray-700/50 text-gray-300'
                    }`}
                  >
                    <div className="flex-1 whitespace-pre-wrap">{msg.message}</div>
                    <div className="flex-none text-xs text-gray-500">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                    </div>
                  </div>
                ))}
                {/* Bottom anchor element for scrolling target - reduced height */}
                <div id="console-bottom-anchor" style={{ height: '5px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Deploy Section */}
        {currentArtifact.bytecode && (
          <div className={`mt-4 p-4 ${
            currentArtifact.address || deploymentResult?.contractAddress 
              ? 'bg-gray-800/70 border-gray-700/30' 
              : 'bg-gray-800/90'
            } backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl`}>
            
            {/* Display different UI based on whether contract is already deployed */}
            {(currentArtifact.address || deploymentResult?.contractAddress) ? (
              // Compact version for redeployment
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400">
                    <RocketLaunchIcon className="w-4 h-4" />
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Deployed at: </span>
                    <code className="text-blue-400 text-xs">{currentArtifact.address || deploymentResult?.contractAddress}</code>
                  </div>
                </div>
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying || !isConnected}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    isDeploying || !isConnected
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  } text-white transition-colors duration-200`}
                >
                  {isDeploying ? 'Deploying...' : 'Redeploy'}
                </button>
              </div>
            ) : (
              // Full version for initial deployment
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <RocketLaunchIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Deploy Contract</h3>
                      <p className="text-sm text-gray-400">Deploy this contract to the blockchain</p>
                    </div>
                  </div>
                </div>

                {/* Constructor Arguments */}
                {constructor && constructor.inputs && constructor.inputs.length > 0 && (
                  <div className="space-y-4 mb-4">
                    <h4 className="text-sm font-medium text-gray-400">Constructor Arguments</h4>
                    {constructor.inputs.map((input: { name: string; type: string }, index: number) => (
                      <div key={index} className="space-y-1">
                        <label className="text-sm text-gray-400">
                          {input.name} ({input.type})
                        </label>
                        <input
                          type="text"
                          onChange={(e) => handleConstructorArgChange(index, e.target.value)}
                          placeholder={`Enter ${input.type}`}
                          className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Deploy Button for initial deployment */}
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying || !isConnected}
                  className={`w-full py-2 px-4 rounded-lg ${
                    isDeploying || !isConnected
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white transition-colors duration-200`}
                >
                  {isDeploying ? 'Deploying...' : 'Deploy Contract'}
                </button>
              </>
            )}

            {/* Show deployment result only temporarily after a deployment */}
            {deploymentResult && deploymentResult.timestamp && 
             Date.now() - deploymentResult.timestamp < 10000 && (
              <div className={`mt-4 p-3 rounded-lg border animate-fade-in ${
                deploymentResult.success
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-red-900/20 border-red-700'
              }`}>
                <h4 className={`text-sm font-medium mb-1 ${
                  deploymentResult.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {deploymentResult.success ? 'Deployment Successful' : 'Deployment Failed'}
                </h4>
                {deploymentResult.success ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-400">Contract Address: </span>
                      <code className="text-blue-400">{deploymentResult.contractAddress}</code>
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-400">Transaction Hash: </span>
                      <code className="text-blue-400">{deploymentResult.transactionHash}</code>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-300">{deploymentResult.error}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractViewer;