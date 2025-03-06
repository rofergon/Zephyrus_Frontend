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
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-200">
            Your Contracts
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deployedContracts.map((contract) => (
            <motion.div
              key={contract.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              className="glass-morphism gradient-border rounded-lg p-6 cursor-pointer hover:bg-gray-800/50 transition-all duration-200 shadow-md hover:shadow-lg border border-gray-700/40"
              onClick={() => setSelectedContract(contract)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-200 mb-2">
                    {contract.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-400">
                      {contract.address}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                      {contract.network}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                      {contract.type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {Object.entries(contract.stats).map(([key, value]) => (
                  <div key={key} className="glass-morphism p-3 rounded-lg">
                    <div className="text-sm text-gray-400 capitalize mb-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-base font-medium text-gray-200">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm text-gray-400">
                <span>
                  Deployed: {new Date(contract.deployedAt).toLocaleDateString()}
                </span>
                <button className="text-blue-400 hover:text-blue-300 transition-colors">
                  Manage →
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
    <div className="container-fluid max-w-[98%] mx-auto p-3 lg:p-4 xl:p-5 h-[calc(100vh-70px)] flex flex-col">
      <div className="flex justify-between items-center mb-4 lg:mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedContract(null)}
            className="text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <span className="text-xl">←</span> Back to Contracts
          </button>
          <h2 className="text-xl font-bold text-gray-200">
            Contract Administration
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs ${
            isConfirming ? 'bg-yellow-500/20 text-yellow-400' : isSuccess ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            {isConfirming ? 'Transaction Pending' : isSuccess ? 'Transaction Confirmed' : 'Ready'}
          </span>

          <button 
            onClick={() => setShowAgentConfig(!showAgentConfig)}
            className="ml-3 px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
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
            className="glass-morphism gradient-border rounded-lg p-3 lg:p-4 shadow-lg h-full"
          >
            {/* Contract Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 bg-gray-800/30 p-3 rounded-lg border border-gray-700/40">
              <div className="mb-4 md:mb-0">
                <h3 className="text-lg font-medium text-gray-200 mb-2">
                  {selectedContract.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-400">
                    {selectedContract.address}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                    {selectedContract.network}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                    {selectedContract.type}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-400">
                Deployed: {new Date(selectedContract.deployedAt).toLocaleDateString()}
              </div>
            </div>

            {/* Contract Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(selectedContract.stats).map(([key, value]) => (
                <div key={key} className="glass-morphism p-4 rounded-lg border border-gray-700/40 hover:border-blue-500/20 transition-all">
                  <div className="text-sm text-gray-400 capitalize mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-lg font-medium text-gray-200">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Contract State */}
            <div className="mb-8">
              <h4 className="text-sm font-medium text-gray-400 mb-3 border-b border-gray-700/40 pb-2">Contract State</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedContract.contractState.map((item, index) => (
                  <div
                    key={index}
                    className="glass-morphism p-4 rounded-lg border border-gray-700/40 hover:border-blue-500/20 transition-all"
                  >
                    <div className="text-sm text-gray-400 mb-1">{item.label}</div>
                    <div className="font-mono text-sm break-all">
                      {item.type === 'status' ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.value === 'Yes' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {item.value}
                        </span>
                      ) : item.type === 'address' ? (
                        <a
                          href={`https://etherscan.io/address/${item.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
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
            <div className="space-y-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3 border-b border-gray-700/40 pb-2">Contract Functions</h4>
              
              {/* Read Functions (View/Pure) */}
              <div className="space-y-2">
                <h5 className="text-base font-medium text-emerald-400 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                  Read Functions
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/30">
                    View/Pure
                  </span>
                  {(() => {
                    const readFunctions = selectedContract.abi.filter(
                      (item: any) => item.type === 'function' && 
                      (item.stateMutability === 'view' || item.stateMutability === 'pure')
                    ).length;
                    return (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full ml-2">
                        {readFunctions} {readFunctions === 1 ? 'function' : 'functions'}
                      </span>
                    );
                  })()}
                </h5>
                <p className="text-sm text-gray-400 mb-4 ml-1">
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
              <div className="space-y-4 mt-8">
                <h5 className="text-base font-medium text-blue-400 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Write Functions
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                      Non-payable
                    </span>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full border border-amber-500/30">
                      Payable 💰
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
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full ml-2">
                        {nonPayableFunctions + payableFunctions} {nonPayableFunctions + payableFunctions === 1 ? 'function' : 'functions'}
                      </span>
                    );
                  })()}
                </h5>
                <p className="text-sm text-gray-400 mb-4 ml-1">
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
                  <div className="mt-4">
                    <h6 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                      Payable Functions (require ETH)
                      {(() => {
                        const payableFunctions = selectedContract.abi.filter(
                          (item: any) => item.type === 'function' && item.stateMutability === 'payable'
                        ).length;
                        return (
                          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full ml-2">
                            {payableFunctions} {payableFunctions === 1 ? 'function' : 'functions'}
                          </span>
                        );
                      })()}
                    </h6>
                    <p className="text-sm text-gray-400 mb-4 ml-1">
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
            <div className="space-y-4 mt-8">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Administrative Actions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getCommonAdminActions(selectedContract.type).map((action, index) => (
                  <div
                    key={index}
                    className="glass-morphism p-4 rounded-lg border border-gray-700/50 hover:border-blue-500/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <h5 className="text-base font-medium text-gray-200">{action.label}</h5>
                        <p className="text-sm text-gray-400">{action.description}</p>
                      </div>
                      <button
                        onClick={() => handleAdminAction(selectedContract, action)}
                        className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors self-end md:self-auto"
                      >
                        Execute
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