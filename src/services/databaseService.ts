import { DeployedContract } from '../types/contracts';

export class DatabaseService {
  private static instance: DatabaseService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = 'https://8cd8-2800-e2-5e80-815-b1f6-4695-930e-b791.ngrok-free.app/api/db';
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private validateString(value: any, fieldName: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return value.trim();
  }

  private async handleResponse(response: Response): Promise<any> {
    try {
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Request failed with status ${response.status} ${response.statusText}`;
        
        try {
          // Try to parse as JSON first
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If not JSON, use the text (but limit length)
          errorMessage += `: ${errorText.substring(0, 100)}...`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got ${contentType}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`[DatabaseService] Error handling response:`, error);
      throw error;
    }
  }

  // Usuarios
  async createUser(walletAddress: string) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const response = await fetch(`${this.baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: validatedAddress })
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error creating user:', error);
      throw error;
    }
  }

  async getUser(walletAddress: string) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const response = await fetch(`${this.baseUrl}/users/${validatedAddress}`);
      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error getting user:', error);
      throw error;
    }
  }

  // Conversaciones
  async createConversation(walletAddress: string, name: string): Promise<{ id: string }> {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const validatedName = this.validateString(name, 'name');

      const response = await fetch(`${this.baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: validatedAddress,
          name: validatedName
        })
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error creating conversation:', error);
      throw error;
    }
  }

  async getConversations(walletAddress: string) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const response = await fetch(`${this.baseUrl}/conversations/${validatedAddress}`);
      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error getting conversations:', error);
      throw error;
    }
  }

  // Mensajes
  async saveMessage(conversationId: string, content: string, sender: 'user' | 'ai', metadata?: any) {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const validatedContent = this.validateString(content, 'content');
      
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: validatedId,
          content: validatedContent,
          sender,
          metadata
        })
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error saving message:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string) {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const response = await fetch(`${this.baseUrl}/messages/${validatedId}`);
      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error getting messages:', error);
      throw error;
    }
  }

  // Historial de código
  async saveCodeHistory(conversationId: string, code: string, language: string = 'solidity', version?: string, metadata?: any) {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const validatedCode = this.validateString(code, 'code');
      
      const response = await fetch(`${this.baseUrl}/code-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: validatedId,
          code: validatedCode,
          language,
          version,
          metadata
        })
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error saving code history:', error);
      throw error;
    }
  }

  async getCodeHistory(conversationId: string) {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const response = await fetch(`${this.baseUrl}/code-history/${validatedId}`);
      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error getting code history:', error);
      throw error;
    }
  }

  // Contratos
  public async saveDeployedContract(contractData: {
    walletAddress: string;
    conversationId: string;
    contractAddress: string;
    name: string;
    abi: string | any[];
    bytecode: string;
    sourceCode: string;
    compilerVersion?: string;
    constructorArgs?: any[];
    networkId?: number;
  }): Promise<void> {
    try {
      // Validate and parse ABI before saving
      let validatedAbi: string;
      try {
        validatedAbi = typeof contractData.abi === 'string' 
          ? contractData.abi 
          : JSON.stringify(contractData.abi);
      } catch (error) {
        console.error('[DatabaseService] Error validating ABI:', error);
        throw new Error('Invalid ABI format');
      }

      const response = await fetch(`${this.baseUrl}/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: this.validateString(contractData.walletAddress, 'walletAddress'),
          conversationId: this.validateString(contractData.conversationId, 'conversationId'),
          contractAddress: this.validateString(contractData.contractAddress, 'contractAddress'),
          name: this.validateString(contractData.name, 'name'),
          abi: validatedAbi,
          bytecode: this.validateString(contractData.bytecode, 'bytecode'),
          sourceCode: this.validateString(contractData.sourceCode, 'sourceCode'),
          compilerVersion: contractData.compilerVersion,
          constructorArgs: contractData.constructorArgs,
          networkId: contractData.networkId || 57054
        })
      });

      await this.handleResponse(response);
      console.log('[DatabaseService] Contract saved successfully');
    } catch (error) {
      console.error('[DatabaseService] Error saving deployed contract:', error);
      throw error;
    }
  }

  async getDeployedContracts(walletAddress: string): Promise<DeployedContract[]> {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      console.log(`[DatabaseService] Fetching contracts for wallet: ${validatedAddress}`);
      
      const response = await fetch(`${this.baseUrl}/contracts/${validatedAddress}`);
      
      // Check if response is OK
      if (!response.ok) {
        console.error(`[DatabaseService] Error fetching contracts: ${response.status} ${response.statusText}`);
        return []; // Return empty array instead of throwing an error
      }
      
      // Check content type to ensure we're getting JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`[DatabaseService] Expected JSON but got ${contentType}`);
        // Try to get the response text for debugging
        const text = await response.text();
        console.error(`[DatabaseService] Non-JSON response: ${text.substring(0, 200)}...`);
        return []; // Return empty array
      }
      
      const contracts = await this.handleResponse(response);

      return contracts.map((contract: any) => ({
        ...contract,
        sourceCode: contract.source_code ? this.parseSourceCode(contract.source_code) : null,
        abi: this.parseAbi(contract.abi),
        constructorArgs: contract.constructor_args ? JSON.parse(contract.constructor_args) : null,
        networkId: contract.network_id ? contract.network_id.toString() : null
      }));
    } catch (error) {
      console.error('[DatabaseService] Error getting deployed contracts:', error);
      // Return empty array instead of throwing the error
      return [];
    }
  }

  async getContractsByConversation(conversationId: string): Promise<DeployedContract[]> {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const response = await fetch(`${this.baseUrl}/contracts/conversation/${validatedId}`);
      const contracts = await this.handleResponse(response);

      return contracts.map((contract: any) => ({
        ...contract,
        sourceCode: contract.source_code ? this.parseSourceCode(contract.source_code) : null,
        abi: this.parseAbi(contract.abi),
        constructorArgs: contract.constructor_args ? JSON.parse(contract.constructor_args) : null,
        networkId: contract.network_id ? contract.network_id.toString() : null
      }));
    } catch (error) {
      console.error('[DatabaseService] Error getting contracts by conversation:', error);
      throw error;
    }
  }

  private parseSourceCode(sourceCode: string): { 
    content: string;
    language: string;
    version: string;
    timestamp: string;
    format: string;
    encoding: string;
  } | string {
    try {
      return JSON.parse(sourceCode);
    } catch {
      return sourceCode;
    }
  }

  private parseAbi(abi: any): any {
    try {
      if (!abi) return null;
      return typeof abi === 'string' ? JSON.parse(abi) : abi;
    } catch (error) {
      console.error('[DatabaseService] Error parsing ABI:', error);
      return null;
    }
  }
} 