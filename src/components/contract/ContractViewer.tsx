import { useState, useRef, useEffect } from 'react';
import { ResizableBox } from 'react-resizable';
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
}) => {
  const compileTimeoutRef = useRef<NodeJS.Timeout>();
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
  } | null>(null);
  const [constructorArgs, setConstructorArgs] = useState<any[]>([]);
  const [, setError] = useState<string | null>(null);
  const previousCodeRef = useRef(currentCode);

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

      setDeploymentResult(result);
    } catch (error) {
      setDeploymentResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
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
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
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

        {/* Constructor Arguments and Deploy Section */}
        <div className="mx-4 lg:mx-6 mb-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <div className="p-4 overflow-x-auto"> {/* Añadido scroll horizontal */}
            {/* Constructor Arguments Grid */}
            {constructor && constructor.inputs && constructor.inputs.length > 0 && (
              <div className="space-y-2 mb-4 min-w-[640px]"> {/* Ancho mínimo para evitar compresión */}
                <h3 className="text-sm font-medium text-gray-300">Constructor Arguments</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {constructor.inputs.map((input: any, index: number) => (
                    <div key={index} className="space-y-1">
                      <label className="text-sm text-gray-400">
                        {input.name} ({input.type})
                      </label>
                      <input
                        type="text"
                        value={constructorArgs[index] || ''}
                        onChange={(e) => handleConstructorArgChange(index, e.target.value)}
                        placeholder={`Enter ${input.type} value`}
                        className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deploy Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-[640px]">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleDeploy}
                  disabled={!isConnected || isDeploying || chainId !== 57054}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                    isConnected && !isDeploying && chainId === 57054
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-700 cursor-not-allowed'
                  } text-white transition-colors duration-200 whitespace-nowrap`}
                >
                  {isDeploying ? (
                    <BoltIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <RocketLaunchIcon className="w-5 h-5" />
                  )}
                  <span>
                    {isDeploying
                      ? 'Deploying...'
                      : chainId !== 57054
                      ? 'Switch to Sonic'
                      : 'Deploy Contract'}
                  </span>
                </button>
              </div>
              
              {deploymentResult && (
                <div className={`flex-1 min-w-0 flex items-center space-x-2 px-4 py-2 rounded-lg ${
                  deploymentResult.success ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                }`}>
                  {deploymentResult.success ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full overflow-hidden">
                      <span className="whitespace-nowrap">Deployed at: </span>
                      <a
                        href={`https://testnet.sonicscan.org/address/${deploymentResult.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-green-300 truncate"
                      >
                        {deploymentResult.contractAddress}
                      </a>
                    </div>
                  ) : (
                    <span className="truncate">{deploymentResult.error}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractViewer; 