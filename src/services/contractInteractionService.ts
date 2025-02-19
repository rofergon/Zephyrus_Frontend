import { useWalletClient, usePublicClient } from 'wagmi';
import { encodeFunctionData } from 'viem';

interface ContractInteractionResult {
  success: boolean;
  data?: any;
  transactionHash?: string;
  error?: string;
}

export class ContractInteractionService {
  private static instance: ContractInteractionService;
  
  private constructor() {}

  public static getInstance(): ContractInteractionService {
    if (!ContractInteractionService.instance) {
      ContractInteractionService.instance = new ContractInteractionService();
    }
    return ContractInteractionService.instance;
  }

  async executeWrite(
    contractAddress: string,
    abi: any[],
    functionName: string,
    args: any[] = [],
    walletClient: any,
    publicClient: any
  ): Promise<ContractInteractionResult> {
    try {
      console.log(`[ContractInteractionService] Executing ${functionName} with args:`, args);

      // Preparar los argumentos
      const functionAbi = abi.find(item => 
        item.type === 'function' && 
        item.name === functionName
      );

      if (!functionAbi) {
        throw new Error(`Function ${functionName} not found in ABI`);
      }

      // Encode function data
      const data = encodeFunctionData({
        abi: [functionAbi],
        functionName,
        args,
      });

      // Estimate gas
      const gasEstimate = await publicClient.estimateGas({
        account: walletClient.account,
        to: contractAddress as `0x${string}`,
        data,
      });

      console.log(`[ContractInteractionService] Gas estimate for ${functionName}:`, gasEstimate);

      // Execute transaction
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: [functionAbi],
        functionName,
        args,
        gas: BigInt(Math.floor(Number(gasEstimate) * 1.1)), // Add 10% buffer
      });

      console.log(`[ContractInteractionService] Transaction hash for ${functionName}:`, hash);

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log(`[ContractInteractionService] Transaction receipt for ${functionName}:`, receipt);

      return {
        success: true,
        transactionHash: hash,
        data: receipt
      };
    } catch (error) {
      console.error(`[ContractInteractionService] Error executing ${functionName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async executeRead(
    contractAddress: string,
    abi: any[],
    functionName: string,
    args: any[] = [],
    publicClient: any
  ): Promise<ContractInteractionResult> {
    try {
      console.log(`[ContractInteractionService] Reading ${functionName} with args:`, args);

      // Preparar los argumentos
      const functionAbi = abi.find(item => 
        item.type === 'function' && 
        item.name === functionName && 
        (item.stateMutability === 'view' || item.stateMutability === 'pure')
      );

      if (!functionAbi) {
        throw new Error(`View function ${functionName} not found in ABI`);
      }

      // Execute read
      const data = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: [functionAbi],
        functionName,
        args,
      });

      console.log(`[ContractInteractionService] Result from ${functionName}:`, data);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error(`[ContractInteractionService] Error reading ${functionName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Hook para facilitar el uso del servicio de interacción
export const useContractInteraction = (contractAddress: string, abi: any[]) => {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const interactionService = ContractInteractionService.getInstance();

  const executeWrite = async (functionName: string, args: any[] = []) => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }

    if (!contractAddress) {
      throw new Error('Contract address not provided');
    }

    // Validate function exists in ABI
    const functionAbi = abi.find(item => 
      item.type === 'function' && 
      item.name === functionName
    );

    if (!functionAbi) {
      throw new Error(`Function ${functionName} not found in ABI`);
    }

    return interactionService.executeWrite(
      contractAddress,
      abi,
      functionName,
      args,
      walletClient,
      publicClient
    );
  };

  const executeRead = async (functionName: string, args: any[] = []) => {
    if (!contractAddress) {
      throw new Error('Contract address not provided');
    }

    // Validate function exists in ABI
    const functionAbi = abi.find(item => 
      item.type === 'function' && 
      item.name === functionName && 
      (item.stateMutability === 'view' || item.stateMutability === 'pure')
    );

    if (!functionAbi) {
      throw new Error(`View function ${functionName} not found in ABI`);
    }

    return interactionService.executeRead(
      contractAddress,
      abi,
      functionName,
      args,
      publicClient
    );
  };

  return {
    executeWrite,
    executeRead,
  };
}; 