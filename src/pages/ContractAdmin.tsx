import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { DeployedContract, ContractState } from '../types/contracts';
import { DatabaseService } from '../services/databaseService';
import AgentConfigForm, { AgentConfiguration } from '../components/AgentConfigForm';
import AgentExecutionLogs from '../components/AgentExecutionLogs';
import { AgentService, Agent } from '../services/agentService';
import AgentList from '../components/AgentList';
import ContractStateDisplay from '../components/ContractStateDisplay';
import ResizablePanel from '../components/ResizablePanel';
import ContractFunctions from '../components/ContractFunctions';

// Definir la cadena Sonic Blaze Testnet

// Fix for fetchContractState error - add this function
const fetchContractState = async (contract: DeployedContract): Promise<any> => {
  // This is a simplified version - you would need to implement this based on your contract state requirements
  try {
    return {
      paused: false,
      totalSupply: '0',
      symbol: (contract as any).symbol || 'TOKEN' // Usando casting para evitar el error de TypeScript
    };
  } catch (error) {
    console.error('Error fetching contract state:', error);
    return {};
  }
};

const ContractAdmin: React.FC = () => {
  const [selectedContract, setSelectedContract] = useState<DeployedContract | null>(null);
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [showAgentConfig, setShowAgentConfig] = useState(true);
  const [showAgentList, setShowAgentList] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfiguration | null>(null);
  const [showAgentLogs, setShowAgentLogs] = useState(false);
  const [existingAgents, setExistingAgents] = useState<Agent[]>([]);
  const [, setCurrentAgent] = useState<Agent | null>(null);
  const [selectedAgentForExecution, setSelectedAgentForExecution] = useState<Agent | null>(null);
  const [, setIsLoadingAgents] = useState(false);
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const databaseService = DatabaseService.getInstance();
  const agentService = AgentService.getInstance();
  // Solo mantener esta variable para compatibilidad con otras partes del código
  const [leftPanelWidth] = useState<string>('64%');

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


  const handleSaveAgentConfig = async (config: AgentConfiguration) => {
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
      
      // Reload agents for this contract to show the newly created one
      if (selectedContract && selectedContract.contract_address) {
        loadAgentsForContract(selectedContract.contract_address);
      }
    } catch (error) {
      console.error('Error saving agent configuration:', error);
    }
  };

  const handleBackToConfig = () => {
    setShowAgentLogs(false);
    
    // Check if we came from the agent list
    if (existingAgents && existingAgents.length > 0) {
      setShowAgentList(true);
    } else {
      setShowAgentConfig(true);
    }
    
    // Reset selected agent
    setSelectedAgentForExecution(null);
  };

  // New function to load agents for the selected contract
  const loadAgentsForContract = useCallback(async (contractId: string) => {
    if (!contractId) return;
    
    setIsLoadingAgents(true);
    try {
      const agents = await agentService.getAgentsForContract(contractId);
      setExistingAgents(agents);
      
      // If agents exist, set the most recent one as current and show agent list
      if (agents && agents.length > 0) {
        // Sort by updated_at in descending order
        const sortedAgents = [...agents].sort((a, b) => {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        setCurrentAgent(sortedAgents[0]);
        setShowAgentList(true);
        setShowAgentConfig(false);
        console.log('Agents found for contract:', agents.length);
      } else {
        setCurrentAgent(null);
        setShowAgentList(false);
        setShowAgentConfig(true);
      }
    } catch (error) {
      console.error('Error loading agents for contract:', error);
      setShowAgentList(false);
      setShowAgentConfig(true);
    } finally {
      setIsLoadingAgents(false);
    }
  }, []);

  // Update useEffect to load agents when a contract is selected
  useEffect(() => {
    if (selectedContract && selectedContract.contract_address) {
      loadAgentsForContract(selectedContract.contract_address);
    }
  }, [selectedContract, loadAgentsForContract]);

  // Function to handle selecting an agent from the list to go to execution view
  const handleAgentSelect = async (agent: Agent) => {
    setSelectedAgentForExecution(agent);
    setIsLoadingAgents(true);
    
    // Convert agent to the required format for execution view
    if (selectedContract && selectedContract.abi) {
      try {
        // Get the raw ABI
        const contractAbi = typeof selectedContract.abi === 'string' 
          ? selectedContract.abi 
          : JSON.stringify(selectedContract.abi);
        
        // Get the agent's configured functions
        const agentFunctions = await agentService.getAgentFunctions(agent.agent_id);
        console.log('Agent functions loaded:', agentFunctions);
        
        // Convert Agent to AgentConfiguration with the agent functions
        const agentConfig = agentService.convertAgentToConfiguration(
          agent, 
          contractAbi,
          agentFunctions
        );
        
        setAgentConfig(agentConfig);
        
        // Show execution view
        setShowAgentList(false);
        setShowAgentConfig(false);
        setShowAgentLogs(true);
      } catch (error) {
        console.error('Error converting agent to configuration:', error);
        alert('Error loading agent functions. Please try again.');
      } finally {
        setIsLoadingAgents(false);
      }
    }
  };

  // Function to handle creating a new agent from the agent list
  const handleCreateNewAgent = () => {
    setShowAgentList(false);
    setShowAgentConfig(true);
  };

  const handleContractSelect = async (contract: DeployedContract) => {
    setSelectedContract(contract);
    
    // Load contract stats and state
    if (contract.contract_address && contract.abi) {
      try {
        const stats = await loadContractStats(contract.contract_address, contract.abi);
        const state = await fetchContractState(contract);
        
        // Update the contract with stats and state
        setSelectedContract(prev => ({
          ...prev!,
          ...stats,
          state
        }));
        
        // Load agents for this contract
        loadAgentsForContract(contract.contract_address);
      } catch (error) {
        console.error('Error loading contract details:', error);
      }
    }
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
              onClick={() => handleContractSelect(contract)}
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

      {/* Utilizamos el componente ResizablePanel en lugar del código anterior */}
      {selectedContract && (showAgentConfig || showAgentList || showAgentLogs) ? (
        <ResizablePanel
          initialLeftWidth={leftPanelWidth}
          leftContent={
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

              {/* Usamos el componente ContractStateDisplay */}
              {selectedContract.contractState && (
                <ContractStateDisplay contractState={selectedContract.contractState} />
              )}

              {/* Contract Functions */}
              <ContractFunctions 
                contract={selectedContract} 
                showInColumns={showAgentConfig || showAgentList || showAgentLogs}
              />
            </motion.div>
          }
          rightContent={
            <div className="h-full overflow-y-auto">
              {showAgentConfig && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="backdrop-blur-xl bg-gray-800/30 rounded-xl p-6 shadow-xl border border-gray-700/40 h-full"
                >
                  <AgentConfigForm
                    contract={selectedContract}
                    onSave={handleSaveAgentConfig}
                    initialConfig={agentConfig || undefined}
                    onBackToList={() => {
                      setShowAgentList(true);
                      setShowAgentConfig(false);
                    }}
                    onCancel={handleBackToConfig}
                  />
                </motion.div>
              )}

              {showAgentList && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="backdrop-blur-xl bg-gray-800/30 rounded-xl p-6 shadow-xl border border-gray-700/40 h-full"
                >
                  <AgentList
                    agents={existingAgents}
                    contract={selectedContract}
                    onSelectAgent={handleAgentSelect}
                    onNewAgent={handleCreateNewAgent}
                  />
                </motion.div>
              )}

              {showAgentLogs && selectedAgentForExecution && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="backdrop-blur-xl bg-gray-800/30 rounded-xl p-6 shadow-xl border border-gray-700/40 h-full"
                >
                  <AgentExecutionLogs
                    agent={selectedAgentForExecution}
                    selectedAgent={selectedAgentForExecution}
                    agentConfig={agentConfig || undefined}
                    contract={selectedContract}
                    onBack={handleBackToConfig}
                    onConfigureAgent={() => {
                      setShowAgentLogs(false);
                      setShowAgentConfig(true);
                    }}
                    onBackToList={() => {
                      setShowAgentLogs(false);
                      setShowAgentList(true);
                    }}
                  />
                </motion.div>
              )}
            </div>
          }
        />
      ) : (
        // ... mantener el código para cuando selectedContract es null o no hay paneles adicionales
        <div>
          {/* Resto del código existente para la lista de contratos */}
        </div>
      )}
    </div>
  );
};

export default ContractAdmin; 