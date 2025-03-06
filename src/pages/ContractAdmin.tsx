import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useContractRead, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { DeployedContract, AdminAction, ContractState } from '../types/contracts';
import FunctionCard from '../components/FunctionCard';
import { getCommonAdminActions } from '../utils/contractUtils';
import { DatabaseService } from '../services/databaseService';
import { writeContract } from 'viem/actions';
import { defineChain } from 'viem';
import AgentConfigForm, { AgentConfig } from '../components/AgentConfigForm';
import AgentExecutionLogs from '../components/AgentExecutionLogs';

// Definir la cadena Sonic Blaze Testnet
const sonicBlazeTestnet = defineChain({
  id: 57054,
  name: 'Sonic Blaze Testnet',
  network: 'sonic-blaze-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Sonic Blaze',
    symbol: 'SONIC',
  },
  rpcUrls: {
    default: {
      http: ['https://sonic-blaze.rpc.thirdweb.com'],
    },
    public: {
      http: ['https://sonic-blaze.rpc.thirdweb.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Sonic Blaze Scan',
      url: 'https://sonicblaze.io',
    },
  },
  testnet: true,
});

const ContractAdmin: React.FC = () => {
  const [selectedContract, setSelectedContract] = useState<DeployedContract | null>(null);
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [showAgentConfig, setShowAgentConfig] = useState(true);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [showAgentLogs, setShowAgentLogs] = useState(false);
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const databaseService = DatabaseService.getInstance();

  // Monitor transaction status
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  // Effect to reload contracts after successful transaction
  useEffect(() => {
    if (isSuccess && !isConfirming && userAddress) {
      loadDeployedContracts();
      setPendingTxHash(undefined);
    }
  }, [isSuccess, isConfirming, userAddress]);

  const loadContractStats = useCallback(async (address: string, abi: any[]) => {
    try {
      let totalSupply = '0';
      let holders = '0';

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // Usar readContract directamente en lugar del hook
      const data = await publicClient.readContract({
        address: address as `0x${string}`,
        abi,
        functionName: 'totalSupply',
        args: []
      });
      
      if (data) {
        totalSupply = data.toString();
      }

      // Leer balanceOf
      const balanceData = await publicClient.readContract({
        address: address as `0x${string}`,
        abi,
        functionName: 'balanceOf',
        args: [address]
      });

      if (balanceData) {
        holders = balanceData.toString();
      }

      return {
        totalSupply,
        holders,
        transactions: '0',
        volume: '0'
      };
    } catch (error) {
      console.error('Error loading contract stats:', error);
      return {
        totalSupply: '0',
        holders: '0',
        transactions: '0',
        volume: '0'
      };
    }
  }, [publicClient]);

  const loadContractState = useCallback(async (address: string, abi: any[]): Promise<ContractState[]> => {
    const state: ContractState[] = [];
    
    try {
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // Usar readContract directamente para cada función
      const functions = ['paused', 'owner', 'totalSupply', 'symbol'];
      
      for (const functionName of functions) {
        try {
          const data = await publicClient.readContract({
            address: address as `0x${string}`,
            abi,
            functionName,
            args: []
          });

          switch (functionName) {
            case 'paused':
              if (data !== undefined) {
                state.push({
                  label: 'Paused',
                  value: data ? 'Yes' : 'No',
                  type: 'status'
                });
              }
              break;
            case 'owner':
              if (data) {
                state.push({
                  label: 'Owner',
                  value: data.toString(),
                  type: 'address'
                });
              }
              break;
            case 'totalSupply':
              if (data !== undefined) {
                state.push({
                  label: 'Total Supply',
                  value: data.toString(),
                  type: 'number'
                });
              }
              break;
            case 'symbol':
              if (data) {
                state.push({
                  label: 'Symbol',
                  value: data.toString(),
                  type: 'string'
                });
              }
              break;
          }
        } catch (error) {
          console.error(`Error reading ${functionName}:`, error);
        }
      }
      
      return state;
    } catch (error) {
      console.error('Error loading contract state:', error);
      return state;
    }
  }, [publicClient]);

  const loadDeployedContracts = useCallback(async () => {
    if (!userAddress) return;

    try {
      setIsLoading(true);
      
      // Cargar contratos desde la base de datos
      const dbContracts = await databaseService.getDeployedContracts(userAddress);
      console.log('Loaded contracts from database:', dbContracts);
      
      // Procesar los contratos para añadir stats y estado
      const processedContracts = await Promise.all(
        dbContracts.map(async (contract) => {
          const contractAddress = contract.contract_address || '';
          
          const stats = await loadContractStats(contractAddress, contract.abi || []);
          const state = await loadContractState(contractAddress, contract.abi || []);
          
          const deployedContract: DeployedContract = {
            address: contractAddress,
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
            stats,
            contractState: state
          };
          
          return deployedContract;
        })
      );
      
      console.log('Processed contracts:', processedContracts);
      setDeployedContracts(processedContracts);
    } catch (error) {
      console.error('Error loading deployed contracts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, loadContractStats, loadContractState]);

  useEffect(() => {
    if (userAddress) {
      loadDeployedContracts();
    }
  }, [userAddress, loadDeployedContracts]);

  const handleAdminAction = async (contract: DeployedContract, action: AdminAction, params: Record<string, any> = {}) => {
    try {
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      if (!userAddress) {
        throw new Error('User wallet not connected');
      }

      // Convertir parámetros según sus tipos
      const processedParams = Object.entries(params).map(([key, value]) => {
        const param = action.params.find(p => p.name === key);
        if (!param) return value;

        if (param.type.includes('int')) {
          return BigInt(value as string);
        } else if (param.type === 'bool') {
          return (value as string).toLowerCase() === 'true';
        }
        return value;
      });

      // Ejecutar la transacción usando writeContract de viem
      const hash = await writeContract(publicClient, {
        address: contract.address as `0x${string}`,
        abi: contract.abi,
        functionName: action.name,
        args: processedParams,
        chain: sonicBlazeTestnet,
        account: userAddress as `0x${string}`,
      });
      
      // Actualizar el hash de la transacción pendiente
      setPendingTxHash(hash);
    } catch (error) {
      console.error(`Error executing ${action.name}:`, error);
      throw error;
    }
  };

  const handleSaveAgentConfig = async (config: AgentConfig) => {
    try {
      // Aquí se implementaría la lógica para guardar la configuración del agente en el backend
      console.log('Agent configuration saved:', config);
      
      // Simular una operación de guardado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Guardar la configuración del agente en el estado
      setAgentConfig(config);
      
      // Cerrar la vista de configuración y mostrar la vista de ejecución
      setShowAgentConfig(false);
      setShowAgentLogs(true);
      
      // Mostrar alguna notificación de éxito (esto sería implementado según el sistema de notificaciones de la aplicación)
      alert('Agent configured successfully!');
    } catch (error) {
      console.error('Error saving agent configuration:', error);
    }
  };

  const handleBackToConfig = () => {
    setShowAgentLogs(false);
    setShowAgentConfig(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="mt-4 text-gray-400 text-sm">Loading contracts...</div>
        </div>
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Your Contracts
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deployedContracts.map((contract) => (
            <motion.div
              key={contract.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="backdrop-blur-xl bg-gray-800/30 rounded-xl p-6 cursor-pointer hover:bg-gray-800/40 transition-all duration-300 shadow-lg hover:shadow-2xl border border-gray-700/40 hover:border-blue-500/30 group"
              onClick={() => setSelectedContract(contract)}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-2 group-hover:text-blue-400 transition-colors">
                    {contract.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-mono text-gray-400 hover:text-blue-400 transition-colors break-all">
                      {contract.address}
                    </span>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-3 py-1 bg-gray-700/50 rounded-full text-gray-300 border border-gray-600/30">
                        {contract.network}
                      </span>
                      <span className="text-xs px-3 py-1 bg-gray-700/50 rounded-full text-gray-300 border border-gray-600/30">
                        {contract.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {Object.entries(contract.stats).map(([key, value]) => (
                  <div key={key} className="backdrop-blur-md bg-gray-800/20 p-4 rounded-lg border border-gray-700/30 group-hover:border-blue-500/20 transition-all">
                    <div className="text-sm text-gray-400 capitalize mb-2">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-lg font-semibold bg-gradient-to-r from-gray-200 to-gray-100 bg-clip-text text-transparent">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">
                  Deployed: {new Date(contract.deployedAt).toLocaleDateString()}
                </span>
                <button className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 group-hover:translate-x-1 duration-300">
                  Manage 
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Contract Management View
  return (
    <div className="container-fluid max-w-[98%] mx-auto p-4 lg:p-6 h-[calc(100vh-70px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedContract(null)}
            className="text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-2 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Contracts
          </button>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Contract Administration
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-1.5 rounded-full text-sm flex items-center gap-2 ${
            isConfirming 
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
              : isSuccess 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isConfirming ? 'bg-yellow-400 animate-pulse' : isSuccess ? 'bg-green-400' : 'bg-blue-400'
            }`}></span>
            {isConfirming ? 'Transaction Pending' : isSuccess ? 'Transaction Confirmed' : 'Ready'}
          </span>

          <button 
            onClick={() => setShowAgentConfig(!showAgentConfig)}
            className="px-4 py-2 bg-indigo-600/90 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 18.5V19.38C12 21.25 11.25 22 9.37 22H4.62C3.17 22 2 20.83 2 19.38V14.63C2 12.75 2.75 12 4.62 12H5.5V15.5C5.5 17.16 6.84 18.5 8.5 18.5H12Z" fill="currentColor"/>
              <path d="M17 13.5V14.37C17 15.82 15.82 17 14.37 17H9.62C7.75 17 7 16.25 7 14.37V9.62C7 8.17 8.17 7 9.62 7H10.5V10.5C10.5 12.16 11.84 13.5 13.5 13.5H17Z" fill="currentColor"/>
              <path d="M22 4.62V9.37C22 11.25 21.25 12 19.37 12H14.62C12.75 12 12 11.25 12 9.37V4.62C12 2.75 12.75 2 14.62 2H19.37C21.25 2 22 2.75 22 4.62Z" fill="currentColor"/>
            </svg>
            {showAgentConfig ? 'Hide Agent Config' : 'Configure Agent'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 xl:gap-4 flex-grow overflow-hidden">
        {/* Contenido principal (a la izquierda en pantallas grandes) */}
        <div className={`${showAgentConfig ? 'lg:w-[64%]' : 'w-full'} transition-all duration-300 h-full overflow-auto`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="backdrop-blur-xl bg-gray-800/30 rounded-xl p-6 shadow-xl border border-gray-700/40 h-full"
          >
            {/* Contract Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-gray-800/40 p-4 rounded-xl border border-gray-700/40">
              <div className="mb-4 md:mb-0">
                <h3 className="text-xl font-semibold text-gray-200 mb-2">
                  {selectedContract.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-mono text-gray-400 hover:text-blue-400 transition-colors break-all">
                    {selectedContract.address}
                  </span>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-3 py-1 bg-gray-700/50 rounded-full text-gray-300 border border-gray-600/30">
                      {selectedContract.network}
                    </span>
                    <span className="text-xs px-3 py-1 bg-gray-700/50 rounded-full text-gray-300 border border-gray-600/30">
                      {selectedContract.type}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700/30">
                Deployed: {new Date(selectedContract.deployedAt).toLocaleDateString()}
              </div>
            </div>

            {/* Contract Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {Object.entries(selectedContract.stats).map(([key, value]) => (
                <div key={key} className="backdrop-blur-md bg-gray-800/20 p-4 rounded-xl border border-gray-700/30 hover:border-blue-500/20 transition-all group">
                  <div className="text-sm text-gray-400 capitalize mb-2 flex items-center gap-2">
                    {key === 'totalSupply' && (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M15 9H9V15H15V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {key === 'holders' && (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {key === 'transactions' && (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 12H3M3 12L7 8M3 12L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {key === 'volume' && (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2V22M17 4V20M7 4V20M2 8V16M22 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-lg font-semibold bg-gradient-to-r from-gray-200 to-gray-100 bg-clip-text text-transparent group-hover:from-blue-400 group-hover:to-indigo-400 transition-all">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Contract State */}
            <div className="mb-8">
              <h4 className="text-base font-medium text-gray-300 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Contract State
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedContract.contractState.map((item, index) => (
                  <div
                    key={index}
                    className="backdrop-blur-md bg-gray-800/20 p-4 rounded-xl border border-gray-700/30 hover:border-blue-500/20 transition-all group"
                  >
                    <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      {item.type === 'status' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {item.type === 'address' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 12H15M9 16H15M9 8H15M5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {item.label}
                    </div>
                    <div className="font-mono text-sm break-all">
                      {item.type === 'status' ? (
                        <span className={`px-3 py-1 rounded-full text-xs ${
                          item.value === 'Yes' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}>
                          {item.value}
                        </span>
                      ) : item.type === 'address' ? (
                        <a
                          href={`https://etherscan.io/address/${item.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <span className="text-gray-200">{item.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contract Functions */}
            <div className="space-y-8">
              <h4 className="text-base font-medium text-gray-300 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Contract Functions
              </h4>
              
              {/* Read Functions (View/Pure) */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h5 className="text-base font-medium text-emerald-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    Read Functions
                  </h5>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
                    View/Pure
                  </span>
                  {(() => {
                    const readFunctions = selectedContract.abi.filter(
                      (item: any) => item.type === 'function' && 
                      (item.stateMutability === 'view' || item.stateMutability === 'pure')
                    ).length;
                    return (
                      <span className="text-xs bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full border border-gray-600/30">
                        {readFunctions} {readFunctions === 1 ? 'function' : 'functions'}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-sm text-gray-400 mb-6">
                  These functions retrieve data from the blockchain without modifying the contract state. No gas fees required.
                </p>
                <div className={`grid grid-cols-1 ${showAgentConfig ? 'md:grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
                  {selectedContract.abi
                    .filter((item: any) => 
                      item.type === 'function' && 
                      (item.stateMutability === 'view' || item.stateMutability === 'pure')
                    )
                    .map((func: any, index: number) => (
                      <FunctionCard
                        key={index}
                        func={func}
                        contractAddress={selectedContract.address}
                        abi={selectedContract.abi}
                      />
                    ))}
                </div>
              </div>
              
              {/* Write Functions (Non-payable/Payable) */}
              <div className="space-y-4 mt-12">
                <div className="flex items-center gap-3">
                  <h5 className="text-base font-medium text-blue-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Write Functions
                  </h5>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">
                      Non-payable
                    </span>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                      Payable
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 1V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                  {(() => {
                    const nonPayableFunctions = selectedContract.abi.filter(
                      (item: any) => item.type === 'function' && item.stateMutability === 'nonpayable'
                    ).length;
                    const payableFunctions = selectedContract.abi.filter(
                      (item: any) => item.type === 'function' && item.stateMutability === 'payable'
                    ).length;
                    return (
                      <span className="text-xs bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full border border-gray-600/30">
                        {nonPayableFunctions + payableFunctions} {nonPayableFunctions + payableFunctions === 1 ? 'function' : 'functions'}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-sm text-gray-400 mb-6">
                  These functions modify the blockchain state and require gas fees for execution.
                </p>
                
                {/* NonPayable Functions */}
                <div className={`grid grid-cols-1 ${showAgentConfig ? 'md:grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
                  {selectedContract.abi
                    .filter((item: any) => 
                      item.type === 'function' && item.stateMutability === 'nonpayable'
                    )
                    .map((func: any, index: number) => (
                      <FunctionCard
                        key={`nonpayable-${index}`}
                        func={func}
                        contractAddress={selectedContract.address}
                        abi={selectedContract.abi}
                      />
                    ))}
                </div>
                
                {/* Payable Functions - if any exist */}
                {selectedContract.abi.some((item: any) => 
                  item.type === 'function' && item.stateMutability === 'payable'
                ) && (
                  <div className="mt-8">
                    <div className="flex items-center gap-3 mb-4">
                      <h6 className="text-base font-medium text-amber-400 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                        Payable Functions
                      </h6>
                      {(() => {
                        const payableFunctions = selectedContract.abi.filter(
                          (item: any) => item.type === 'function' && item.stateMutability === 'payable'
                        ).length;
                        return (
                          <span className="text-xs bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full border border-gray-600/30">
                            {payableFunctions} {payableFunctions === 1 ? 'function' : 'functions'}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-gray-400 mb-6">
                      These functions require you to send ETH along with the transaction.
                    </p>
                    <div className={`grid grid-cols-1 ${showAgentConfig ? 'md:grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
                      {selectedContract.abi
                        .filter((item: any) => 
                          item.type === 'function' && item.stateMutability === 'payable'
                        )
                        .map((func: any, index: number) => (
                          <FunctionCard
                            key={`payable-${index}`}
                            func={func}
                            contractAddress={selectedContract.address}
                            abi={selectedContract.abi}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Actions */}
            <div className="space-y-4 mt-12">
              <h4 className="text-base font-medium text-gray-300 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Administrative Actions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getCommonAdminActions(selectedContract.type).map((action, index) => (
                  <div
                    key={index}
                    className="backdrop-blur-md bg-gray-800/20 p-6 rounded-xl border border-gray-700/30 hover:border-blue-500/20 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <h5 className="text-lg font-medium text-gray-200 group-hover:text-blue-400 transition-colors">{action.label}</h5>
                        <p className="text-sm text-gray-400 mt-2">{action.description}</p>
                      </div>
                      <button
                        onClick={() => handleAdminAction(selectedContract, action)}
                        className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all duration-300 flex items-center gap-2 group-hover:translate-x-1"
                      >
                        Execute
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Configuración del agente (a la derecha) */}
        {showAgentConfig && !showAgentLogs && (
          <div className="lg:w-[36%] h-full overflow-auto">
            <AgentConfigForm 
              contract={selectedContract}
              onSave={handleSaveAgentConfig}
              onCancel={() => setShowAgentConfig(false)}
            />
          </div>
        )}

        {/* Vista de ejecución y logs (a la derecha) */}
        {showAgentLogs && agentConfig && !showAgentConfig && (
          <div className="lg:w-[36%] h-full overflow-auto">
            <AgentExecutionLogs 
              contract={selectedContract}
              agentConfig={agentConfig}
              onBack={handleBackToConfig}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractAdmin; 