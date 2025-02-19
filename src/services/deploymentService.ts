import { encodeDeployData } from 'viem';
import { useWalletClient, usePublicClient } from 'wagmi';
import { DatabaseService } from './databaseService';

interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  error?: string;
}

export class DeploymentService {
  private static instance: DeploymentService;
  private dbService: DatabaseService;
  
  private constructor() {
    this.dbService = DatabaseService.getInstance();
  }

  public static getInstance(): DeploymentService {
    if (!DeploymentService.instance) {
      DeploymentService.instance = new DeploymentService();
    }
    return DeploymentService.instance;
  }

  async deployContract(
    abi: any[],
    bytecode: string,
    constructorArgs: any[] = [],
    walletClient: any,
    publicClient: any,
    walletAddress: string,
    conversationId: string,
    contractName: string = 'Smart Contract',
    sourceCode: string = ''
  ): Promise<DeploymentResult> {
    try {
      console.log('[DeploymentService] Starting contract deployment...');
      
      // Validate conversation ID
      if (!conversationId) {
        throw new Error('Conversation ID is required for deployment');
      }

      // Ensure bytecode starts with 0x
      const formattedBytecode = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`;

      // Encode constructor data with arguments
      const encodedDeployData = encodeDeployData({
        abi,
        bytecode: formattedBytecode as `0x${string}`,
        args: constructorArgs,
      });

      console.log('[DeploymentService] Encoded deploy data:', {
        dataLength: encodedDeployData.length,
        constructorArgs,
      });

      // Estimate gas for deployment
      const gasEstimate = await publicClient.estimateGas({
        account: walletClient.account,
        data: encodedDeployData,
      });

      console.log('[DeploymentService] Gas estimate:', gasEstimate);

      // Add 10% buffer to gas estimate
      const gasLimit = BigInt(Math.floor(Number(gasEstimate) * 1.1));

      // Deploy contract
      const hash = await walletClient.deployContract({
        abi,
        bytecode: formattedBytecode as `0x${string}`,
        args: constructorArgs,
        gas: gasLimit,
      });

      console.log('[DeploymentService] Deployment transaction hash:', hash);

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('[DeploymentService] Deployment receipt:', receipt);

      if (!receipt.contractAddress) {
        throw new Error('Contract address not found in receipt');
      }

      // Prepare contract data for database
      const sourceCodeData = {
        content: sourceCode,
        language: 'solidity',
        version: '0.8.20',
        timestamp: new Date().toISOString(),
        format: 'text/plain',
        encoding: 'utf-8'
      };

      const contractData = {
        walletAddress,
        conversationId,
        contractAddress: receipt.contractAddress,
        name: contractName,
        abi: JSON.stringify(abi),
        bytecode: formattedBytecode,
        sourceCode: JSON.stringify(sourceCodeData),
        compilerVersion: '0.8.20',
        constructorArgs,
        networkId: await publicClient.getChainId()
      };

      try {
        // Primero intentar crear la conversación si no existe
        const { id: conversationId } = await this.dbService.createConversation(
          walletAddress,
          `Contract Deployment - ${contractName}`
        );

        // Actualizar el ID de conversación en los datos del contrato
        contractData.conversationId = conversationId;

        // Save the deployed contract in the database
        await this.dbService.saveDeployedContract(contractData);

        // Save deployment message in conversation
        await this.dbService.saveMessage(
          conversationId,
          `Contract deployed successfully at ${receipt.contractAddress}`,
          'ai',
          {
            type: 'deployment',
            contractAddress: receipt.contractAddress,
            transactionHash: hash
          }
        );
      } catch (error) {
        console.error('[DeploymentService] Error saving deployment data:', error);
        throw error;
      }

      return {
        success: true,
        contractAddress: receipt.contractAddress,
        transactionHash: hash,
      };

    } catch (error) {
      console.error('[DeploymentService] Deployment error:', error);
      throw error;
    }
  }
}

// Hook para facilitar el uso del servicio de despliegue
export const useDeployment = () => {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const deploymentService = DeploymentService.getInstance();

  const deployContract = async (
    abi: any[],
    bytecode: string,
    constructorArgs: any[] = [],
    conversationId: string,
    contractName: string,
    sourceCode: string = ''
  ) => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }

    // Validate constructor arguments
    const constructor = abi.find(item => item.type === 'constructor');
    if (constructor) {
      console.log('[useDeployment] Constructor found:', constructor);
      if (constructor.inputs.length !== constructorArgs.length) {
        throw new Error(`Expected ${constructor.inputs.length} constructor arguments, but got ${constructorArgs.length}`);
      }
    }

    return deploymentService.deployContract(
      abi,
      bytecode,
      constructorArgs,
      walletClient,
      publicClient,
      walletClient.account.address,
      conversationId,
      contractName,
      sourceCode
    );
  };

  return {
    deployContract,
  };
}; 