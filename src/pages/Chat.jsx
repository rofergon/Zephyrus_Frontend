import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';

function Chat() {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('// Your Solidity contract will appear here');
  const [isTyping, setIsTyping] = useState(false);
  const [width, setWidth] = useState(400);
  const messagesEndRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const solidityVersions = ['0.8.19', '0.8.18', '0.8.17', '0.8.16'];
  const [selectedVersion, setSelectedVersion] = useState('0.8.19');

  const snippets = {
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
      setCode(location.state.templateCode);
      setMessages([{
        id: Date.now(),
        text: "I've loaded the template for you. Feel free to ask any questions about the contract or request modifications!",
        sender: 'ai',
      }]);
    }
  }, [location.state?.templateCode]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.languages.register({ id: 'solidity' });
    
    monaco.languages.setMonarchTokensProvider('solidity', {
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
          [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'identifier' } }],
          [/[{}()\[\]]/, '@brackets'],
          [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
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
          [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
        
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/\*]/, 'comment']
        ]
      }
    });

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
        'editor.background': '#1A1A1A',
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
        'minimap.background': '#1A1A1A',
        'scrollbarSlider.background': '#404040',
        'scrollbarSlider.hoverBackground': '#505050',
        'scrollbarSlider.activeBackground': '#606060'
      }
    });

    monaco.editor.setTheme('solidityDark');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
    };

    setMessages([...messages, newMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        text: "I understand you want to create a smart contract. Could you provide more details about the functionality you're looking for?",
        sender: 'ai',
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleVersionChange = (version) => {
    setSelectedVersion(version);
    
    if (editorRef.current) {
      const currentCode = editorRef.current.getValue();
      const updatedCode = currentCode.replace(
        /pragma solidity \^\d+\.\d+\.\d+;/,
        `pragma solidity ^${version};`
      );
      editorRef.current.setValue(updatedCode);
      setCode(updatedCode);
    }
  };

  const insertSnippet = (snippetCode) => {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      editorRef.current.executeEdits('', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        },
        text: snippetCode
      }]);
    }
  };

  const validateSolidity = async (codeContent) => {
    console.log('[Chat] Starting validation for code:', codeContent.substring(0, 100) + '...');
    return new Promise((resolve) => {
      const worker = new Worker(new URL('../workers/solc.worker.js', import.meta.url), { type: 'module' });
      
      worker.onmessage = (event) => {
        const { markers, error } = event.data;
        if (error) {
          console.error('[Chat] Compilation error:', error);
        }
        console.log('[Chat] Received markers from worker:', markers);
        resolve(markers || []);
      };

      worker.onerror = (error) => {
        console.error('[Chat] Worker error:', error);
        resolve([]);
      };

      console.log('[Chat] Sending code to worker');
      worker.postMessage(codeContent);
    });
  };

  useEffect(() => {
    const updateMarkers = async () => {
      if (editorRef.current && monacoRef.current) {
        console.log('[Chat] Updating markers for code change');
        const model = editorRef.current.getModel();
        const markers = await validateSolidity(code);
        console.log('[Chat] Setting markers in editor:', markers);
        monacoRef.current.editor.setModelMarkers(model, 'solidity', markers);
      }
    };
    updateMarkers();
  }, [code]);

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      <ResizableBox
        width={width}
        height={Infinity}
        minConstraints={[300, Infinity]}
        maxConstraints={[window.innerWidth - 400, Infinity]}
        onResize={(e, { size }) => {
          setWidth(size.width);
        }}
        resizeHandles={['e']}
        className="flex-shrink-0"
        handle={
          <div className="absolute right-0 top-0 w-4 h-full cursor-col-resize flex items-center justify-center hover:bg-blue-500/20 transition-colors">
            <div className="w-0.5 h-8 bg-gray-400 rounded-full group-hover:bg-blue-400"></div>
          </div>
        }
      >
        <div className="h-full flex flex-col bg-gray-800 rounded-lg shadow-xl overflow-hidden">
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
      </ResizableBox>

      <div className="flex-1 bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="p-3 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">Contract Editor</h3>
            <div className="flex items-center space-x-2">
              <select
                value={selectedVersion}
                onChange={(e) => handleVersionChange(e.target.value)}
                className="px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700"
              >
                {solidityVersions.map(version => (
                  <option key={version} value={version}>
                    Solidity {version}
                  </option>
                ))}
              </select>
              <div className="relative">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      insertSnippet(snippets[e.target.value]);
                      e.target.value = '';
                    }
                  }}
                  className="px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700"
                  defaultValue=""
                >
                  <option value="" disabled>Insertar Snippet</option>
                  {Object.keys(snippets).map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => editorRef.current.getAction('editor.action.formatDocument').run()}
                className="px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700 hover:bg-gray-700"
              >
                Format
              </button>
            </div>
          </div>
        </div>
        <Editor
          height="calc(100vh - 10rem)"
          defaultLanguage="solidity"
          defaultValue={code}
          theme="solidityDark"
          value={code}
          onChange={setCode}
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
            },
            renderLineHighlight: 'all',
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: true,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            }
          }}
        />
      </div>
    </div>
  );
}

export default Chat;