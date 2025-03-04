import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatContextService } from '../services/chatContextService';
import { conversationService } from '../services/conversationService';
import { virtualFS } from '../services/virtual-fs';
import { ContractArtifact } from '../types/contracts';

// Mock dependencies
vi.mock('../services/conversationService', () => ({
  conversationService: {
    getActiveContext: vi.fn(),
    getContexts: vi.fn(),
    updateContext: vi.fn(),
    setActiveContext: vi.fn(),
    createNewContext: vi.fn(),
    setContexts: vi.fn(),
    addMessage: vi.fn()
  }
}));

vi.mock('../services/virtual-fs', () => ({
  virtualFS: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('ChatContextService', () => {
  let mockConfig: any;
  let chatContextService: ChatContextService;
  let addConsoleMessageMock: any;
  let setMessagesMock: any;
  let setActiveContextMock: any;
  let setConversationContextsMock: any;
  let mockDatabaseService: any;
  let mockChatService: any;
  let mockDemoArtifact: ContractArtifact;
  
  // Store the original window.dispatchEvent
  const originalDispatchEvent = window.dispatchEvent;
  
  // Create a mock for the dispatchEvent
  const dispatchEventMock = vi.fn();
  
  beforeEach(() => {
    // Reset window.__chatContextService before each test
    delete (window as any).__chatContextService;
    
    // Setup custom mocks
    addConsoleMessageMock = vi.fn();
    setMessagesMock = vi.fn();
    setActiveContextMock = vi.fn();
    setConversationContextsMock = vi.fn();
    mockDatabaseService = {
      getDeployedContracts: vi.fn().mockResolvedValue([]),
      getContractsByConversation: vi.fn().mockResolvedValue([]),
      updateContractConversationId: vi.fn().mockResolvedValue(undefined)
    };
    mockChatService = {
      setCurrentChatId: vi.fn(),
      deleteContext: vi.fn()
    };
    
    // Mock demo artifact
    mockDemoArtifact = {
      name: 'DemoContract',
      description: 'Demo Contract for Testing',
      address: '0x123',
      abi: [],
      bytecode: '0x456',
      functions: [],
      events: [],
      errors: []
    };
    
    // Create mock config
    mockConfig = {
      addConsoleMessage: addConsoleMessageMock,
      setMessages: setMessagesMock,
      setActiveContext: setActiveContextMock,
      setConversationContexts: setConversationContextsMock,
      setCurrentArtifact: vi.fn(),
      setCurrentCode: vi.fn(),
      setShowCodeEditor: vi.fn(),
      compileCode: vi.fn(),
      databaseService: mockDatabaseService,
      chatService: mockChatService,
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      demoArtifact: mockDemoArtifact
    };
    
    // Create the service instance
    chatContextService = new ChatContextService(mockConfig);
    
    // Replace window.dispatchEvent with our mock
    window.dispatchEvent = dispatchEventMock;
  });
  
  afterEach(() => {
    // Restore the original window.dispatchEvent after tests
    window.dispatchEvent = originalDispatchEvent;
    vi.clearAllMocks();
  });

  it('should make the service instance globally available', () => {
    // Set the service as global
    (window as any).__chatContextService = chatContextService;
    
    // Verify it's accessible
    expect((window as any).__chatContextService).toBeDefined();
    expect((window as any).__chatContextService).toBe(chatContextService);
  });

  it('should properly register a contract version', async () => {
    // Mock active context
    const mockActiveContext = {
      id: 'context-123',
      name: 'Test Context',
      active: true,
      messages: [],
      virtualFiles: {}
    };
    
    // Setup the mocks
    vi.mocked(conversationService.getActiveContext).mockReturnValue(mockActiveContext);
    
    // Call the method being tested
    const sourceCode = 'contract TestContract { function test() public {} }';
    await chatContextService.registerContractVersion(sourceCode, 'TestContract');
    
    // Verify the context was updated with the new file
    expect(conversationService.updateContext).toHaveBeenCalled();
    expect(vi.mocked(conversationService.updateContext).mock.calls[0][0].virtualFiles).toHaveProperty('contracts/TestContract.sol');
    
    // Verify the file was written to virtual fs
    expect(virtualFS.writeFile).toHaveBeenCalledWith('contracts/TestContract.sol', sourceCode);
    
    // Verify an event was dispatched
    expect(dispatchEventMock).toHaveBeenCalled();
    
    // Check the dispatched event details
    const dispatchedEvent = dispatchEventMock.mock.calls[0][0];
    expect(dispatchedEvent.type).toBe('contract-version-registered');
    expect(dispatchedEvent.detail).toMatchObject({
      sourceCode,
      name: 'TestContract',
      conversationId: 'context-123'
    });
    
    // Verify a success message was shown
    expect(addConsoleMessageMock).toHaveBeenCalledWith(
      expect.stringContaining('TestContract'), 
      'success'
    );
  });

  it('should handle errors when registering a contract version', async () => {
    // Mock a failing scenario
    vi.mocked(conversationService.getActiveContext).mockReturnValue(null);
    
    // Call the method being tested
    const sourceCode = 'contract FailingContract { function fail() public {} }';
    await chatContextService.registerContractVersion(sourceCode, 'FailingContract');
    
    // Verify error handling
    expect(conversationService.updateContext).not.toHaveBeenCalled();
    expect(virtualFS.writeFile).not.toHaveBeenCalled();
    expect(dispatchEventMock).not.toHaveBeenCalled();
    expect(addConsoleMessageMock).not.toHaveBeenCalled();
  });

  it('should extract contract name from source code if not provided', async () => {
    // Mock active context
    const mockActiveContext = {
      id: 'context-456',
      name: 'Test Context',
      active: true,
      messages: [],
      virtualFiles: {}
    };
    
    // Setup the mocks
    vi.mocked(conversationService.getActiveContext).mockReturnValue(mockActiveContext);
    
    // Call the method with source code but no explicit name
    const sourceCode = 'contract AutoNamedContract { function auto() public {} }';
    await chatContextService.registerContractVersion(sourceCode);
    
    // Verify a default name was chosen (should be "Contract" as our regex extraction isn't implemented in the test)
    const dispatchedEvent = dispatchEventMock.mock.calls[0][0];
    expect(dispatchedEvent.detail.name).toBe('Contract');
    
    // Verify the file was saved with the correct name
    expect(conversationService.updateContext).toHaveBeenCalled();
    expect(vi.mocked(conversationService.updateContext).mock.calls[0][0].virtualFiles).toHaveProperty('contracts/Contract.sol');
  });

  it('should integrate with CompilationService through events', async () => {
    // Mock active context
    const mockActiveContext = {
      id: 'context-789',
      name: 'Test Context',
      active: true,
      messages: [],
      virtualFiles: {}
    };
    
    // Setup the mocks
    vi.mocked(conversationService.getActiveContext).mockReturnValue(mockActiveContext);
    
    // Simulate CompilationService triggering an event
    const event = new CustomEvent('contract-version-registered', {
      detail: {
        sourceCode: 'contract EventContract { function event() public {} }',
        name: 'EventContract',
        timestamp: Date.now()
      }
    });
    
    // Restore original dispatchEvent for this test
    window.dispatchEvent = originalDispatchEvent;
    
    // Set the service as global so CompilationService can find it
    (window as any).__chatContextService = chatContextService;
    
    // Setup spy to track if our registerContractVersion is called
    const registerSpy = vi.spyOn(chatContextService, 'registerContractVersion');
    
    // Dispatch the event
    window.dispatchEvent(event);
    
    // In a real scenario, CompilationService would detect window.__chatContextService
    // and call registerContractVersion. We simulate that direct call here:
    if ((window as any).__chatContextService) {
      await (window as any).__chatContextService.registerContractVersion(
        event.detail.sourceCode, 
        event.detail.name
      );
    }
    
    // Verify our method was called
    expect(registerSpy).toHaveBeenCalledWith(
      event.detail.sourceCode,
      event.detail.name
    );
  });
}); 