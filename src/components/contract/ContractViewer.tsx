import React, { useRef } from 'react';
import { ResizableBox } from 'react-resizable';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { 
  CodeBracketIcon,
  MagnifyingGlassIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import FunctionCard from '../FunctionCard';
import { ContractFunction, ContractArtifact, ConsoleMessage } from '../../types/contracts';

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
}) => {
  const compileTimeoutRef = useRef<NodeJS.Timeout>();

  if (!currentArtifact) return null;

  return (
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

                // Add change handler
                editor.onDidChangeModelContent(() => {
                  const newCode = editor.getValue();
                  onCodeChange(newCode);
                  
                  // Trigger compilation after a delay
                  if (compileTimeoutRef.current) {
                    clearTimeout(compileTimeoutRef.current);
                  }
                  compileTimeoutRef.current = setTimeout(() => {
                    onCompile(newCode);
                  }, 1000);
                });
              }}
              onChange={(value) => {
                if (!value) return;
                onCodeChange(value);
                
                if (compileTimeoutRef.current) {
                  clearTimeout(compileTimeoutRef.current);
                }
                
                compileTimeoutRef.current = setTimeout(() => {
                  onCompile(value);
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
              onConsoleResize(newHeight);
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
  );
};

export default ContractViewer; 