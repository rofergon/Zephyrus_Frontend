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

// Función de utilidad para procesar código fuente
const parseSourceCode = (contract: DeployedContract): string => {
  try {
    // Caso 1: sourceCode es un string directo
    if (typeof contract.sourceCode === 'string') {
      return contract.sourceCode;
    }
    
    // Caso 2: source_code es un string JSON
    if (typeof contract.source_code === 'string') {
      const trimmed = contract.source_code.trim();
      if (trimmed.startsWith('{')) {
        try {
          return JSON.parse(trimmed).content || trimmed;
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }
    
    // Caso 3: sourceCode es un objeto con content
    if (contract.sourceCode?.content) {
      return contract.sourceCode.content;
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
  const databaseService = DatabaseService.getInstance();
  const { address } = useAccount();

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

  // Obtener los contratos de la base de datos
  useEffect(() => {
    const loadVersions = async () => {
      setIsLoading(true);
      
      try {
        const allVersions: ContractVersion[] = [];
        
        if (!address) {
          console.log('[ContractVersionHistory] No wallet address available');
          setIsLoading(false);
          return;
        }
        
        console.log('[ContractVersionHistory] Loading versions with params:', {
          contractAddress,
          activeContextId,
          conversationContexts
        });
        
        try {
          const deployedContracts = await databaseService.getDeployedContracts(address);
          console.log('[ContractVersionHistory] Loaded deployed contracts:', deployedContracts);
          
          // Identificar el contrato actualmente desplegado
          const currentlyDeployedContract = contractAddress && 
            deployedContracts.find((contract: DeployedContract) => 
              contract.contract_address?.toLowerCase() === contractAddress?.toLowerCase()
            );
            
          console.log('[ContractVersionHistory] Currently deployed contract:', currentlyDeployedContract);
          
          // Filtrar los contratos que pertenecen al contexto actual o que están activamente desplegados
          const relevantContracts = deployedContracts.filter((contract: DeployedContract) => {
            // Si el contrato está desplegado activamente, incluirlo
            const isActiveDeployment = contractAddress && 
              contract.contract_address?.toLowerCase() === contractAddress?.toLowerCase();
              
            // Si el contrato pertenece al contexto actual, incluirlo
            const belongsToCurrentContext = contract.conversation_id === activeContextId;
            
            // Incluir si cumple alguna de las condiciones
            return isActiveDeployment || belongsToCurrentContext;
          });
          
          console.log('[ContractVersionHistory] Filtered contracts for current context:', {
            total: deployedContracts.length,
            filtered: relevantContracts.length,
            activeContextId
          });
          
          // Procesar solo los contratos relevantes
          relevantContracts.forEach((contract: DeployedContract) => {
            const isActiveDeployment = !!(contractAddress && 
              contract.contract_address?.toLowerCase() === contractAddress?.toLowerCase());
            
            // CORRECCIÓN: Verificar si el ID de conversación del contrato coincide con el
            // ID del contexto actual, o si debe asignarse al contexto actual
            let isCurrentContext = contract.conversation_id === activeContextId;
            
            // Si el contrato no tiene un ID de conversación pero está desplegado en el contexto actual,
            // o si es el contrato activo y estamos en el contexto activo, asignarle el contexto actual
            if ((!contract.conversation_id && isActiveDeployment && activeContextId) || 
                (isActiveDeployment && activeContextId && !isCurrentContext)) {
              console.log('[ContractVersionHistory] Assigning current context to deployed contract:', contractAddress);
              contract.conversation_id = activeContextId;
              isCurrentContext = true;
              
              // Intentar actualizar la base de datos (esta función se implementará después)
              try {
                databaseService.updateContractConversationId?.(contract.id || '', activeContextId);
              } catch (error) {
                console.warn('[ContractVersionHistory] Could not update contract conversation ID in database:', error);
              }
            }
            
            // Encontrar el contexto de la conversación
            const conversationContext = conversationContexts.find(ctx => 
              ctx.id === contract.conversation_id
            );
            
            console.log(`[ContractVersionHistory] Processing contract:`, {
              address: contract.contract_address,
              isActiveDeployment,
              isCurrentContext,
              conversationId: contract.conversation_id,
              activeContextId,
              foundContext: !!conversationContext
            });
            
            let timestamp = parseTimestamp(contract.deployedAt || contract.deployed_at);
            let sourceCodeContent = parseSourceCode(contract);
            
            // Determinar el nombre de la conversación
            let conversationName = 'Unknown Conversation';
            if (conversationContext) {
              conversationName = conversationContext.name;
            } else if (isCurrentContext) {
              // Si pertenece al contexto actual pero no encontramos el contexto
              conversationName = 'Current Conversation';
            }
            
            allVersions.push({
              id: contract.id || generateUUID(),
              name: contract.name || `Contract in ${conversationName}`,
              address: contract.contract_address,
              timestamp,
              sourceCode: sourceCodeContent,
              conversationId: contract.conversation_id || '',
              conversationName,
              txHash: contract.tx_hash || contract.transactionHash || '',
              isDeployed: isActiveDeployment,
              isCurrentContext
            });
          });
        } catch (error) {
          console.error('[ContractVersionHistory] Error fetching deployed contracts:', error);
        }
        
        // Procesar versiones no desplegadas de los contextos
        conversationContexts.forEach(context => {
          // Solo procesar el contexto actual
          if (context.id !== activeContextId) {
            console.log('[ContractVersionHistory] Skipping non-active context:', context.id);
            return;
          }
          
          const hasSolidityFiles = context.virtualFiles && 
            Object.entries(context.virtualFiles).some(([_, file]) => 
              (file as VirtualFile).language === 'solidity'
            );
            
          if (hasSolidityFiles) {
            console.log('[ContractVersionHistory] Processing Solidity files from current context:', context.id);
            const solidityFiles = Object.entries(context.virtualFiles)
              .filter(([_, file]) => (file as VirtualFile).language === 'solidity');
              
            solidityFiles.forEach(([path, file]) => {
              const isAlreadyIncluded = allVersions.some(
                (version) => 
                  version.conversationId === context.id && 
                  version.sourceCode === (file as VirtualFile).content
              );
              
              if (!isAlreadyIncluded) {
                allVersions.push({
                  id: `${context.id}_${generateUUID()}`,
                  name: path.split('/').pop() || `Draft in ${context.name || 'Current Chat'}`,
                  timestamp: (file as VirtualFile).timestamp,
                  sourceCode: (file as VirtualFile).content,
                  conversationId: context.id,
                  conversationName: context.name || 'Unnamed Conversation',
                  isDeployed: false,
                  isCurrentContext: context.id === activeContextId
                });
              }
            });
          }
        });
        
        allVersions.sort((a, b) => b.timestamp - a.timestamp);
        console.log('[ContractVersionHistory] Final versions:', allVersions);
        
        setVersions(allVersions);
      } catch (error) {
        console.error('[ContractVersionHistory] Error loading versions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVersions();
  }, [conversationContexts, contractAddress, databaseService, address, activeContextId]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleLoadVersion = (version: ContractVersion) => {
    setSelectedVersion(version.id);
    onLoadVersion(version.sourceCode, version.isDeployed);
  };

  // Helper function to process deployed contracts into contract versions
  const processDeployedContractsToVersions = (
    deployedContracts: DeployedContract[],
    currentContractAddress?: string,
    contexts: ConversationContext[] = [],
    currentContextId?: string
  ): ContractVersion[] => {
    const allVersions: ContractVersion[] = [];
    
    // Find currently deployed contract
      
    // Filter contracts relevant to the current context
    const relevantContracts = deployedContracts.filter((contract: DeployedContract) => {
      // If the contract is currently deployed, include it
      const isActiveDeployment = currentContractAddress && 
        contract.contract_address?.toLowerCase() === currentContractAddress?.toLowerCase();
        
      // If the contract belongs to the current context, include it
      const belongsToCurrentContext = contract.conversation_id === currentContextId;
      
      return isActiveDeployment || belongsToCurrentContext;
    });
    
    console.log('[ContractVersionHistory] Filtered contracts for current context:', {
      total: deployedContracts.length,
      filtered: relevantContracts.length,
      activeContextId: currentContextId
    });
    
    // Convert contracts to versions
    relevantContracts.forEach((contract: DeployedContract) => {
      try {
        const sourceCode = parseSourceCode(contract);
        const timestamp = parseTimestamp(contract.deployed_at || contract.created_at);
        
        // Find context name
        const conversationContext = contexts.find(
          context => context.id === contract.conversation_id
        );
        const conversationName = conversationContext?.name || 'Unknown Context';
        
        // Create version object
        const version: ContractVersion = {
          id: contract.id || generateUUID(),
          name: contract.contract_name || 'Unnamed Contract',
          address: contract.contract_address,
          timestamp: timestamp,
          sourceCode: sourceCode,
          conversationId: contract.conversation_id || '',
          conversationName: conversationName,
          txHash: contract.tx_hash,
          isDeployed: !!contract.contract_address,
          isCurrentContext: contract.conversation_id === currentContextId
        };
        
        allVersions.push(version);
      } catch (error) {
        console.error('[ContractVersionHistory] Error processing contract:', error, contract);
      }
    });
    
    // Sort versions by timestamp (newest first)
    return allVersions.sort((a, b) => b.timestamp - a.timestamp);
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
          const processedVersions = processDeployedContractsToVersions(
            deployedContracts, 
            contractAddress, 
            conversationContexts, 
            activeContextId
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
    <div className={`bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl overflow-hidden transition-all duration-300 ${
      isExpanded ? 'h-80' : 'h-12'
    }`}>
      {/* Header with toggle */}
      <div 
        className="h-12 px-4 flex items-center justify-between bg-gray-800/95 cursor-pointer"
        onClick={handleToggleExpand}
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
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{version.name}</span>
                        {version.conversationId !== activeContextId && (
                          <span className="text-xs text-yellow-400 mt-1">
                            From: {version.conversationName}
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => handleLoadVersionClick(e, version)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="Load this version into editor"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleViewConversationClick(e, version.conversationId)}
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
                    
                    {/* Status Indicator - Combined version */}
                    <div className="mt-2 flex items-center gap-2">
                      {version.isDeployed ? (
                        <div className="flex items-center gap-2 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          Currently Deployed
                        </div>
                      ) : version.address ? (
                        <div className="flex items-center gap-2 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                          <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                          Previously Deployed
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
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