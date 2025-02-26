const { createClient } = require('@libsql/client');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  static instance;
  client;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('Missing Turso database credentials');
    }

    this.client = createClient({
      url,
      authToken,
    });
  }

  static getInstance() {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  validateString(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return value.trim();
  }

  // Users
  async createUser(walletAddress) {
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

  async getUser(walletAddress) {
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

  // Conversations
  async createConversation(walletAddress, name) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const validatedName = this.validateString(name, 'name');

      await this.createUser(validatedAddress);

      const existingConversation = await this.client.execute({
        sql: `SELECT id FROM conversations WHERE user_wallet = ? AND name = ?`,
        args: [validatedAddress, validatedName]
      });

      if (existingConversation.rows.length > 0) {
        return { id: existingConversation.rows[0].id };
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

  async getConversations(walletAddress) {
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

  // Messages
  async saveMessage(conversationId, content, sender, metadata) {
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

  async getMessages(conversationId) {
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

  // Code History
  async saveCodeHistory(conversationId, code, language = 'solidity', version, metadata) {
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

  async getCodeHistory(conversationId) {
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

  // Contracts
  async saveDeployedContract(contractData) {
    try {
      let validatedAbi;
      try {
        if (typeof contractData.abi === 'string') {
          JSON.parse(contractData.abi);
          validatedAbi = contractData.abi;
        } else {
          validatedAbi = JSON.stringify(contractData.abi);
        }
      } catch (error) {
        console.error('[DatabaseService] Error validating ABI:', error);
        throw new Error('Invalid ABI format');
      }

      const walletAddress = this.validateString(contractData.walletAddress, 'walletAddress');
      let conversationId = this.validateString(contractData.conversationId, 'conversationId');
      const contractAddress = this.validateString(contractData.contractAddress, 'contractAddress');
      const name = this.validateString(contractData.name, 'name');
      const bytecode = this.validateString(contractData.bytecode, 'bytecode');
      const sourceCode = this.validateString(contractData.sourceCode, 'sourceCode');
      const id = uuidv4();

      await this.createUser(walletAddress);

      const conversationExists = await this.client.execute({
        sql: `SELECT id FROM conversations WHERE id = ?`,
        args: [conversationId]
      });

      if (conversationExists.rows.length === 0) {
        const newConversation = await this.createConversation(walletAddress, "Contract Deployment Chat");
        conversationId = newConversation.id;
      }

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
          validatedAbi,
          bytecode,
          sourceCode,
          contractData.compilerVersion || null,
          contractData.constructorArgs ? JSON.stringify(contractData.constructorArgs) : null,
          contractData.networkId || 57054
        ]
      });
    } catch (error) {
      console.error('[DatabaseService] Error saving deployed contract:', error);
      throw error;
    }
  }

  async getDeployedContracts(walletAddress) {
    try {
      const validatedAddress = this.validateString(walletAddress, 'walletAddress');
      const result = await this.client.execute({
        sql: `
          SELECT * FROM deployed_contracts 
          WHERE user_wallet = ?
          ORDER BY deployed_at DESC
        `,
        args: [validatedAddress]
      });

      return result.rows.map(contract => ({
        ...contract,
        sourceCode: this.parseSourceCode(contract.source_code),
        abi: contract.abi ? JSON.parse(contract.abi) : null,
        constructorArgs: contract.constructor_args ? JSON.parse(contract.constructor_args) : null,
        networkId: contract.network_id ? contract.network_id.toString() : null
      }));
    } catch (error) {
      console.error('[DatabaseService] Error getting deployed contracts:', error);
      throw error;
    }
  }

  async getContractsByConversation(conversationId) {
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

      return result.rows.map(contract => ({
        ...contract,
        sourceCode: this.parseSourceCode(contract.source_code),
        abi: contract.abi ? JSON.parse(contract.abi) : null,
        constructorArgs: contract.constructor_args ? JSON.parse(contract.constructor_args) : null,
        networkId: contract.network_id ? contract.network_id.toString() : null
      }));
    } catch (error) {
      console.error('[DatabaseService] Error getting contracts by conversation:', error);
      throw error;
    }
  }

  parseSourceCode(sourceCode) {
    try {
      return JSON.parse(sourceCode);
    } catch (error) {
      return sourceCode;
    }
  }
}

module.exports = DatabaseService; 