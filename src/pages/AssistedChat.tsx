import React, { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ChatService, type SessionInfo, type WebSocketResponse } from '../services/chatService';
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
  PlusIcon
} from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import 'react-resizable/css/styles.css';
import { conversationService, type ConversationContext, type Message } from '../services/conversationService';
import { v4 as uuidv4 } from 'uuid';

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
  inputs: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
  }>;
}

interface ContractArtifact {
  name: string;
  description: string;
  balance: string;
  functions: ContractFunction[];
}

const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const AssistedChat: React.FC = () => {
  const { address } = useAccount();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<ContractArtifact | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatService = useRef<ChatService>(new ChatService());
  const [artifactWidth, setArtifactWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const [conversationContexts, setConversationContexts] = useState<ConversationContext[]>([]);
  const [activeContext, setActiveContext] = useState<ConversationContext | undefined>();

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
    balance: "1000 Tokens",
    functions: [
      {
        name: "transfer",
        description: "Transfer tokens to another address",
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

  const initializeConversation = async () => {
    try {
      const sessionId = chatService.current.getSessionId();
      if (!sessionId) {
        console.error('[Chat] No session ID available');
        return;
      }
      
      await conversationService.initializeSession(sessionId);
      const contexts = conversationService.getContexts();
      setConversationContexts(contexts);
      
      const active = conversationService.getActiveContext();
      if (active) {
        setActiveContext(active);
      } else if (contexts.length > 0) {
        // Si no hay contexto activo pero hay contextos, activar el primero
        conversationService.setActiveContext(contexts[0].id);
        setActiveContext(contexts[0]);
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
    }
  };

  // WebSocket connection effect
  useEffect(() => {
    const service = chatService.current;

    service.onConnectionChange(async (connected: boolean) => {
      setWsConnected(connected);
      if (connected) {
        await initializeConversation();
      }
    });

    service.onMessage((response: WebSocketResponse) => {
      if (response.type === 'message') {
        const currentContext = conversationService.getActiveContext();
        if (currentContext) {
          const newMessage: Message = {
            id: generateUniqueId(),
            text: response.content,
            sender: 'ai' as const,
            timestamp: Date.now()
          };
          conversationService.addMessage(currentContext.id, newMessage);
          // Forzar actualización del estado
          setActiveContext({...currentContext, messages: [...currentContext.messages, newMessage]});
          setConversationContexts([...conversationService.getContexts()]);
        }
      } else if (response.type === 'contexts_loaded') {
        try {
          const contextData = response.content;
          if (Array.isArray(contextData)) {
            conversationService.setContexts(contextData);
            setConversationContexts([...contextData]);
            const activeContext = contextData.find(ctx => ctx.active);
            if (activeContext) {
              setActiveContext({...activeContext});
            }
          }
        } catch (error) {
          console.error('Error handling contexts:', error);
        }
      } else if (response.type === 'context_created') {
        try {
          const newContext = response.content;
          if (isConversationContext(newContext)) {
            conversationService.addContext(newContext);
            setActiveContext({...newContext});
            setConversationContexts([...conversationService.getContexts()]);
          }
        } catch (error) {
          console.error('Error handling new context:', error);
        }
      } else if (response.type === 'context_switched') {
        try {
          const switchedContext = response.content;
          if (isConversationContext(switchedContext)) {
            conversationService.switchContext(switchedContext.id);
            setActiveContext({...switchedContext});
            setConversationContexts([...conversationService.getContexts()]);
          }
        } catch (error) {
          console.error('Error handling context switch:', error);
        }
      }
      setIsTyping(false);
    });

    // Connect without sessionId (will create new)
    service.connect(undefined, address || undefined);

    return () => {
      service.disconnect();
    };
  }, [address]);

  const handleSubmit = async (message: string) => {
    const currentContext = conversationService.getActiveContext();
    if (!currentContext) {
      console.error('[Chat] No active context found');
      return;
    }

    const messageObj = {
      id: generateUniqueId(),
      text: message,
      sender: 'user' as const,
      timestamp: Date.now()
    };

    conversationService.addMessage(currentContext.id, messageObj);
    setActiveContext({...currentContext, messages: [...currentContext.messages, messageObj]});
    
    try {
      await chatService.current?.sendMessage(message, {}, currentContext.id);
    } catch (error) {
      console.error('[Chat] Error sending message:', error);
    }
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
    chatService.current.sendMessage('', {}, undefined, 'create_context');
  };

  const handleContextSwitch = (contextId: string) => {
    const context = conversationContexts.find(ctx => ctx.id === contextId);
    if (context) {
      setActiveContext(context);
      chatService.current.sendMessage('', {}, contextId, 'switch_context');
    }
  };

  const isConversationContext = (obj: any): obj is ConversationContext => {
    return obj && 
           typeof obj === 'object' && 
           'id' in obj && 
           'name' in obj && 
           'type' in obj && 
           'timestamp' in obj && 
           'content' in obj && 
           'messages' in obj;
  };

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
                        isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'
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
            minConstraints={[Math.floor((window.innerWidth - (isSidebarOpen ? 256 : 64)) * 0.4), Infinity]}
            maxConstraints={[Math.floor((window.innerWidth - (isSidebarOpen ? 256 : 64)) * 0.6), Infinity]}
            onResizeStart={() => setIsResizing(true)}
            onResizeStop={(e, { size }) => {
              setIsResizing(false);
              setArtifactWidth(window.innerWidth - size.width - (isSidebarOpen ? 256 : 64));
            }}
            handle={<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-700 hover:bg-blue-500 z-10" />}
          >
            <div className="flex-1 h-full p-6">
              <div className="flex flex-col h-full bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl">
                {/* Chat Header */}
                <div className="flex-none h-16 border-b border-gray-700 px-6 flex items-center bg-gray-800/95 rounded-t-lg">
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
                  <div className="flex items-center px-4">
                    <div className="flex-1 overflow-x-auto flex items-center">
                      {conversationContexts.map((context) => (
                        <button
                          key={context.id}
                          onClick={() => handleContextSwitch(context.id)}
                          className={`flex items-center px-4 py-2 space-x-2 border-b-2 transition-colors whitespace-nowrap ${
                            context.active
                              ? 'border-blue-500 text-blue-400'
                              : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                          }`}
                        >
                          {context.type === 'chat' ? (
                            <ChatBubbleLeftRightIcon className="w-4 h-4" />
                          ) : (
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          )}
                          <span>{context.name}</span>
                          {context.active && (
                            <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={createNewChat}
                      className="ml-2 p-1.5 text-gray-400 hover:text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700/50 flex items-center space-x-1"
                      title="New Chat"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span className="text-sm">New Chat</span>
                    </button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto bg-gray-900/50">
                  <div className="max-w-3xl mx-auto h-full flex flex-col">
                    <div className="flex-1"></div>
                    <div className="p-4 space-y-4 pr-8">
                      {activeContext?.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} group`}
                        >
                          {message.sender === 'ai' && (
                            <div className="flex-shrink-0 mr-3">
                              <CommandLineIcon className="w-6 h-6 text-blue-500" />
                            </div>
                          )}
                          <div className="flex flex-col max-w-[75%]">
                            <div className={`${
                              message.sender === 'user' 
                                ? 'bg-blue-600 text-white ml-8' 
                                : 'bg-gray-900/80 text-gray-200 border border-gray-700/50 mr-8'
                            } rounded-lg px-4 py-3 shadow-lg whitespace-pre-wrap break-words relative group`}>
                              <ReactMarkdown
                                components={{
                                  code: ({ className, children, ...props }: { className?: string, children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const language = match ? match[1] : 'text';
                                    const isInline = !className?.includes('language-');
                                    return !isInline ? (
                                      <SyntaxHighlighter
                                        style={vscDarkPlus as any}
                                        language={language}
                                        PreTag="div"
                                        className="mt-2 mb-2"
                                      >
                                        {String(children).replace(/\n$/, '')}
                                      </SyntaxHighlighter>
                                    ) : (
                                      <code className={`${className} px-1 py-0.5 bg-gray-800 rounded`}>
                                        {children}
                                      </code>
                                    )
                                  }
                                }}
                              >
                                {message.text}
                              </ReactMarkdown>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(message.text);
                                  if (activeContext) {
                                    const updatedContext = {
                                      ...activeContext,
                                      messages: activeContext.messages.map(m =>
                                        m.id === message.id ? {...m, copied: true} : m
                                      )
                                    };
                                    setActiveContext(updatedContext);
                                    setTimeout(() => {
                                      setActiveContext({
                                        ...updatedContext,
                                        messages: updatedContext.messages.map(m =>
                                          m.id === message.id ? {...m, copied: false} : m
                                        )
                                      });
                                    }, 2000);
                                  }
                                }}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-800/50 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-200 transition-opacity duration-200"
                                title="Copy message"
                              >
                                <ClipboardDocumentIcon className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-xs text-gray-500 mt-1 mx-2">
                              {format(message.timestamp, 'HH:mm')}
                            </span>
                          </div>
                          {message.sender === 'user' && (
                            <div className="flex-shrink-0 ml-3">
                              <UserCircleIcon className="w-6 h-6 text-blue-500" />
                            </div>
                          )}
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="flex-shrink-0 mr-3">
                            <CommandLineIcon className="w-6 h-6 text-blue-500" />
                          </div>
                          <div className="flex flex-col">
                            <div className="bg-gray-900/80 text-gray-200 rounded-lg px-4 py-3 shadow-lg border border-gray-700/50 mr-8">
                              <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 mt-1 mx-2">
                              {format(Date.now(), 'HH:mm')}
                            </span>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>

                {/* Visual Separator */}
                <div className="h-px bg-gray-700/50 mb-4"></div>

                {/* Input Area */}
                <div className="flex-none bg-gray-800/95 rounded-lg backdrop-blur-sm mx-4 mb-4 shadow-lg border border-gray-700/50">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) {
                      handleSubmit(input);
                    }
                  }} className="relative">
                    <div className="p-3">
                      <div className="relative">
                        <textarea
                          value={input}
                          onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 288) + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (input.trim()) {
                                handleSubmit(input);
                              }
                            }
                          }}
                          className="w-full bg-gray-900/80 text-white rounded-lg pl-4 pr-24 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto border border-gray-700/50"
                          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                          style={{
                            minHeight: '42px',
                            maxHeight: '288px',
                          }}
                          rows={1}
                        />
                        <div className="absolute right-5 top-2 -translate-y-1/1 flex items-center space-x-1">
                          <button
                            type="button"
                            className="p-1 text-gray-400 hover:text-gray-300 bg-gray-900/80 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700/50"
                            title="Attach document"
                          >
                            <PaperClipIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="submit"
                            disabled={!input.trim()}
                            className="p-1 text-gray-400 hover:text-gray-300 bg-gray-900/80 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Send message"
                          >
                            <PaperAirplaneIcon className="w-4 h-4" />
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
              className="flex-none flex flex-col p-6"
              style={{ width: `${artifactWidth}px` }}
            >
              <div className="flex-1 flex flex-col bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl">
                {/* Artifact Header */}
                <div className="flex-none h-16 border-b border-gray-700 px-6 flex items-center bg-gray-800/95 rounded-t-lg">
                  <div>
                    <h2 className="text-xl font-bold text-white">{currentArtifact.name}</h2>
                    <p className="text-sm text-gray-400">{currentArtifact.description}</p>
                  </div>
                </div>

                {/* Artifact Content with Grid Layout */}
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Balance Display */}
                  <div className="bg-gray-900/80 rounded-lg p-6 shadow-lg border border-gray-700/50 mb-6">
                    <h3 className="text-lg font-medium text-gray-300 mb-2">Current Balance</h3>
                    <div className="text-3xl font-bold text-white">{currentArtifact.balance}</div>
                  </div>

                  {/* Contract Functions Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {currentArtifact.functions.map((func, index) => (
                      <div 
                        key={index} 
                        className="bg-gray-900/80 rounded-lg p-4 hover:bg-gray-900/90 transition-colors duration-200 shadow-lg border border-gray-700/50"
                      >
                        <h4 className="text-lg font-medium text-white mb-2">{func.name}</h4>
                        <p className="text-gray-400 text-sm mb-4">{func.description}</p>
                        
                        {/* Function Inputs */}
                        {func.inputs.length > 0 && (
                          <div className="mb-4 space-y-3">
                            {func.inputs.map((input, idx) => (
                              <div key={idx} className="flex flex-col">
                                <label className="text-sm text-gray-400 mb-1">
                                  {input.name} ({input.type})
                                </label>
                                <input
                                  type="text"
                                  className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={input.description}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <button
                          onClick={() => handleFunctionCall(func)}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Execute
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resize Handle */}
              <div className="h-6 flex items-center justify-center cursor-ns-resize group">
                <div className="w-32 h-1 bg-gray-700 rounded-full group-hover:bg-red-500 transition-colors duration-200"></div>
              </div>

              {/* Console Area with ResizableBox */}
              <ResizableBox
                width={Infinity}
                height={192}
                axis="y"
                resizeHandles={['n']}
                minConstraints={[Infinity, 100]}
                maxConstraints={[Infinity, 500]}
                handle={
                  <div className="h-6 flex items-center justify-center cursor-ns-resize group absolute top-0 left-0 right-0">
                    <div className="w-32 h-1 bg-gray-700 rounded-full group-hover:bg-red-500 transition-colors duration-200"></div>
                  </div>
                }
              >
                <div className="h-full bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl overflow-hidden flex flex-col">
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
                      <div className="text-red-400">Error: Compilation failed - Invalid syntax at line 42</div>
                      <div className="text-yellow-400">Warning: Unused variable 'amount' in transfer function</div>
                      <div className="text-green-400">Success: Contract deployed at 0x123...</div>
                      <div className="text-blue-400">Info: Compiling contract...</div>
                    </div>
                  </div>
                </div>
              </ResizableBox>
            </div>
          )}

          {/* Overlay to prevent interaction while resizing */}
          {isResizing && (
            <div className="fixed inset-0 bg-transparent z-50 cursor-col-resize" />
          )}
        </div>
      </div>
    </div>
  );
};

export default AssistedChat; 