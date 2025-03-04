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
      console.log(`[ContractInteractionService] Executing write function "${functionName}" with args:`, args);
      console.log('[ContractInteractionService] Full ABI:', abi);

      // Validate and get function ABI
      const functionAbi = abi.find(item => 
        item.type === 'function' && 
        item.name === functionName
      );

      if (!functionAbi) {
        const availableFunctions = abi
          .filter(item => item.type === 'function')
          .map(item => item.name);
        
        console.error(`[ContractInteractionService] Function "${functionName}" not found in ABI. Available functions:`, availableFunctions);
        throw new Error(`Function "${functionName}" not found in contract ABI`);
      }

      console.log(`[ContractInteractionService] Found function "${functionName}" in ABI:`, functionAbi);

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

      console.log(`[ContractInteractionService] Gas estimate for "${functionName}":`, gasEstimate);

      // Execute transaction
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: [functionAbi],
        functionName,
        args,
        gas: BigInt(Math.floor(Number(gasEstimate) * 1.1)), // Add 10% buffer
      });

      console.log(`[ContractInteractionService] Transaction hash for "${functionName}":`, hash);

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log(`[ContractInteractionService] Transaction receipt for "${functionName}":`, receipt);

      return {
        success: true,
        transactionHash: hash,
        data: receipt
      };
    } catch (error) {
      console.error(`[ContractInteractionService] Error executing "${functionName}":`, error);
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
      console.log(`[ContractInteractionService] Executing read function "${functionName}" with args:`, args);
      console.log('[ContractInteractionService] Full ABI:', abi);

      // Validate and get function ABI
      const functionAbi = abi.find(item => 
        item.type === 'function' && 
        item.name === functionName && 
        (item.stateMutability === 'view' || item.stateMutability === 'pure')
      );

      if (!functionAbi) {
        const availableFunctions = abi
          .filter(item => 
            item.type === 'function' && 
            (item.stateMutability === 'view' || item.stateMutability === 'pure')
          )
          .map(item => item.name);
        
        console.error(`[ContractInteractionService] View function "${functionName}" not found in ABI. Available view functions:`, availableFunctions);
        throw new Error(`View function "${functionName}" not found in contract ABI`);
      }

      console.log(`[ContractInteractionService] Found view function "${functionName}" in ABI:`, functionAbi);

      try {
        // Configuraciones específicas para Sonic
        const sonicConfigs = [
          // Configuración básica
          {
            blockTag: 'latest',
            account: undefined
          },
          // Intentar con la dirección cero
          {
            blockTag: 'latest',
            account: '0x0000000000000000000000000000000000000000' as `0x${string}`
          },
          // Intentar sin blockTag
          {
            account: undefined
          },
          // Intentar con configuración mínima
          {}
        ];

        let lastError;
        for (const config of sonicConfigs) {
          try {
            console.log(`[ContractInteractionService] Trying Sonic read with config:`, config);
            
            const result = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: [functionAbi],
              functionName,
              args,
              ...config
            });

            console.log(`[ContractInteractionService] Sonic read successful for "${functionName}":`, result);

            // Para Sonic, necesitamos manejar algunos tipos de datos específicamente
            let processedResult = result;
            if (typeof result === 'bigint') {
              processedResult = result.toString();
            } else if (Array.isArray(result)) {
              processedResult = result.map(item => 
                typeof item === 'bigint' ? item.toString() : item
              );
            }

            return {
              success: true,
              data: processedResult
            };
          } catch (e) {
            lastError = e;
            console.log(`[ContractInteractionService] Sonic config attempt failed:`, e);
            
            // Si el error es específico de Sonic, intentar la siguiente configuración
            if (e instanceof Error && 
               (e.message.includes('execution reverted') || 
                e.message.includes('invalid parameters'))) {
              continue;
            }
            
            // Si es un error diferente, puede que necesitemos manejarlo de forma especial
            if (e instanceof Error && e.message.includes('network')) {
              console.log('[ContractInteractionService] Network specific error, trying alternative approach');
              continue;
            }
          }
        }

        // Si llegamos aquí, todos los intentos fallaron
        throw lastError || new Error('All Sonic read attempts failed');
      } catch (readError) {
        console.error(`[ContractInteractionService] All Sonic read attempts failed:`, readError);
        throw readError;
      }
    } catch (error) {
      console.error(`[ContractInteractionService] Error reading "${functionName}":`, error);
      
      // Mejorar el mensaje de error para el usuario
      let userFriendlyError = 'An error occurred while reading from the contract';
      if (error instanceof Error) {
        if (error.message.includes('execution reverted')) {
          userFriendlyError = `Unable to read "${functionName}". This might be due to contract restrictions or network conditions.`;
        } else if (error.message.includes('invalid parameters')) {
          userFriendlyError = `Invalid parameters provided to the "${functionName}" function. Please check the input values.`;
        } else if (error.message.includes('network')) {
          userFriendlyError = `Network error while reading "${functionName}". Please try again later.`;
        } else if (error.message.includes('All Sonic read attempts failed')) {
          userFriendlyError = `Unable to read "${functionName}". The contract might be in a restricted state.`;
        }
      }
      
      return {
        success: false,
        error: userFriendlyError
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