import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  ClockIcon, 
  DocumentDuplicateIcon, 
  LinkIcon, 
  ArrowPathIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { ConversationContext } from '../../services/conversationService';
import { DeployedContract } from '../../types/contracts';

// Importación correcta del servicio
import DatabaseService from '../../services/databaseService';

// Define VirtualFile type to avoid type errors
interface VirtualFile {
  content: string;
  language: string;
  timestamp: number;
  [key: string]: any;
}

interface ContractVersion {
  id: string;
  name: string;
  address?: string;
  timestamp: number;
  sourceCode: string;
  conversationId: string;
  conversationName: string;
  txHash?: string;
  isDeployed: boolean;
}

interface ContractVersionHistoryProps {
  contractAddress?: string;
  conversationContexts: ConversationContext[];
  activeContextId?: string;
  onLoadVersion: (sourceCode: string, isDeployed: boolean) => void;
  onViewConversation: (contextId: string) => void;
}

const ContractVersionHistory: React.FC<ContractVersionHistoryProps> = ({
  contractAddress,
  conversationContexts,
  activeContextId,
  onLoadVersion,
  onViewConversation
}) => {
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const databaseService = DatabaseService.getInstance();
  const { address } = useAccount();

  // Obtener los contratos de la base de datos
  useEffect(() => {
    const loadVersions = async () => {
      setIsLoading(true);
      
      try {
        const allVersions: ContractVersion[] = [];
        
        // Use the wallet address from wagmi's useAccount hook
        if (!address) {
          console.log('[ContractVersionHistory] No wallet address available');
          setIsLoading(false);
          return;
        }
        
        console.log('[ContractVersionHistory] Using wallet address:', address);
        
        // Obtener todos los contratos desplegados para esta dirección de wallet
        try {
          const deployedContracts = await databaseService.getDeployedContracts(address);
          console.log('[ContractVersionHistory] Deployed contracts:', deployedContracts);
          console.log('[ContractVersionHistory] Current contract address prop:', contractAddress);
          
          // Identificar cuál es el contrato actualmente desplegado (si hay uno)
          // Comparando con el contractAddress pasado como prop
          const currentlyDeployedContract = contractAddress && 
            deployedContracts.find((contract: DeployedContract) => 
              contract.contract_address?.toLowerCase() === contractAddress?.toLowerCase()
            );
            
          console.log('[ContractVersionHistory] Currently deployed contract:', currentlyDeployedContract || 'None');
          
          // Convertir los contratos de la BD a nuestro formato de versiones
          deployedContracts.forEach((contract: DeployedContract) => {
            // Un contrato está activamente desplegado solo si su dirección coincide con la actual
            const isActiveDeployment = !!(contractAddress && 
              contract.contract_address?.toLowerCase() === contractAddress?.toLowerCase());
            
            // Process the timestamp properly
            let timestamp: number;
            try {
              // First try to use the deployedAt field if available
              if (contract.deployedAt && typeof contract.deployedAt === 'number') {
                timestamp = contract.deployedAt;
              } 
              // Next try to parse the deployed_at string
              else if (contract.deployed_at) {
                // Check if deployed_at format is yyyy-MM-dd HH:mm:ss
                if (typeof contract.deployed_at === 'string' && contract.deployed_at.includes('-')) {
                  timestamp = new Date(contract.deployed_at).getTime();
                } else {
                  timestamp = Number(contract.deployed_at);
                }
              } else {
                timestamp = Date.now();
              }
            } catch (e) {
              console.error('[ContractVersionHistory] Error parsing timestamp:', e);
              timestamp = Date.now();
            }
            
            // Log for debugging
            console.log(`[ContractVersionHistory] Processing contract ${contract.contract_address}:`, {
              isActiveDeployment,
              timestamp,
              deployed_at: contract.deployed_at,
              address: contract.contract_address,
              currentAddress: contractAddress
            });
            
            // Extract source code properly
            let sourceCodeContent = '';
            try {
              if (typeof contract.sourceCode === 'string') {
                sourceCodeContent = contract.sourceCode;
              } else if (typeof contract.source_code === 'string') {
                // Try to parse source_code as JSON if it looks like JSON
                if (contract.source_code.trim().startsWith('{')) {
                  const parsedSource = JSON.parse(contract.source_code);
                  sourceCodeContent = parsedSource.content || contract.source_code;
                } else {
                  sourceCodeContent = contract.source_code;
                }
              } else if (contract.sourceCode && typeof contract.sourceCode === 'object' && contract.sourceCode.content) {
                sourceCodeContent = contract.sourceCode.content;
              } else {
                sourceCodeContent = JSON.stringify(contract.sourceCode || contract.source_code || '');
              }
            } catch (e) {
              console.error('[ContractVersionHistory] Error parsing source code:', e);
              sourceCodeContent = typeof contract.source_code === 'string' ? contract.source_code : '';
            }
            
            // All contracts from the database have an address and should be marked as deployed
            // But only one is the currently active deployment
            allVersions.push({
              id: contract.id || `contract-${Math.random().toString(36).substring(2, 9)}`,
              name: contract.name || 'Smart Contract',
              address: contract.contract_address,
              timestamp,
              sourceCode: sourceCodeContent,
              conversationId: contract.conversation_id || '',
              conversationName: conversationContexts.find(ctx => ctx.id === (contract.conversation_id || ''))?.name || 'Unknown Conversation',
              txHash: contract.tx_hash || contract.transactionHash || '',
              isDeployed: isActiveDeployment // Only the current address is marked as actively deployed
            });
          });
        } catch (error) {
          console.error('[ContractVersionHistory] Error fetching deployed contracts:', error);
        }
        
        // También incluir versiones no desplegadas de los contextos de conversación
        conversationContexts.forEach(context => {
          // Verificar si este contexto tiene archivos Solidity
          const hasSolidityFiles = context.virtualFiles && 
            Object.entries(context.virtualFiles).some(([_, file]) => 
              (file as VirtualFile).language === 'solidity'
            );
            
          if (hasSolidityFiles) {
            // Encontrar todos los archivos Solidity en este contexto
            const solidityFiles = Object.entries(context.virtualFiles)
              .filter(([_, file]) => (file as VirtualFile).language === 'solidity');
              
            // Incluir solo archivos que no correspondan a contratos ya desplegados
            solidityFiles.forEach(([path, file]) => {
              // Verificar si este archivo ya está representado en allVersions
              const isAlreadyIncluded = allVersions.some(
                (version) => 
                  version.conversationId === context.id && 
                  version.sourceCode === (file as VirtualFile).content
              );
              
              // Solo incluir archivos que no estén ya incluidos
              if (!isAlreadyIncluded) {
                allVersions.push({
                  id: `${context.id}_${path}`,
                  name: path.split('/').pop() || 'Contract.sol',
                  timestamp: (file as VirtualFile).timestamp,
                  sourceCode: (file as VirtualFile).content,
                  conversationId: context.id,
                  conversationName: context.name || 'Unnamed Conversation',
                  isDeployed: false
                });
              }
            });
          }
        });
        
        // Ordenar por timestamp (los más recientes primero)
        allVersions.sort((a, b) => b.timestamp - a.timestamp);
        
        setVersions(allVersions);
      } catch (error) {
        console.error('[ContractVersionHistory] Error loading versions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVersions();
  }, [conversationContexts, contractAddress, databaseService, address]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLoadVersion = (version: ContractVersion) => {
    setSelectedVersion(version.id);
    onLoadVersion(version.sourceCode, version.isDeployed);
  };

  return (
    <div className={`bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl overflow-hidden transition-all duration-300 ${
      isExpanded ? 'h-80' : 'h-12'
    }`}>
      {/* Header with toggle */}
      <div 
        className="h-12 px-4 flex items-center justify-between bg-gray-800/95 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <ClockIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Contract Version History</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">{versions.length} versions</span>
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Content when expanded */}
      {isExpanded && (
        <div className="h-[calc(100%-3rem)] flex flex-col">
          {/* Loading state */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* No versions state */}
          {!isLoading && versions.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
              <DocumentDuplicateIcon className="w-12 h-12 mb-4 text-gray-600" />
              <p className="text-center">No version history available for this contract.</p>
              <p className="text-sm text-gray-500 mt-2">
                Contract versions will appear here when you deploy or save different versions.
              </p>
            </div>
          )}

          {/* Versions list */}
          {!isLoading && versions.length > 0 && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {versions.map((version) => (
                  <div 
                    key={version.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedVersion === version.id
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-gray-700/40 border-gray-700 hover:bg-gray-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          version.isDeployed ? 'bg-green-400' : 
                          (version.address ? 'bg-yellow-400' : 'bg-gray-400')
                        }`}></div>
                        <span className="font-medium text-white">{version.name}</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLoadVersion(version)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="Load this version into editor"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onViewConversation(version.conversationId)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="View conversation"
                        >
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-sm">
                      <div className="flex items-center text-gray-500">
                        <ClockIcon className="w-3.5 h-3.5 mr-1 inline" />
                        <span>{formatDate(version.timestamp)}</span>
                      </div>
                      
                      <div className="flex items-center text-gray-500 mt-1">
                        <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 mr-1 inline" />
                        <span>{version.conversationName}</span>
                      </div>
                      
                      {version.address && (
                        <div className="flex items-center text-gray-400 mt-1">
                          <LinkIcon className="w-3.5 h-3.5 mr-1 inline" />
                          <span className={`${
                            version.isDeployed 
                              ? 'text-green-400' 
                              : 'text-yellow-400'
                          }`}>
                            {version.address.substring(0, 6)}...{version.address.substring(38)}
                            {!version.isDeployed && version.address && ' (Historical)'}
                          </span>
                        </div>
                      )}
                      
                      {version.txHash && (
                        <div className="flex items-center text-gray-400 mt-1 text-xs">
                          <span className="text-gray-500">TX: </span>
                          <span className="ml-1 text-blue-400">{version.txHash}</span>
                        </div>
                      )}
                    </div>

                    {version.conversationId === activeContextId && (
                      <div className="mt-2 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded inline-block">
                        Current Context
                      </div>
                    )}
                    
                    {/* Status Indicator */}
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        version.isDeployed ? 'bg-green-400' : 
                        (version.address ? 'bg-yellow-400' : 'bg-gray-400')
                      }`}></div>
                      {version.isDeployed && (
                        <div className="mt-2 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded inline-block ml-2">
                          Currently Deployed
                        </div>
                      )}
                      {!version.isDeployed && version.address && (
                        <div className="mt-2 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded inline-block ml-2">
                          Previously Deployed
                        </div>
                      )}
                      {!version.address && (
                        <div className="mt-2 px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded inline-block ml-2">
                          Not Deployed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractVersionHistory; 