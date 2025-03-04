import { DeployedContract } from '../types/contracts';

export class DatabaseService {
  private static instance: DatabaseService;
  private baseUrl: string;
  private currentWalletAddress: string | null = null;

  private constructor() {
    // Use environment variable for API URL with fallback
    this.baseUrl = `${(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/db`;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Método para establecer la dirección de wallet actual
  public setCurrentWalletAddress(address: string | null): void {
    this.currentWalletAddress = address;
    console.log(`[DatabaseService] Current wallet address set to: ${address}`);
  }

  private validateString(value: any, fieldName: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return value.trim();
  }

  // New helper method to preserve wallet address case
  private normalizeWalletAddress(address: string): string {
    // We should preserve the original case format for wallet addresses
    // as some APIs and services might be case-sensitive
    // Just ensure it's properly trimmed and valid
    const trimmed = address.trim();
    
    // Basic validation that it's an Ethereum address
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      console.warn('[DatabaseService] Invalid wallet address format:', trimmed);
    }
    
    return trimmed;
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
      const validatedAddress = this.normalizeWalletAddress(walletAddress);
      const response = await fetch(`${this.baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
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
      const validatedAddress = this.normalizeWalletAddress(walletAddress);
      const response = await fetch(`${this.baseUrl}/users/${validatedAddress}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('[DatabaseService] Error getting user:', error);
      throw error;
    }
  }

  // Conversaciones
  async createConversation(walletAddress: string, name: string): Promise<{ id: string }> {
    try {
      const validatedAddress = this.normalizeWalletAddress(walletAddress);
      const validatedName = this.validateString(name, 'name');

      const response = await fetch(`${this.baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
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
      const validatedAddress = this.normalizeWalletAddress(walletAddress);
      const response = await fetch(`${this.baseUrl}/conversations/${validatedAddress}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
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
          'ngrok-skip-browser-warning': 'true'
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
      const response = await fetch(`${this.baseUrl}/messages/${validatedId}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
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
          'ngrok-skip-browser-warning': 'true'
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
      const response = await fetch(`${this.baseUrl}/code-history/${validatedId}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
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
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          walletAddress: this.normalizeWalletAddress(contractData.walletAddress),
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
      const validatedAddress = this.normalizeWalletAddress(walletAddress);
      console.log(`[DatabaseService] Fetching deployed contracts for wallet: ${validatedAddress}`);
      
      const url = `${this.baseUrl}/contracts/${validatedAddress}`;
      console.log(`[DatabaseService] API URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) {
        console.error(`[DatabaseService] API response not OK: ${response.status} ${response.statusText}`);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`[DatabaseService] Unexpected content type: ${contentType}`);
        const text = await response.text();
        console.log(`[DatabaseService] Response text (first 200 chars): ${text.substring(0, 200)}`);
        throw new Error(`Expected JSON response but got ${contentType}`);
      }
      
      const data = await response.json();
      
      // Enhanced logging for empty API responses to help with debugging
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn(`[DatabaseService] API returned empty result for address: ${validatedAddress}`);
        console.log(`[DatabaseService] Original wallet address: ${walletAddress}`);
        console.log(`[DatabaseService] Normalized wallet address: ${validatedAddress}`);
        console.log(`[DatabaseService] Request URL: ${url}`);
        console.log(`[DatabaseService] Response headers:`, Object.fromEntries([...response.headers.entries()]));
      } else {
        console.log(`[DatabaseService] API returned ${Array.isArray(data) ? data.length : 'non-array'} results`);
      }
      
      console.log(`[DatabaseService] Complete API response:`, data);
      
      // Procesar la respuesta y transformar formatos
      const contracts = Array.isArray(data) ? data : [];
      return contracts.map(contract => {
        // Procesar timestamp: convertir de string "YYYY-MM-DD HH:MM:SS" a timestamp numérico
        let timestamp = Date.now(); // Valor por defecto
        
        if (contract.deployed_at) {
          console.log(`[DatabaseService] Processing deployed_at timestamp:`, {
            original: contract.deployed_at,
            type: typeof contract.deployed_at
          });
          
          try {
            // Parse the date string to a Date object and then get timestamp
            const dateObj = new Date(contract.deployed_at);
            timestamp = dateObj.getTime();
            
            console.log(`[DatabaseService] Parsed timestamp for contract ${contract.contract_address}:`, {
              dateString: contract.deployed_at,
              dateObj: dateObj.toString(),
              timestamp
            });
          } catch (error) {
            console.error(`[DatabaseService] Error parsing date:`, error);
          }
        }
        
        // Solo registrar detalles del primer contrato para evitar sobrecarga de logs
        if (contracts.indexOf(contract) === 0) {
          console.log(`[DatabaseService] Transformed first contract:`, {
            address: contract.contract_address,
            timestamp,
            original_deployed_at: contract.deployed_at
          });
        }
        
        return {
          ...contract,
          deployedAt: timestamp, // Agregar campo numérico para facilitar el procesamiento
          sourceCode: this.parseSourceCode(contract.source_code),
          abi: contract.abi ? (typeof contract.abi === 'string' ? JSON.parse(contract.abi) : contract.abi) : null,
          constructorArgs: contract.constructor_args ? JSON.parse(contract.constructor_args) : null,
          networkId: contract.network_id ? contract.network_id.toString() : null
        };
      });
    } catch (error) {
      console.error('[DatabaseService] Error getting deployed contracts:', error);
      throw error;
    }
  }

  async getContractsByConversation(conversationId: string): Promise<DeployedContract[]> {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const response = await fetch(`${this.baseUrl}/contracts/conversation/${validatedId}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
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

  /**
   * Verifica si una conversación existe en la base de datos
   * @param conversationId ID de la conversación a verificar
   * @returns true si la conversación existe, false en caso contrario
   */
  public async checkConversationExists(conversationId: string): Promise<boolean> {
    try {
      if (!conversationId) {
        return false;
      }

      const validatedId = this.validateString(conversationId, 'conversationId');
      console.log(`[DatabaseService] Checking if conversation exists: ${validatedId}`);
      
      // Como no tenemos un endpoint específico, intentaremos obtener los mensajes de esta conversación
      const response = await fetch(`${this.baseUrl}/messages/${validatedId}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (response.status === 404 || response.status === 500) {
        console.log(`[DatabaseService] Conversation ${validatedId} does not exist (status: ${response.status})`);
        return false;
      }

      // Si llegamos aquí, la conversación existe
      console.log(`[DatabaseService] Conversation ${validatedId} exists`);
      return true;
    } catch (error) {
      console.error('[DatabaseService] Error checking conversation existence:', error);
      // En caso de error, asumimos que no existe para ser conservadores
      return false;
    }
  }

  /**
   * Actualiza el ID de conversación de un contrato en la base de datos
   * @param contractId ID del contrato a actualizar
   * @param conversationId Nuevo ID de conversación
   */
  public async updateContractConversationId(contractId: string, conversationId: string): Promise<void> {
    try {
      if (!contractId || !conversationId) {
        console.warn('[DatabaseService] Missing contractId or conversationId for update');
        return;
      }

      // Verificar primero si la conversación existe
      const conversationExists = await this.checkConversationExists(conversationId);
      if (!conversationExists) {
        console.warn(`[DatabaseService] Conversation ${conversationId} does not exist. Creating it first.`);
        
        // Si la conversación no existe y tenemos una wallet activa, intentar crearla
        if (this.currentWalletAddress) {
          try {
            await this.createConversation(this.currentWalletAddress, "Auto-created for contract");
            console.log(`[DatabaseService] Created conversation for contract: ${conversationId}`);
          } catch (createError) {
            console.error('[DatabaseService] Failed to create conversation:', createError);
            throw new Error(`Conversation ${conversationId} does not exist and could not be created`);
          }
        } else {
          throw new Error(`Conversation ${conversationId} does not exist and no wallet is available to create it`);
        }
      }

      console.log(`[DatabaseService] Updating contract ${contractId} with conversation ${conversationId}`);
      
      const url = `${this.baseUrl}/contracts/${contractId}/conversation`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ conversationId: conversationId })
      });

      if (!response.ok) {
        throw new Error(`Failed to update contract conversation: ${response.status} ${response.statusText}`);
      }

      console.log(`[DatabaseService] Successfully updated contract ${contractId} with conversation ${conversationId}`);
    } catch (error) {
      console.error('[DatabaseService] Error updating contract conversation ID:', error);
      throw error;
    }
  }
}

// Exportamos la clase solamente
export default DatabaseService; 