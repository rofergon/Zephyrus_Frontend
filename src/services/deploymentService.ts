import { createPublicClient, createWalletClient, custom, parseEther, encodeFunctionData, encodeDeployData } from 'viem';
import { useWalletClient, usePublicClient } from 'wagmi';

export class DeploymentService {
  private static instance: DeploymentService;
  
  private constructor() {}

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
    publicClient: any
  ) {
    try {
      console.log('[DeploymentService] Starting deployment with args:', {
        constructorArgs,
        abiLength: abi.length,
        bytecodeLength: bytecode.length,
      });

      // Ensure bytecode starts with 0x
      const formattedBytecode = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`;

      // Encode constructor data with arguments
      const encodedDeployData = encodeDeployData({
        abi,
        bytecode: formattedBytecode,
        args: constructorArgs,
      });

      console.log('[DeploymentService] Encoded deploy data:', {
        dataLength: encodedDeployData.length,
        constructorArgs,
      });

      // Estimate gas for deployment with encoded data
      const gasEstimate = await publicClient.estimateGas({
        account: walletClient.account,
        data: encodedDeployData,
      }).catch((error) => {
        console.error('[DeploymentService] Gas estimation failed:', error);
        throw new Error(`Gas estimation failed: ${error.message}`);
      });

      console.log('[DeploymentService] Gas estimate:', gasEstimate);

      // Send deployment transaction
      const hash = await walletClient.deployContract({
        abi,
        bytecode: formattedBytecode,
        args: constructorArgs,
        gas: BigInt(Math.floor(Number(gasEstimate) * 1.1)), // Add 10% buffer
      }).catch((error) => {
        console.error('[DeploymentService] Contract deployment failed:', error);
        throw new Error(`Contract deployment failed: ${error.message}`);
      });

      console.log('[DeploymentService] Deployment transaction hash:', hash);

      // Wait for deployment to complete
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log('[DeploymentService] Deployment successful:', {
        contractAddress: receipt.contractAddress,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: true,
        contractAddress: receipt.contractAddress,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      console.error('[DeploymentService] Deployment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
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
    constructorArgs: any[] = []
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
      publicClient
    );
  };

  return {
    deployContract,
  };
}; 