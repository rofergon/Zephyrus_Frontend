import { ChatInfo } from './chatService';

export interface ContractInfo {
  id: string;
  name: string;
  contract_address: string;
  tx_hash: string;
  abi: any;
  bytecode: string;
  source_code: string;
  deployed_at: string;
  conversation_id?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  content: string;
  sender: 'user' | 'ai';
  metadata?: Record<string, any>;
  created_at: string;
}

export class ApiService {
  private static instance: ApiService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://3ea5d3427422.ngrok.app';
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // Usuarios
  public async createUser(walletAddress: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walletAddress })
      });
      
      if (!response.ok) {
        throw new Error(`Error creating user: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[ApiService] Error creating user:', error);
      throw error;
    }
  }

  public async getUser(walletAddress: string): Promise<{ wallet_address: string; created_at: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/users/${walletAddress}`);
      if (!response.ok) {
        throw new Error(`Error fetching user: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ApiService] Error fetching user:', error);
      throw error;
    }
  }

  // Conversaciones
  /**
   * Crea una nueva conversación
   */
  public async createConversation(walletAddress: string, name: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress,
          name
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        id: data.id,
        name,
        wallet_address: walletAddress,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString()
      };
    } catch (error) {
      console.error('[ApiService] Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las conversaciones de un usuario
   */
  public async getConversations(walletAddress: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/conversations/${walletAddress}`);

      if (!response.ok) {
        throw new Error(`Failed to get conversations: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ApiService] Error getting conversations:', error);
      throw error;
    }
  }

  public async updateConversationName(conversationId: string, name: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/conversations/${conversationId}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) {
        throw new Error(`Error updating conversation name: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[ApiService] Error updating conversation name:', error);
      throw error;
    }
  }

  // Mensajes
  /**
   * Crea un nuevo mensaje en una conversación
   */
  public async createMessage(conversationId: string, content: string, sender: 'user' | 'ai', metadata?: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          content,
          sender,
          metadata
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create message: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        ...data
      };
    } catch (error) {
      console.error('[ApiService] Error creating message:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los mensajes de una conversación
   */
  public async getMessages(conversationId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/messages/${conversationId}`);

      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ApiService] Error getting messages:', error);
      throw error;
    }
  }

  // Contratos (mantener la funcionalidad existente)
  public async getContracts(walletAddress: string): Promise<ContractInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/contracts/${walletAddress}`);
      if (!response.ok) {
        throw new Error(`Error fetching contracts: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ApiService] Error fetching contracts:', error);
      throw error;
    }
  }

  public async getContract(contractId: string): Promise<ContractInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/contract/${contractId}`);
      if (!response.ok) {
        throw new Error(`Error fetching contract: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ApiService] Error fetching contract:', error);
      throw error;
    }
  }
}

export const apiService = ApiService.getInstance(); 