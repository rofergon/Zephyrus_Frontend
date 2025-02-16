import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import AssistedChat from '../pages/AssistedChat';
import { ChatService } from '../services/chatService';
import { conversationService } from '../services/conversationService';
import { virtualFS } from '../services/virtual-fs';

// Mock de los servicios
vi.mock('../services/chatService');
vi.mock('../services/conversationService');
vi.mock('../services/virtual-fs');
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    isConnected: true
  })
}));

describe('AssistedChat Component', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada prueba
    vi.clearAllMocks();
    
    // Mock de las funciones del servicio de chat
    ChatService.prototype.connect = vi.fn();
    ChatService.prototype.sendMessage = vi.fn();
    ChatService.prototype.onConnectionChange = vi.fn();
    ChatService.prototype.onMessage = vi.fn();
    
    // Mock de las funciones del servicio de conversación
    conversationService.getContexts = vi.fn().mockReturnValue([]);
    conversationService.getActiveContext = vi.fn().mockReturnValue(null);
    
    // Mock de virtualFS
    virtualFS.writeFile = vi.fn();
    virtualFS.readFile = vi.fn();
  });

  test('renders without crashing', () => {
    render(<AssistedChat />);
    expect(screen.getByText('Zephyrus Agent')).toBeInTheDocument();
  });

  test('shows wallet connection required message when not connected', () => {
    vi.mock('wagmi', () => ({
      useAccount: () => ({
        address: undefined,
        isConnected: false
      })
    }));

    render(<AssistedChat />);
    expect(screen.getByText('Wallet Connection Required')).toBeInTheDocument();
  });

  test('initializes chat service with wallet address', () => {
    render(<AssistedChat />);
    expect(ChatService.prototype.connect).toHaveBeenCalledWith('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  });

  test('handles message submission', async () => {
    render(<AssistedChat />);
    
    const input = screen.getByPlaceholderText(/Type your message/i);
    const message = 'Test message';
    
    fireEvent.change(input, { target: { value: message } });
    fireEvent.submit(input);
    
    expect(ChatService.prototype.sendMessage).toHaveBeenCalledWith(
      message,
      expect.any(Object)
    );
  });

  test('displays received messages', () => {
    let messageHandler: (response: any) => void;
    ChatService.prototype.onMessage = vi.fn((handler) => {
      messageHandler = handler;
    });

    render(<AssistedChat />);

    act(() => {
      messageHandler({
        type: 'message',
        content: 'Test response'
      });
    });

    expect(screen.getByText('Test response')).toBeInTheDocument();
  });

  test('handles code compilation', async () => {
    render(<AssistedChat />);
    
    // Simular cambio en el editor
    const code = 'contract Test {}';
    
    act(() => {
      // Trigger code change
      const editor = screen.getByTestId('monaco-editor');
      fireEvent.change(editor, { target: { value: code } });
    });
    
    // Verificar que se llamó a la compilación
    expect(virtualFS.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      code
    );
  });

  test('handles context switching', () => {
    const contexts = [
      {
        id: '1',
        name: 'Context 1',
        messages: [],
        active: false
      },
      {
        id: '2',
        name: 'Context 2',
        messages: [],
        active: true
      }
    ];

    conversationService.getContexts.mockReturnValue(contexts);

    render(<AssistedChat />);

    const contextButton = screen.getByText('Context 1');
    fireEvent.click(contextButton);

    expect(ChatService.prototype.switchChat).toHaveBeenCalledWith('1');
  });

  // Test de los componentes internos
  describe('FunctionCard Component', () => {
    const mockFunction = {
      name: 'transfer',
      description: 'Transfer tokens',
      type: 'function',
      stateMutability: 'payable',
      inputs: [
        {
          name: 'amount',
          type: 'uint256',
          description: 'Amount to transfer'
        }
      ]
    };

    test('renders function details correctly', () => {
      render(
        <FunctionCard func={mockFunction} />
      );

      expect(screen.getByText('transfer')).toBeInTheDocument();
      expect(screen.getByText('Transfer tokens')).toBeInTheDocument();
      expect(screen.getByText('payable')).toBeInTheDocument();
    });

    test('handles input changes', () => {
      render(
        <FunctionCard func={mockFunction} />
      );

      const input = screen.getByPlaceholderText(/Enter uint256 value/i);
      fireEvent.change(input, { target: { value: '100' } });

      expect(input.value).toBe('100');
    });
  });
}); 