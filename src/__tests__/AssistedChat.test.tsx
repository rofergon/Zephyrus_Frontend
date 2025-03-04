import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn()
}));

// Mock components that depend on monaco-editor
vi.mock('../components/contract/ContractViewer', () => ({
  default: () => <div data-testid="mock-contract-viewer">Mock Contract Viewer</div>
}));

// Mock the ChatService
vi.mock('../services/chatService', () => ({
  ChatService: vi.fn().mockImplementation(() => ({
    onMessage: vi.fn().mockImplementation(cb => {
      // Store the callback for later use if needed
      return cb;
    }),
    onConnectionChange: vi.fn().mockImplementation(cb => {
      // Store the callback for later use if needed
      return cb;
    }),
    onChatsLoaded: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    createNewChat: vi.fn(),
    switchChat: vi.fn(),
    getCurrentChatId: vi.fn().mockReturnValue('mock-chat-id'),
    setCurrentChatId: vi.fn()
  }))
}));

// Mock the ChatContextService
vi.mock('../services/chatContextService', () => ({
  ChatContextService: vi.fn().mockImplementation(() => ({
    initializeConversation: vi.fn(),
    createNewChat: vi.fn(),
    handleContextSwitch: vi.fn(),
    handleContextDelete: vi.fn(),
    addMessageToContext: vi.fn()
  }))
}));

// Mock the resizable component
vi.mock('react-resizable', () => ({
  ResizableBox: ({ children }) => <div data-testid="resizable-box">{children}</div>
}));

// Mock other components that might cause issues
vi.mock('../components/FileExplorer', () => ({
  default: () => <div data-testid="mock-file-explorer">Mock File Explorer</div>
}));

vi.mock('../components/chat/ChatContexts', () => ({
  default: ({ onCreateNewChat }) => (
    <div data-testid="mock-chat-contexts">
      <button data-testid="new-chat-btn" onClick={onCreateNewChat}>New Chat</button>
    </div>
  )
}));

vi.mock('../components/chat/ChatArea', () => ({
  default: ({ onSubmit }) => (
    <div data-testid="mock-chat-area">
      <button data-testid="send-btn" onClick={() => onSubmit('Test message')}>Send</button>
    </div>
  )
}));

vi.mock('../components/chat/WorkspaceManager', () => ({
  default: () => <div data-testid="mock-workspace-manager">Mock Workspace Manager</div>
}));

// Mock services
vi.mock('../services/databaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn().mockReturnValue({})
  }
}));

vi.mock('../services/compilationService', () => ({
  CompilationService: {
    getInstance: vi.fn().mockReturnValue({})
  }
}));

vi.mock('../services/conversationService', () => ({
  conversationService: {},
  Message: class Message {
    constructor(public content: string, public isUser: boolean) {}
  }
}));

vi.mock('../services/virtual-fs', () => ({
  virtualFS: {}
}));

// Import the component under test after all mocks are set up
import AssistedChat from '../pages/AssistedChat';
// Import the mocked modules to access their mock functions
import { useAccount } from 'wagmi';
import { ChatContextService } from '../services/chatContextService';

// Basic smoke tests for the AssistedChat component
describe('AssistedChat Component - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock implementation for useAccount
    (useAccount as any).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true
    });
    
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    
    // Mock ResizeObserver
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders when user is connected', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AssistedChat />
        </MemoryRouter>
      );
    });

    expect(screen.getByText(/Zephyrus Agent/i)).toBeInTheDocument();
  });

  it('shows wallet connection message when user is not connected', async () => {
    // Override the mock for this test
    (useAccount as any).mockReturnValueOnce({
      address: undefined,
      isConnected: false
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AssistedChat />
        </MemoryRouter>
      );
    });

    expect(screen.getByText(/Wallet Connection Required/i)).toBeInTheDocument();
  });

  it('allows creating a new chat', async () => {
    const mockCreateNewChat = vi.fn();
    (ChatContextService as any).mockImplementation(() => ({
      initializeConversation: vi.fn(),
      createNewChat: mockCreateNewChat,
      handleContextSwitch: vi.fn(),
      handleContextDelete: vi.fn(),
      addMessageToContext: vi.fn()
    }));

    await act(async () => {
      render(
        <MemoryRouter>
          <AssistedChat />
        </MemoryRouter>
      );
    });

    const newChatButton = screen.getByTestId('new-chat-btn');
    
    await act(async () => {
      fireEvent.click(newChatButton);
    });

    expect(mockCreateNewChat).toHaveBeenCalled();
  });

  it('allows sending a message', async () => {
    const mockAddMessageToContext = vi.fn();
    (ChatContextService as any).mockImplementation(() => ({
      initializeConversation: vi.fn(),
      createNewChat: vi.fn(),
      handleContextSwitch: vi.fn(),
      handleContextDelete: vi.fn(),
      addMessageToContext: mockAddMessageToContext
    }));

    await act(async () => {
      render(
        <MemoryRouter>
          <AssistedChat />
        </MemoryRouter>
      );
    });

    const sendButton = screen.getByTestId('send-btn');
    
    await act(async () => {
      fireEvent.click(sendButton);
    });

    expect(mockAddMessageToContext).toHaveBeenCalled();
  });
}); 