import { useWalletClient, usePublicClient } from 'wagmi';
import { DeployedContract } from '../types/contracts';
import { DatabaseService } from './databaseService';
import { readContract } from 'viem/actions';

// Hook para facilitar el uso del servicio de interacción
export const useContractInteraction = () => {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const databaseService = DatabaseService.getInstance();

  const loadContractData = async (): Promise<DeployedContract[]> => {
    try {
      if (!walletClient?.account) {
        return [];
      }

      // Cargar contratos desde la base de datos
      const contracts = await databaseService.getDeployedContracts(walletClient.account.address);
      
      // Procesar los contratos para el formato requerido
      return contracts.map(contract => ({
        address: contract.contract_address || '',
        contract_address: contract.contract_address,
        name: contract.name || 'Unnamed Contract',
        network: 'sonic',
        deployedAt: contract.deployed_at || new Date().toISOString(),
        deployed_at: contract.deployed_at,
        type: contract.type || 'Unknown',
        abi: contract.abi || [],
        tx_hash: contract.tx_hash,
        transactionHash: contract.transactionHash,
        conversation_id: contract.conversation_id,
        source_code: contract.source_code,
        bytecode: contract.bytecode,
        stats: {
          totalSupply: '0',
          holders: '0',
          transactions: '0',
          volume: '0'
        },
        contractState: []
      }));
    } catch (error) {
      console.error('Error loading contract data:', error);
      return [];
    }
  };

  const readContractData = async (
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = []
  ) => {
    try {
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      const data = await readContract(publicClient, {
        address: address as `0x${string}`,
        abi,
        functionName,
        args
      });

      return data;
    } catch (error) {
      console.error(`Error reading contract data for ${functionName}:`, error);
      throw error;
    }
  };

  return {
    loadContractData,
    readContractData,
    walletClient,
    publicClient
  };
}; 