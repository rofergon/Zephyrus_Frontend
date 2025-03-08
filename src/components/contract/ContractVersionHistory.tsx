import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
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

// Función de utilidad para generar UUIDs v4
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Función de utilidad para procesar timestamps
const parseTimestamp = (input: any): number => {
  try {
    if (typeof input === 'number') {
      return input;
    }
    if (typeof input === 'string') {
      // Si es una fecha ISO (contiene guiones)
      return input.includes('-') ? new Date(input).getTime() : Number(input);
    }
    return Date.now();
  } catch (e) {
    console.error('[ContractVersionHistory] Error parsing timestamp:', e);
    return Date.now();
  }
};

// Definir interfaz para el objeto de código fuente
interface SourceCodeObject {
  content: string;
  [key: string]: any;
}

// Función de utilidad para procesar código fuente
const parseSourceCode = (contract: DeployedContract): string => {
  try {
    const sourceCode = contract.source_code;
    
    // Si no hay código fuente, retornar string vacío
    if (!sourceCode) {
      return '';
    }

    // Caso 1: source_code es un string directo
    if (typeof sourceCode === 'string') {
      const trimmed = sourceCode.trim();
      // Caso 2: source_code es un string JSON
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed) as SourceCodeObject;
          return parsed.content || trimmed;
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }
    
    // Caso 3: source_code es un objeto con content (este caso no debería ocurrir según el tipo,
    // pero lo mantenemos por compatibilidad)
    const sourceCodeAsAny = sourceCode as any;
    if (sourceCodeAsAny && typeof sourceCodeAsAny === 'object' && 'content' in sourceCodeAsAny) {
      return sourceCodeAsAny.content;
    }
    
    return '';
  } catch (e) {
    console.error('[ContractVersionHistory] Error parsing source code:', e);
    return '';
  }
};

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
  isCurrentContext: boolean;
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
  const [lastLoadParams, setLastLoadParams] = useState<{
    contractAddress?: string;
    activeContextId?: string;
    contextHash?: string;
  }>();
  const databaseService = DatabaseService.getInstance();
  const { address } = useAccount();

  // Compute a hash of conversation contexts for comparison
  const computeContextHash = useCallback((contexts: ConversationContext[]) => {
    return contexts.map(c => `${c.id}-${c.name}`).join('|');
  }, []);

  // Manejadores de eventos
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLoadVersionClick = (e: React.MouseEvent, version: ContractVersion) => {
    e.stopPropagation();
    
    // Evitar recargar la misma versión si ya está seleccionada
    if (selectedVersion === version.id) {
      console.log('[ContractVersionHistory] Skipping reload of already selected version:', version.id);
      return;
    }
    
    handleLoadVersion(version);
  };

  const handleViewConversationClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    onViewConversation(conversationId);
  };

  // Optimized version loading
  useEffect(() => {
    const loadVersions = async () => {
      // Skip if no wallet address
      if (!address) {
        console.log('[ContractVersionHistory] No wallet address available');
        return;
      }

      // Check if we need to reload based on params
      const currentContextHash = computeContextHash(conversationContexts);
      if (
        lastLoadParams?.contractAddress === contractAddress &&
        lastLoadParams?.activeContextId === activeContextId &&
        lastLoadParams?.contextHash === currentContextHash
      ) {
        console.log('[ContractVersionHistory] Skipping reload - params unchanged');
        return;
      }

      setIsLoading(true);
      
      try {
        console.log('[ContractVersionHistory] Loading versions with params:', {
          contractAddress,
          activeContextId,
          conversationContexts
        });
        
        const deployedContracts = await databaseService.getDeployedContracts(address);
        
        // Process contracts and update state
        const allVersions = await processVersions(
          deployedContracts,
          contractAddress,
          activeContextId,
          conversationContexts
        );
        
        setVersions(allVersions);
        setLastLoadParams({
          contractAddress,
          activeContextId,
          contextHash: currentContextHash
        });
      } catch (error) {
        console.error('[ContractVersionHistory] Error loading versions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVersions();
  }, [address, contractAddress, activeContextId, conversationContexts, computeContextHash, lastLoadParams]);

  // Separate processing logic for better organization
  const processVersions = async (
    deployedContracts: DeployedContract[],
    currentAddress?: string,
    contextId?: string,
    contexts: ConversationContext[] = []
  ): Promise<ContractVersion[]> => {
    const allVersions: ContractVersion[] = [];
    
    // Process deployed contracts
    const relevantContracts = deployedContracts.filter((contract: DeployedContract) => {
      const isActiveDeployment = currentAddress && 
        contract.contract_address?.toLowerCase() === currentAddress.toLowerCase();
      const belongsToCurrentContext = contract.conversation_id === contextId;
      return isActiveDeployment || belongsToCurrentContext;
    });

    // Process each contract
    for (const contract of relevantContracts) {
      try {
        const version = await processContractToVersion(
          contract,
          currentAddress,
          contextId,
          contexts
        );
        if (version) {
          allVersions.push(version);
        }
      } catch (error) {
        console.error('[ContractVersionHistory] Error processing contract:', error);
      }
    }

    // Process non-deployed versions from current context
    if (contextId) {
      const currentContext = contexts.find(ctx => ctx.id === contextId);
      if (currentContext?.virtualFiles) {
        const solidityFiles = Object.entries(currentContext.virtualFiles)
          .filter(([_, file]) => (file as VirtualFile).language === 'solidity');

        for (const [path, file] of solidityFiles) {
          const isAlreadyIncluded = allVersions.some(
            version => 
              version.conversationId === contextId && 
              version.sourceCode === (file as VirtualFile).content
          );

          if (!isAlreadyIncluded) {
            allVersions.push({
              id: `${contextId}_${generateUUID()}`,
              name: path.split('/').pop() || `Draft in ${currentContext.name || 'Current Chat'}`,
              timestamp: (file as VirtualFile).timestamp,
              sourceCode: (file as VirtualFile).content,
              conversationId: contextId,
              conversationName: currentContext.name || 'Unnamed Conversation',
              isDeployed: false,
              isCurrentContext: true
            });
          }
        }
      }
    }

    // Sort by timestamp descending
    return allVersions.sort((a, b) => b.timestamp - a.timestamp);
  };

  const processContractToVersion = async (
    contract: DeployedContract,
    currentAddress?: string,
    contextId?: string,
    contexts: ConversationContext[] = []
  ): Promise<ContractVersion | null> => {
    try {
      const isActiveDeployment = !!(currentAddress && 
        contract.contract_address?.toLowerCase() === currentAddress.toLowerCase());
      
      let isCurrentContext = contract.conversation_id === contextId;
      
      if ((!contract.conversation_id && isActiveDeployment && contextId) || 
          (isActiveDeployment && contextId && !isCurrentContext)) {
        contract.conversation_id = contextId;
        isCurrentContext = true;
        
        try {
          await databaseService.updateContractConversationId?.(
            contract.contract_address || '', 
            contextId
          );
        } catch (error) {
          console.warn('[ContractVersionHistory] Could not update contract conversation ID:', error);
        }
      }
      
      const context = contexts.find(ctx => ctx.id === contract.conversation_id);
      const conversationName = context?.name || (isCurrentContext ? 'Current Conversation' : 'Unknown Conversation');
      
      return {
        id: contract.contract_address || generateUUID(),
        name: contract.name || `Contract in ${conversationName}`,
        address: contract.contract_address,
        timestamp: parseTimestamp(contract.deployed_at || contract.deployedAt),
        sourceCode: parseSourceCode(contract),
        conversationId: contract.conversation_id || '',
        conversationName,
        txHash: contract.tx_hash || contract.transactionHash || '',
        isDeployed: isActiveDeployment,
        isCurrentContext
      };
    } catch (error) {
      console.error('[ContractVersionHistory] Error processing contract to version:', error);
      return null;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleLoadVersion = (version: ContractVersion) => {
    setSelectedVersion(version.id);
    onLoadVersion(version.sourceCode, version.isDeployed);
  };

  // Efecto para actualizar las versiones cuando cambia el contexto activo
  useEffect(() => {
    console.log('[ContractVersionHistory] Active context changed:', {
      activeContextId,
      versions: versions.length
    });
    
    // Actualizar el estado de isCurrentContext para todas las versiones
    setVersions(prevVersions => 
      prevVersions.map(version => ({
        ...version,
        isCurrentContext: version.conversationId === activeContextId
      }))
    );
  }, [activeContextId]);

  // Escuchar eventos de nuevas versiones de contratos
  useEffect(() => {
    const handleNewVersion = (event: CustomEvent<any>) => {
      const { sourceCode, name, conversationId, timestamp } = event.detail;
      
      console.log('[ContractVersionHistory] New contract version registered:', event.detail);
      
      // Solo procesar si hay datos válidos
      if (!sourceCode) return;
      
      // Encontrar el contexto asociado
      const context = conversationContexts.find(ctx => ctx.id === (conversationId || activeContextId));
      
      // Comprobar si ya existe una versión con el mismo código fuente en el mismo contexto
      setVersions(prevVersions => {
        // Verificar si ya existe una versión con el mismo código fuente
        const existingVersionWithSameCode = prevVersions.find(
          v => v.sourceCode === sourceCode && v.conversationId === (conversationId || activeContextId)
        );
        
        // Si ya existe una versión con el mismo código, no añadir una nueva
        if (existingVersionWithSameCode) {
          console.log('[ContractVersionHistory] Skipping duplicate version with same source code');
          return prevVersions;
        }
        
        // Si no existe, añadir la nueva versión
        return [
          {
            id: `new_${generateUUID()}`,
            name: name || 'Contract.sol',
            timestamp: timestamp || Date.now(),
            sourceCode,
            conversationId: conversationId || activeContextId || '',
            conversationName: context?.name || 'Current Conversation',
            isDeployed: false,
            isCurrentContext: (conversationId || activeContextId) === activeContextId
          },
          ...prevVersions
        ];
      });
    };
    
    // Registrar el listener para el evento
    window.addEventListener('contract-version-registered', handleNewVersion as EventListener);
    
    // Limpiar el listener cuando el componente se desmonte
    return () => {
      window.removeEventListener('contract-version-registered', handleNewVersion as EventListener);
    };
  }, [conversationContexts, activeContextId]);

  // Add event listener for custom "contract_updated" events
  useEffect(() => {
    // Crear una función local que cargue las versiones
    const refreshVersions = async () => {
      console.log('[ContractVersionHistory] Detected contract update, refreshing versions');
      
      setIsLoading(true);
      try {
        if (!address) {
          console.log('[ContractVersionHistory] No wallet address available');
          setIsLoading(false);
          return;
        }
        
        try {
          const deployedContracts = await databaseService.getDeployedContracts(address);
          console.log('[ContractVersionHistory] Loaded deployed contracts after update:', deployedContracts);
          
          // Procesar las versiones como en el useEffect original
          // Implementación simplificada para la actualización
          const processedVersions = await processVersions(
            deployedContracts, 
            contractAddress, 
            activeContextId,
            conversationContexts
          );
          
          setVersions(processedVersions);
        } catch (error) {
          console.error('[ContractVersionHistory] Error refreshing versions:', error);
        } finally {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[ContractVersionHistory] Error in refresh:', error);
        setIsLoading(false);
      }
    };
    
    // Event handler for contract updates
    const handleContractUpdate = () => {
      refreshVersions();
    };

    // Listen for custom events
    window.addEventListener('contract_updated', handleContractUpdate);
    window.addEventListener('code_updated', handleContractUpdate);
    
    // Cleanup
    return () => {
      window.removeEventListener('contract_updated', handleContractUpdate);
      window.removeEventListener('code_updated', handleContractUpdate);
    };
  }, [address, activeContextId, contractAddress, conversationContexts, databaseService]);

  return (
    <div className={`flex flex-col ${isExpanded ? 'h-80' : 'h-10'} transition-all duration-300 ease-in-out overflow-hidden`}>
      {/* Header with toggle button */}
      <div 
        className="flex-none h-10 border-b border-gray-700/70 px-4 flex items-center justify-between bg-gradient-to-r from-gray-800/95 to-gray-850/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm cursor-pointer transition-colors hover:bg-gray-750/90"
        onClick={handleToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-full bg-gray-700/70 text-blue-400">
            <ClockIcon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-medium text-gray-300">Contract Version History</h3>
          {versions.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs ml-2">
              {versions.length}
            </span>
          )}
        </div>
        <button
          className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/70 transition-all duration-200"
          title={isExpanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExpand();
          }}
        >
          <svg 
            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* No versions state */}
      {!isLoading && versions.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
          <div className="p-4 rounded-full bg-gray-800/80 mb-4">
            <DocumentDuplicateIcon className="w-10 h-10 text-gray-600" />
          </div>
          <p className="text-center font-medium text-gray-300">No version history available</p>
          <p className="text-sm text-gray-500 mt-2 text-center max-w-xs">
            Contract versions will appear here when you deploy or save different versions of your contract.
          </p>
        </div>
      )}

      {/* Versions list */}
      {!isLoading && versions.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="space-y-3">
            {versions.map((version) => (
              <div 
                key={version.id}
                className={`p-3.5 rounded-lg border shadow-sm transition-all duration-200 ${
                  selectedVersion === version.id
                    ? 'bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/40 shadow-blue-900/20'
                    : 'bg-gray-800/60 border-gray-700/60 hover:bg-gray-750/70 hover:border-gray-600/70 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-white">{version.name}</span>
                    {version.conversationId !== activeContextId && (
                      <span className="text-xs text-yellow-400 mt-1">
                        From: {version.conversationName}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={(e) => handleLoadVersionClick(e, version)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 transition-all duration-200 hover:shadow-inner"
                      title="Load this version into editor"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleViewConversationClick(e, version.conversationId)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 transition-all duration-200 hover:shadow-inner"
                      title="View conversation"
                    >
                      <ChatBubbleLeftRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-2.5 text-sm grid grid-cols-2 gap-2">
                  <div className="flex items-center text-gray-500">
                    <ClockIcon className="w-3.5 h-3.5 mr-1.5 inline text-gray-400" />
                    <span className="truncate">{formatDate(version.timestamp)}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-500">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 mr-1.5 inline text-gray-400" />
                    <span className="truncate">{version.conversationName}</span>
                  </div>
                  
                  {version.address && (
                    <div className="flex items-center text-gray-400 col-span-2 mt-0.5">
                      <LinkIcon className="w-3.5 h-3.5 mr-1.5 inline" />
                      <span className={`truncate ${
                        version.isDeployed 
                          ? 'text-green-400' 
                          : 'text-yellow-400'
                      }`}>
                        {version.address.substring(0, 6)}...{version.address.substring(38)}
                      </span>
                    </div>
                  )}
                  
                  {version.txHash && (
                    <div className="flex items-center text-gray-400 mt-0.5 text-xs col-span-2">
                      <span className="text-gray-500">TX: </span>
                      <span className="ml-1 text-blue-400 truncate">{version.txHash}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {version.conversationId === activeContextId && (
                    <div className="px-2.5 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full inline-flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      Current Context
                    </div>
                  )}
                  
                  {/* Status Indicator - Combined version */}
                  {version.isDeployed ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                      Deployed
                    </div>
                  ) : version.address ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                      Draft
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-500/20 text-gray-400 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
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
  );
};

export default ContractVersionHistory; 