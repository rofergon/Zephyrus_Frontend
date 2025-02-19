import { createClient } from '@libsql/client';
import { v4 as uuidv4 } from 'uuid';
import { DeployedContract } from '../types/contracts';

export class DatabaseService {
  private static instance: DatabaseService;
  private client: ReturnType<typeof createClient>;

  private constructor() {
    const url = import.meta.env.VITE_TURSO_DATABASE_URL;
    const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('Missing Turso database credentials');
    }

    this.client = createClient({
      url,
      authToken,
    });
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

  // Usuarios
  async createUser(walletAddress: string) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      await this.client.execute({
        sql: `
          INSERT INTO users (wallet_address)
          VALUES (?)
          ON CONFLICT (wallet_address) DO NOTHING
        `,
        args: [validatedAddress]
      });
    } catch (error) {
      console.error('[DatabaseService] Error creating user:', error);
      throw error;
    }
  }

  async getUser(walletAddress: string) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const result = await this.client.execute({
        sql: `SELECT * FROM users WHERE wallet_address = ?`,
        args: [validatedAddress]
      });
      return result.rows[0];
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

      // Primero, asegurarse de que el usuario existe
      await this.createUser(validatedAddress);

      // Verificar si ya existe una conversación con este ID
      const existingConversation = await this.client.execute({
        sql: `SELECT id FROM conversations WHERE user_wallet = ? AND name = ?`,
        args: [validatedAddress, validatedName]
      });

      if (existingConversation.rows.length > 0) {
        return { id: existingConversation.rows[0].id as string };
      }

      const id = uuidv4();

      await this.client.execute({
        sql: `
          INSERT INTO conversations (id, user_wallet, name)
          VALUES (?, ?, ?)
        `,
        args: [id, validatedAddress, validatedName]
      });
      
      return { id };
    } catch (error) {
      console.error('[DatabaseService] Error creating conversation:', error);
      throw error;
    }
  }

  async getConversations(walletAddress: string) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const result = await this.client.execute({
        sql: `
          SELECT * FROM conversations 
          WHERE user_wallet = ?
          ORDER BY created_at DESC
        `,
        args: [validatedAddress]
      });
      return result.rows;
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
      const validatedSender = sender === 'user' || sender === 'ai' ? sender : 'ai';
      const id = uuidv4();
      
      await this.client.execute({
        sql: `
          INSERT INTO messages (id, conversation_id, content, sender, metadata)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [id, validatedId, validatedContent, validatedSender, metadata ? JSON.stringify(metadata) : null]
      });

      // Actualizar last_accessed de la conversación
      await this.client.execute({
        sql: `
          UPDATE conversations
          SET last_accessed = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [validatedId]
      });
    } catch (error) {
      console.error('[DatabaseService] Error saving message:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string) {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const result = await this.client.execute({
        sql: `
          SELECT * FROM messages 
          WHERE conversation_id = ?
          ORDER BY created_at ASC
        `,
        args: [validatedId]
      });
      return result.rows;
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
      const validatedLanguage = this.validateString(language, 'language');
      const id = uuidv4();
      
      await this.client.execute({
        sql: `
          INSERT INTO code_history (
            id,
            conversation_id,
            code_content,
            language,
            version,
            metadata
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          id,
          validatedId,
          validatedCode,
          validatedLanguage,
          version || null,
          metadata ? JSON.stringify(metadata) : null
        ]
      });
    } catch (error) {
      console.error('[DatabaseService] Error saving code history:', error);
      throw error;
    }
  }

  async getCodeHistory(conversationId: string) {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const result = await this.client.execute({
        sql: `
          SELECT * FROM code_history 
          WHERE conversation_id = ?
          ORDER BY created_at DESC
        `,
        args: [validatedId]
      });
      return result.rows;
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
    abi: string;
    bytecode: string;
    sourceCode: string;
    compilerVersion?: string;
    constructorArgs?: any[];
    networkId?: number;
  }): Promise<void> {
    try {
      // Safe logging that handles undefined values
      console.log('[DatabaseService] Saving contract with data:', {
        walletAddress: contractData.walletAddress,
        conversationId: contractData.conversationId,
        contractAddress: contractData.contractAddress,
        name: contractData.name,
        abi: contractData.abi ? `[${contractData.abi.length} chars]` : 'undefined',
        bytecode: contractData.bytecode ? `${contractData.bytecode.slice(0, 20)}...` : 'undefined',
        sourceCode: contractData.sourceCode ? `${contractData.sourceCode.slice(0, 100)}...` : 'undefined'
      });

      // Validate all required fields
      const walletAddress = this.validateString(contractData.walletAddress, 'walletAddress');
      let conversationId = this.validateString(contractData.conversationId, 'conversationId');
      const contractAddress = this.validateString(contractData.contractAddress, 'contractAddress');
      const name = this.validateString(contractData.name, 'name');
      const abi = this.validateString(contractData.abi, 'abi');
      const bytecode = this.validateString(contractData.bytecode, 'bytecode');
      const sourceCode = this.validateString(contractData.sourceCode, 'sourceCode');
      const id = uuidv4();

      // First, ensure the user exists
      await this.createUser(walletAddress);

      // Then, ensure the conversation exists
      const conversationExists = await this.client.execute({
        sql: `SELECT id FROM conversations WHERE id = ?`,
        args: [conversationId]
      });

      if (conversationExists.rows.length === 0) {
        // Create a new conversation if it doesn't exist
        const newConversation = await this.createConversation(walletAddress, "Contract Deployment Chat");
        conversationId = newConversation.id;
        console.log('[DatabaseService] Created new conversation:', conversationId);
      }

      // Save the code history
      await this.saveCodeHistory(
        conversationId,
        sourceCode,
        'solidity',
        contractData.compilerVersion,
        { contractAddress, deploymentType: 'contract' }
      );

      const query = `
        INSERT INTO deployed_contracts (
          id,
          user_wallet,
          conversation_id,
          contract_address,
          name,
          abi,
          bytecode,
          source_code,
          compiler_version,
          constructor_args,
          network_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.client.execute({
        sql: query,
        args: [
          id,
          walletAddress,
          conversationId,
          contractAddress,
          name,
          abi,
          bytecode,
          sourceCode,
          contractData.compilerVersion || null,
          contractData.constructorArgs ? JSON.stringify(contractData.constructorArgs) : null,
          contractData.networkId || 57054
        ]
      });

      console.log('[DatabaseService] Contract saved successfully');
    } catch (error) {
      console.error('[DatabaseService] Error saving deployed contract:', error);
      throw error;
    }
  }

  async getDeployedContracts(walletAddress: string): Promise<DeployedContract[]> {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const result = await this.client.execute({
        sql: `
          SELECT * FROM deployed_contracts 
          WHERE wallet_address = ?
          ORDER BY deployed_at DESC
        `,
        args: [validatedAddress]
      });

      // Parse source code JSON for each contract
      return result.rows.map(contract => ({
        ...contract,
        sourceCode: contract.source_code ? this.parseSourceCode(contract.source_code as string) : null,
        abi: contract.abi ? JSON.parse(contract.abi as string) : null,
        constructorArgs: contract.constructor_args ? JSON.parse(contract.constructor_args as string) : null,
        networkId: contract.network_id ? contract.network_id.toString() : null
      })) as unknown as DeployedContract[];
    } catch (error) {
      console.error('[DatabaseService] Error getting deployed contracts:', error);
      throw error;
    }
  }

  async getContractsByConversation(conversationId: string): Promise<DeployedContract[]> {
    try {
      const validatedId = this.validateString(conversationId, 'conversationId');
      const result = await this.client.execute({
        sql: `
          SELECT * FROM deployed_contracts 
          WHERE conversation_id = ?
          ORDER BY deployed_at DESC
        `,
        args: [validatedId]
      });

      // Parse source code JSON for each contract
      return result.rows.map(contract => ({
        ...contract,
        sourceCode: contract.source_code ? this.parseSourceCode(contract.source_code as string) : null,
        abi: contract.abi ? JSON.parse(contract.abi as string) : null,
        constructorArgs: contract.constructor_args ? JSON.parse(contract.constructor_args as string) : null,
        networkId: contract.network_id ? contract.network_id.toString() : null
      })) as unknown as DeployedContract[];
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
    } catch (error) {
      // Si no se puede parsear como JSON, devolver el string original
      return sourceCode;
    }
  }
} 