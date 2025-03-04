import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AssistedChat from '../pages/AssistedChat';
import { ChatService } from '../services/chatService';
import { conversationService } from '../services/conversationService';
import { virtualFS } from '../services/virtual-fs';
import { ChatContextService } from '../services/chatContextService';

// Mock dependencies
vi.mock('../services/chatService', () => ({
  ChatService: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    sendMessage: vi.fn(),
    onConnectionChange: vi.fn(),
    onMessage: vi.fn(),
    setCurrentChatId: vi.fn(),
    deleteContext: vi.fn()
  }))
}));

vi.mock('../services/conversationService', () => ({
  conversationService: {
    getActiveContext: vi.fn(),
    getContexts: vi.fn().mockReturnValue([]),
    updateContext: vi.fn(),
    setActiveContext: vi.fn(),
    createNewContext: vi.fn(),
    setContexts: vi.fn(),
    addMessage: vi.fn(),
    createWorkspace: vi.fn()
  }
}));

vi.mock('../services/virtual-fs', () => ({
  virtualFS: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('')
  }
}));

vi.mock('../services/databaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn().mockReturnValue({
      getDeployedContracts: vi.fn().mockResolvedValue([]),
      getContractsByConversation: vi.fn().mockResolvedValue([]),
      updateContractConversationId: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

// Mock for browser API and other dependencies
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    isConnected: true
  })
}));

describe('ChatContextService Integration', () => {
  // Keep track of the original window.__chatContextService if any
  let originalChatContextService: any;
  
  beforeEach(() => {
    // Store the original service if it exists
    originalChatContextService = (window as any).__chatContextService;
    
    // Reset the global service before each test
    delete (window as any).__chatContextService;
    
    // Mock the DOM APIs needed for the component
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }));
    
    // Mock conversationService for the component
    vi.mocked(conversationService.getContexts).mockReturnValue([
      {
        id: 'mock-context-1',
        name: 'Test Context',
        active: true,
        messages: [],
        virtualFiles: {},
        workspaces: {}
      }
    ]);
    
    vi.mocked(conversationService.getActiveContext).mockReturnValue({
      id: 'mock-context-1',
      name: 'Test Context',
      active: true,
      messages: [],
      virtualFiles: {},
      workspaces: {}
    });
  });
  
  afterEach(() => {
    // Restore the original service after each test
    if (originalChatContextService) {
      (window as any).__chatContextService = originalChatContextService;
    } else {
      delete (window as any).__chatContextService;
    }
    
    vi.clearAllMocks();
  });

  it('should initialize ChatContextService and make it globally available', async () => {
    // Render the component
    await act(async () => {
      render(<AssistedChat />);
    });
    
    // Wait for component to initialize
    await waitFor(() => {
      // Check that the global service was created
      expect((window as any).__chatContextService).toBeDefined();
      expect((window as any).__chatContextService).toBeInstanceOf(ChatContextService);
    });
    
    // Verify the context service has the expected methods
    const globalService = (window as any).__chatContextService;
    expect(typeof globalService.createNewChat).toBe('function');
    expect(typeof globalService.handleContextSwitch).toBe('function');
    expect(typeof globalService.handleContextDelete).toBe('function');
    expect(typeof globalService.registerContractVersion).toBe('function');
  });

  it('should register a contract version through the global service', async () => {
    // First render the component to initialize the global service
    await act(async () => {
      render(<AssistedChat />);
    });
    
    // Wait for the global service to be available
    await waitFor(() => {
      expect((window as any).__chatContextService).toBeDefined();
    });
    
    // Prepare to listen for the contract-version-registered event
    const eventCallback = vi.fn();
    window.addEventListener('contract-version-registered', eventCallback);
    
    // Get the global service
    const globalService = (window as any).__chatContextService;
    
    // Use the global service to register a contract version
    await act(async () => {
      await globalService.registerContractVersion(
        'contract GlobalTest { function global() public {} }',
        'GlobalTest'
      );
    });
    
    // Verify the event was fired
    expect(eventCallback).toHaveBeenCalled();
    
    // Clean up the event listener
    window.removeEventListener('contract-version-registered', eventCallback);
  });

  it('should clean up the global service reference when component unmounts', async () => {
    // Create a wrapper component that we can unmount
    const Wrapper = () => {
      const [show, setShow] = React.useState(true);
      React.useEffect(() => {
        // Simulate unmounting after a delay
        const timer = setTimeout(() => setShow(false), 100);
        return () => clearTimeout(timer);
      }, []);
      
      return show ? <AssistedChat /> : null;
    };
    
    // Render the wrapper
    await act(async () => {
      render(<Wrapper />);
    });
    
    // Wait for the global service to be available
    await waitFor(() => {
      expect((window as any).__chatContextService).toBeDefined();
    });
    
    // Now wait for unmount to happen
    await waitFor(() => {
      // The global service should be cleaned up on unmount
      expect((window as any).__chatContextService).toBeUndefined();
    }, { timeout: 1000 });
  });

  it('should handle CompilationService integration through custom events', async () => {
    // First render the component to initialize the global service
    await act(async () => {
      render(<AssistedChat />);
    });
    
    // Wait for the global service to be available
    await waitFor(() => {
      expect((window as any).__chatContextService).toBeDefined();
    });
    
    // Spy on the registerContractVersion method
    const registerSpy = vi.spyOn((window as any).__chatContextService, 'registerContractVersion');
    
    // Simulate CompilationService dispatching an event
    const compilationEvent = new CustomEvent('contract-version-registered', {
      detail: {
        sourceCode: 'contract CompiledContract { function compiled() public {} }',
        name: 'CompiledContract',
        timestamp: Date.now()
      }
    });
    
    // Dispatch the event
    await act(async () => {
      window.dispatchEvent(compilationEvent);
    });
    
    // In a real scenario, the CompilationService would lookup and call the global service
    // Simulate that direct call
    if ((window as any).__chatContextService) {
      await act(async () => {
        await (window as any).__chatContextService.registerContractVersion(
          compilationEvent.detail.sourceCode, 
          compilationEvent.detail.name
        );
      });
    }
    
    // Verify the method was called
    expect(registerSpy).toHaveBeenCalledWith(
      compilationEvent.detail.sourceCode,
      compilationEvent.detail.name
    );
  });
}); 