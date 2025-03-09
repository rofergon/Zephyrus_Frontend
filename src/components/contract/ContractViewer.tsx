import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import {   MagnifyingGlassIcon,  BoltIcon,  RocketLaunchIcon,} from '@heroicons/react/24/outline';
import FunctionCard from '../FunctionCard';
import { ContractArtifact, ConsoleMessage } from '../../types/contracts';
import { useDeployment } from '../../services/deploymentService';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import 'react-resizable/css/styles.css';
import ContractVersionHistory from './ContractVersionHistory';
import { ConversationContext } from '../../services/conversationService';
import DatabaseService from '../../services/databaseService';
import { CommandLineIcon } from '@heroicons/react/24/outline';

interface ContractViewerProps {
  currentArtifact: ContractArtifact | null;
  currentCode: string;
  showCodeEditor: boolean;
  isMaximized: boolean;
  consoleHeight: number;
  consoleMessages: ConsoleMessage[];
  onCodeChange: (value: string | undefined) => void;
  onCompile: (code: string) => void;
  onConsoleResize: (height: number) => void;
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<typeof monaco | null>;
  conversationId: string;
  addConsoleMessage: (message: string, type: ConsoleMessage['type']) => void;
  conversationContexts: ConversationContext[];
  onViewConversation: (contextId: string) => void;
  onArtifactUpdated: (artifact: ContractArtifact) => void;
}

// Memoizar el componente FunctionCard
const MemoizedFunctionCard = memo(FunctionCard, (prev, next) => {
  return (
    prev.func.name === next.func.name &&
    prev.contractAddress === next.contractAddress &&
    prev.deploymentResult?.contractAddress === next.deploymentResult?.contractAddress
  );
});

const ContractViewer: React.FC<ContractViewerProps> = ({
  currentArtifact,
  currentCode,
  showCodeEditor,
  isMaximized: isMaximizedProp,
  consoleHeight,
  consoleMessages,
  onCodeChange,
  onCompile,
  onConsoleResize,
  editorRef,
  monacoRef,
  conversationId,
  addConsoleMessage,
  conversationContexts,
  onViewConversation,
  onArtifactUpdated,
}) => {
  const compileTimeoutRef = useRef<NodeJS.Timeout>();
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const consoleContentRef = useRef<HTMLDivElement>(null);
  const { deployContract } = useDeployment();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isMaximized] = useState(isMaximizedProp);
  const [] = useState(consoleHeight);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [isLoadedVersionDeployed, setIsLoadedVersionDeployed] = useState(false);
  const [isNewlyDeployed, setIsNewlyDeployed] = useState(false);
  const [] = useState(false);
  const [constructorArgs, setConstructorArgs] = useState<any[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [] = useState(true);
  const [] = useState<'functions' | 'events' | 'demo'>('functions');
  const [, setError] = useState<string | null>(null);
  const previousCodeRef = useRef(currentCode);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isDeploymentCollapsed, setIsDeploymentCollapsed] = useState(false);

  // Memoizar el tema del editor
  const editorTheme = useMemo(() => ({
    base: 'vs-dark' as monaco.editor.BuiltinTheme,
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'D4D4D4' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'brackets', foreground: 'FFD700' }
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#2F3337',
      'editorCursor.foreground': '#FFFFFF',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editorError.foreground': '#F14C4C',
      'editorError.border': '#F14C4C',
      'editorWarning.foreground': '#CCA700',
      'editorWarning.border': '#CCA700',
      'editorGutter.background': '#1E1E1E',
      'editorGutter.modifiedBackground': '#4B9FD6',
      'editorGutter.addedBackground': '#487E02',
      'editorGutter.deletedBackground': '#F14C4C',
      'editorOverviewRuler.errorForeground': '#F14C4C',
      'editorOverviewRuler.warningForeground': '#CCA700'
    }
  }), []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    onCodeChange(value);
  }, [onCodeChange]);

  const resetDeploymentState = useCallback(() => {
    setDeploymentResult(null);
    setIsLoadedVersionDeployed(false);
    setIsNewlyDeployed(false);
    setConstructorArgs([]);
  }, []);

  // Memoizar la función getConstructor
  const getConstructor = useCallback(() => {
    if (!currentArtifact?.abi) return null;
    return currentArtifact.abi.find((item: any) => item.type === 'constructor');
  }, [currentArtifact?.abi]);

  // Memoizar el resultado del constructor
  const constructor = useMemo(() => getConstructor(), [getConstructor]);

  // Memoizar la función generateCodeHash
  const generateCodeHash = useCallback((code: any): string => {
    let codeString = '';
    if (typeof code === 'string') {
      codeString = code;
    } else if (typeof code === 'object' && code !== null) {
      codeString = code.content || code.sourceCode || JSON.stringify(code);
    } else {
      codeString = String(code || '');
    }
    return codeString.replace(/\s+/g, '').trim();
  }, []);

  // Efecto para sincronizar la dirección del contrato con la versión actual del código
  useEffect(() => {
    const syncContractAddress = async () => {
      if (!currentCode || !conversationContexts || !address) return;
      
      console.log('[ContractViewer] Syncing contract address for current code');
      
      try {
        // Generar un hash del código actual
        const newCodeHash = generateCodeHash(currentCode);
        
        const databaseService = DatabaseService.getInstance();
        const deployedContracts = await databaseService.getDeployedContracts(address);
        
        console.log('[ContractViewer] Found deployed contracts:', deployedContracts);
        
        // Buscar el contrato desplegado que coincida con este código
        const matchingContract = deployedContracts.find((contract: any) => {
          const contractHash = generateCodeHash(contract.sourceCode || contract.source_code);
          const matches = contractHash === newCodeHash;
          console.log('[ContractViewer] Comparing hashes:', {
            contractHash,
            newCodeHash,
            matches,
            address: contract.contract_address
          });
          return matches;
        });
        
        if (matchingContract?.contract_address) {
          console.log('[ContractViewer] Found matching deployed contract:', matchingContract);
          // Si encontramos el contrato desplegado, actualizar el estado
          setDeploymentResult({
            success: true,
            contractAddress: matchingContract.contract_address,
            transactionHash: matchingContract.tx_hash || matchingContract.transactionHash || '',
            constructor: matchingContract.constructor || { inputs: [] },
            timestamp: Date.now(),
            conversationId: matchingContract.conversation_id || conversationId
          });
          setIsLoadedVersionDeployed(true);
        } else {
          console.log('[ContractViewer] No matching deployed contract found');
          // Si no encontramos coincidencia, limpiar el estado de despliegue
          setDeploymentResult(null);
          setIsLoadedVersionDeployed(false);
        }
      } catch (error) {
        console.error('Error syncing contract address:', error);
      }
    };

    syncContractAddress();
  }, [currentCode, conversationContexts, address]);

  // Efecto para escuchar eventos de carga de versiones
  useEffect(() => {
    const handleVersionLoaded = (event: CustomEvent) => {
      const deploymentData = event.detail;
      console.log('[ContractViewer] Version loaded event received:', deploymentData);
      
      // Actualizar el estado del resultado de despliegue
      setDeploymentResult(deploymentData);
      
      // Actualizar explícitamente el estado de despliegue basado en los datos recibidos
      setIsLoadedVersionDeployed(deploymentData.isDeployed || false);
      setIsNewlyDeployed(false); // Esto es una versión cargada, no recién desplegada
      
      // Lo más importante: si el currentArtifact existe, actualizamos su dirección
      if (currentArtifact && deploymentData.contractAddress) {
        console.log('[ContractViewer] Updating contract artifact address:', deploymentData.contractAddress);
        // Clonar el artefacto para evitar mutaciones directas del estado
        const updatedArtifact = {
          ...currentArtifact,
          address: deploymentData.contractAddress,
          // Agregar explícitamente información adicional que pueda ser útil
          transactionHash: deploymentData.transactionHash || '',
          isDeployed: deploymentData.isDeployed || false
        };
        
        // Actualizar el artefacto con la nueva dirección
        onArtifactUpdated(updatedArtifact);
        
        // Guardar los datos para posible restauración después de compilación
        const addressToPreserve = deploymentData.contractAddress;
        
        // Programar una comprobación posterior para asegurar que la dirección permanezca 
        // después de cualquier posible compilación
        setTimeout(() => {
          // Verificar si la dirección sigue siendo la misma
          if (currentArtifact && (!currentArtifact.address || currentArtifact.address !== addressToPreserve)) {
            console.log('[ContractViewer] Post-check: Restoring contract address that was lost:', addressToPreserve);
            const restoredArtifact = {
              ...currentArtifact,
              address: addressToPreserve,
              isDeployed: deploymentData.isDeployed || false
            };
            onArtifactUpdated(restoredArtifact);
            
            // También actualizar el estado de despliegue nuevamente
            setIsLoadedVersionDeployed(deploymentData.isDeployed || false);
          }
        }, 1500); // Esperar un tiempo suficiente para que ocurra cualquier compilación
      }
    };

    // Añadir el listener
    window.addEventListener('contract-version-loaded', handleVersionLoaded as EventListener);

    // Limpiar el listener
    return () => {
      window.removeEventListener('contract-version-loaded', handleVersionLoaded as EventListener);
    };
  }, [currentArtifact]);

  // Efecto para detectar cuando se registra una nueva versión del contrato
  useEffect(() => {
    const handleNewVersion = (event: CustomEvent) => {
      console.log('[ContractViewer] New contract version registered:', event.detail);
      
      // Cuando se registra una nueva versión, debemos resetear el estado de despliegue
      // ya que esta versión acaba de crearse y no puede estar desplegada
      resetDeploymentState();
    };

    // Añadir el listener para nuevas versiones
    window.addEventListener('contract-version-registered', handleNewVersion as EventListener);

    // Limpiar el listener
    return () => {
      window.removeEventListener('contract-version-registered', handleNewVersion as EventListener);
    };
  }, [resetDeploymentState]);

  // Nuevo efecto para cargar el estado inicial del contrato
  useEffect(() => {
    const loadInitialContractState = async () => {
      if (!currentArtifact?.address || !address || !conversationId) return;
      
      console.log('[ContractViewer] Loading initial contract state:', {
        address: currentArtifact.address,
        isLoadedVersionDeployed,
        conversationId,
        currentArtifact
      });

      try {
        // Obtener el contrato de la base de datos para asegurar que tenemos toda la información
        const databaseService = DatabaseService.getInstance();
        const deployedContracts = await databaseService.getDeployedContracts(address);
        
        // Buscar el contrato actual en los desplegados
        const currentContract = deployedContracts.find(
          (contract: any) => currentArtifact?.address && 
            contract.contract_address?.toLowerCase() === currentArtifact.address.toLowerCase()
        );

        if (currentContract) {
          console.log('[ContractViewer] Found current contract in database:', currentContract);
          // Establecer el estado inicial del deployment result
          setDeploymentResult({
            success: true,
            contractAddress: currentContract.contract_address,
            transactionHash: currentContract.tx_hash || currentContract.transactionHash || '',
            constructor: currentContract.constructor || { inputs: [] },
            timestamp: Date.now(),
            conversationId: currentContract.conversation_id || conversationId
          });
          setIsLoadedVersionDeployed(true);
        }
      } catch (error) {
        console.error('[ContractViewer] Error loading initial contract state:', error);
      }
    };

    loadInitialContractState();
  }, [currentArtifact, address, conversationId]);

  // Efecto adicional para sincronizar el estado cuando cambia el conversationId
  useEffect(() => {
    if (!conversationId) return;
    
    console.log('[ContractViewer] Conversation ID changed:', conversationId);
    
    // Si tenemos un resultado de despliegue, actualizamos su conversationId
    if (deploymentResult?.contractAddress) {
      setDeploymentResult((prev: any) => ({
        ...prev,
        conversationId
      }));
    }
  }, [conversationId]);

  // Actualizar el objeto de despliegue cuando la dirección cambia
  // o cuando se carga una versión desde el historial
  useEffect(() => {
    console.log('[ContractViewer] Deployment effect triggered:', {
      contractAddress: currentArtifact?.address,
      currentArtifactAddress: currentArtifact?.address,
      isLoadedVersionDeployed
    });
    
    // Guarda el estado anterior para poder restaurarlo si es necesario
    const prevDeploymentResult = deploymentResult;
    
    if (currentArtifact?.address) {
      if (isLoadedVersionDeployed) {
        // Si la versión cargada es la desplegada actualmente, mostrar su dirección
        console.log('[ContractViewer] Setting deployment result for currently deployed contract:', currentArtifact.address);
        
        // Preservar los datos existentes para evitar sobreescribirlos
        setDeploymentResult((prev: any) => {
          const newResult = {
            success: true,
            contractAddress: currentArtifact.address,
            // @ts-ignore - estos campos pueden no estar en la definición pero los necesitamos
            transactionHash: currentArtifact.transactionHash || (prev?.transactionHash || ''),
            // @ts-ignore - estos campos pueden no estar en la definición pero los necesitamos
            constructor: currentArtifact.constructor || (prev?.constructor || { inputs: [] }),
            conversationId,
            timestamp: Date.now(),
            isDeployed: true
          };
          console.log('[ContractViewer] Updated deployment result:', newResult);
          return newResult;
        });
      } else if (prevDeploymentResult?.contractAddress === currentArtifact.address) {
        // Esta condición es para evitar el cambio a versión histórica cuando en realidad
        // debería seguir considerándose como desplegada
        console.log('[ContractViewer] Preserving deployment status for address:', currentArtifact.address);
        setIsLoadedVersionDeployed(true);
      } else {
        // Si la versión tiene dirección pero no es la actualmente desplegada (histórica)
        console.log('[ContractViewer] Loaded historical version with address:', currentArtifact.address);
        // No anular el resultado de despliegue si la dirección coincide
        if (prevDeploymentResult?.contractAddress !== currentArtifact.address) {
          setDeploymentResult(null);
        }
      }
    } else if (prevDeploymentResult && isLoadedVersionDeployed) {
      // Si tenemos un resultado de despliegue pero el artefacto perdió su dirección
      // (probablemente durante compilación), restaurar la dirección
      console.log('[ContractViewer] Restoring address from deployment result:', prevDeploymentResult.contractAddress);
      if (currentArtifact) {
        const updatedArtifact = {
          ...currentArtifact,
          address: prevDeploymentResult.contractAddress
        };
        onArtifactUpdated(updatedArtifact);
      }
    } else {
      // Sin dirección y sin previo despliegue significa versión no desplegada
      console.log('[ContractViewer] No address present and no previous deployment, clearing deployment result');
      setDeploymentResult(null);
    }
  }, [currentArtifact, isLoadedVersionDeployed, conversationId]);

  // Efecto adicional para asegurar que el código se cargue después de recargar la página
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !currentCode) return;

    console.log('[ContractViewer] Ensuring code is loaded in editor after page reload');
    
    try {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      
      // Ensure currentCode is a string
      const codeString = typeof currentCode === 'string' 
        ? currentCode 
        : typeof currentCode === 'object'
          ? currentCode.toString && currentCode.toString !== Object.prototype.toString
            ? currentCode.toString()
            : JSON.stringify(currentCode, null, 2)
          : String(currentCode);
      
      let model = editor.getModel();
      
      // Si no hay modelo, crear uno nuevo
      if (!model) {
        console.log('[ContractViewer] Creating new model for editor');
        model = monaco.editor.createModel(
          codeString,
          'solidity',
          monaco.Uri.parse('file:///workspace/contract.sol')
        );
        editor.setModel(model);
      } else {
        // Si el modelo existe, verificar si necesita actualización
        const currentValue = model.getValue();
        if (currentValue !== codeString) {
          console.log('[ContractViewer] Updating editor model with current code');
          model.pushEditOperations(
            [],
            [{
              range: model.getFullModelRange(),
              text: codeString
            }],
            () => null
          );
        }
      }
      
      // Compilar el código si es necesario
      if (currentCode.trim().length > 10) {
        onCompile(currentCode);
      }
    } catch (error) {
      console.error('[ContractViewer] Error initializing editor model:', error);
    }
  }, [editorRef.current, monacoRef.current, currentCode, onCompile]);

  // Efecto para escuchar eventos de código actualizado desde otros componentes
  useEffect(() => {
    const handleCodeUpdated = (event: CustomEvent) => {
      if (!event.detail || !editorRef.current || !monacoRef.current) return;
      
      console.log('[ContractViewer] Code changed externally, processing update');
      console.log('[ContractViewer] Event detail type:', typeof event.detail);
      console.log('[ContractViewer] Content type:', typeof event.detail.content);
      
      try {
        // Procesar el código para asegurar formato correcto
        let newCode = event.detail.content;
        
        // Ensure newCode is a string
        if (newCode === null || newCode === undefined) {
          console.error('[ContractViewer] Received null or undefined content in code_updated event');
          return;
        }
        
        // If it's an object, try to extract a string value
        if (typeof newCode === 'object') {
          console.log('[ContractViewer] Content is an object, attempting to extract string value:', JSON.stringify(newCode).substring(0, 100) + '...');
          if ('replace' in newCode) {
            newCode = newCode.replace;
            console.log('[ContractViewer] Extracted from replace property:', typeof newCode);
          } else if ('content' in newCode) {
            newCode = newCode.content;
            console.log('[ContractViewer] Extracted from content property:', typeof newCode);
          } else if ('toString' in newCode && newCode.toString !== Object.prototype.toString) {
            newCode = newCode.toString();
            console.log('[ContractViewer] Converted using toString method:', typeof newCode);
          } else {
            // Convert object to JSON string as fallback
            try {
              newCode = JSON.stringify(newCode, null, 2);
              console.warn('[ContractViewer] Converted object to JSON string:', newCode.substring(0, 100) + '...');
            } catch (err) {
              console.error('[ContractViewer] Failed to convert object to string:', err);
              return;
            }
          }
        }
        
        // Final check to ensure we have a string
        if (typeof newCode !== 'string') {
          console.error('[ContractViewer] Unable to convert content to string, type is:', typeof newCode);
          newCode = String(newCode);
          console.log('[ContractViewer] Forcibly converted to string using String()');
        }
        
        console.log('[ContractViewer] Updating model with new code');
        
        // Normalizar los saltos de línea
        newCode = newCode.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Si el código viene con marcadores de bloque de código, eliminarlos
        if (newCode.startsWith('```') && newCode.endsWith('```')) {
          newCode = newCode
            .replace(/^```[^\n]*\n/, '') // Eliminar la primera línea con ```
            .replace(/```$/, '')         // Eliminar el último ```
            .trim();
        }

        // Asegurar que hay un salto de línea al final del archivo
        if (!newCode.endsWith('\n')) {
          newCode += '\n';
        }
        
        // Asegurar que el editor está listo
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        
        let model = editor.getModel();
        if (!model) {
          console.log('[ContractViewer] Creating new model for editor');
          model = monaco.editor.createModel(
            newCode,
            'solidity',
            monaco.Uri.parse('file:///workspace/contract.sol')
          );
          editor.setModel(model);
        } else {
          // Solo actualizar si el código es diferente
          const currentValue = model.getValue();
          if (currentValue !== newCode) {
            console.log('[ContractViewer] Updating editor with processed code');
            const position = editor.getPosition();
            model.pushEditOperations(
              [],
              [{
                range: model.getFullModelRange(),
                text: newCode
              }],
              () => null
            );
            if (position) {
              editor.setPosition(position);
            }
            // Forzar un refresco del editor
            editor.layout();
          }
        }
        
        // Programar compilación
        if (compileTimeoutRef.current) {
          clearTimeout(compileTimeoutRef.current);
        }
        
        compileTimeoutRef.current = setTimeout(() => {
          onCompile(newCode);
        }, 500);
      } catch (error) {
        console.error('[ContractViewer] Error processing code update:', error);
      }
    };
    
    // Añadir listener para el evento personalizado
    window.addEventListener('code_updated', handleCodeUpdated as EventListener);
    
    // Limpiar al desmontar
    return () => {
      window.removeEventListener('code_updated', handleCodeUpdated as EventListener);
    };
  }, [onCompile]);

  // Efecto para manejar cambios automáticos en el código
  useEffect(() => {
    if (!currentCode || !editorRef.current || !monacoRef.current) return;
    
    try {
      console.log('[ContractViewer] Code changed externally, processing update');
      
      const editor = editorRef.current;
      let model = editor.getModel();
      
      // Normalizar el código
      let normalizedCode = currentCode;
      if (typeof normalizedCode === 'string') {
        // Normalizar saltos de línea
        normalizedCode = normalizedCode.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Asegurar que hay un salto de línea al final
        if (!normalizedCode.endsWith('\n')) {
          normalizedCode += '\n';
        }
      }
      
      if (!model) {
        console.log('[ContractViewer] Creating new model for code update');
        model = monacoRef.current.editor.createModel(
          normalizedCode,
          'solidity',
          monacoRef.current.Uri.parse('file:///workspace/contract.sol')
        );
        editor.setModel(model);
      } else {
        // Solo actualizar si el código es diferente
        const currentValue = model.getValue();
        if (currentValue !== normalizedCode) {
          console.log('[ContractViewer] Updating model with new code');
          // Preservar la posición del cursor
          const position = editor.getPosition();
          const selections = editor.getSelections();
          
          model.pushEditOperations(
            [],
            [{
              range: model.getFullModelRange(),
              text: normalizedCode
            }],
            () => null
          );
          
          // Restaurar la posición del cursor y la selección
          if (position) {
            editor.setPosition(position);
          }
          if (selections) {
            editor.setSelections(selections);
          }
          
          // Forzar un refresco del layout
          editor.layout();
        }
      }

      // Limpiar timeout anterior si existe
      if (compileTimeoutRef.current) {
        clearTimeout(compileTimeoutRef.current);
      }
      
      // Programar nueva compilación con un debounce más largo
      compileTimeoutRef.current = setTimeout(() => {
        // Skip empty code or very short code that's unlikely to be a valid contract
        if (!normalizedCode || normalizedCode.trim().length < 10) {
          console.log('[ContractViewer] Skipping compilation for empty or very short code');
          return;
        }
        
        console.log('[ContractViewer] Compiling after external code change');
        onCompile(normalizedCode);
      }, 2000);
    } catch (error) {
      console.error('[ContractViewer] Error handling code change:', error);
    }
  }, [currentCode, onCompile]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (compileTimeoutRef.current) {
        clearTimeout(compileTimeoutRef.current);
      }
    };
  }, []);

  // Memoizar scrollToBottom
  const scrollToBottom = useCallback(() => {
    if (consoleContainerRef.current && autoScroll) {
      const container = consoleContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [autoScroll]);

  // Update the console messages effect
  useEffect(() => {
    if (autoScroll) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [consoleMessages, scrollToBottom]);

  // Memoizar handleConsoleScroll
  const handleConsoleScroll = useCallback(() => {
    if (consoleContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setAutoScroll(isNearBottom);
    }
  }, []);

  // Memoizar handleDeploy
  const handleDeploy = useCallback(async () => {
    if (!currentArtifact?.abi || !currentArtifact?.bytecode || !isConnected || !conversationId) {
      console.error('No contract compiled, wallet not connected, or no conversation ID');
      setError('Missing required data for deployment');
      return;
    }

    if (chainId !== 57054) {
      await switchChain?.({ chainId: 57054 });
      return;
    }

    setIsDeploying(true);
    setDeploymentResult(null);

    try {
      // Mensaje inicial de despliegue
      addConsoleMessage(
        `Starting deployment of contract ${currentArtifact.name}...`,
        'info'
      );

      // Si hay argumentos del constructor, mostrarlos
      if (constructorArgs.length > 0) {
        addConsoleMessage(
          `Constructor arguments: ${constructorArgs.join(', ')}`,
          'info'
        );
      }

      // Mensaje de espera de confirmación
      addConsoleMessage(
        'Waiting for transaction confirmation...',
        'info'
      );

      const result = await deployContract(
        currentArtifact.abi,
        currentArtifact.bytecode,
        constructorArgs,
        conversationId,
        currentArtifact.name,
        currentCode
      );

      const resultWithTimestamp = {
        ...result,
        timestamp: Date.now(),
        constructor: result.constructor || { inputs: [] },
        conversationId
      };
      
      setDeploymentResult(resultWithTimestamp);
      
      if (result.success) {
        setIsNewlyDeployed(true);
        setIsLoadedVersionDeployed(true);
        
        // Format the success message with clear line breaks for proper parsing
        const successMessage = 
          `Deployment Successful!\n` +
          `Transaction Hash: ${result.transactionHash}\n` +
          `Contract address: ${result.contractAddress}`;
        
        addConsoleMessage(successMessage, 'success');
        onConsoleResize(Math.max(consoleHeight, 200));
        
        // Also log the transaction link to console for easy access
        console.log(`[ContractViewer] Contract deployed. View transaction: https://testnet.sonicscan.org/tx/${result.transactionHash}`);
      }
    } catch (error) {
      setDeploymentResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now(),
        constructor: { inputs: [] },
        conversationId
      });
      
      // Mensaje de error detallado
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addConsoleMessage(
        `Deployment failed:\n${errorMessage}`, 
        'error'
      );
    } finally {
      setIsDeploying(false);
    }
  }, [
    currentArtifact,
    isConnected,
    conversationId,
    chainId,
    switchChain,
    deployContract,
    constructorArgs,
    currentCode,
    addConsoleMessage,
    consoleHeight,
    onConsoleResize
  ]);

  // Memoizar handleConstructorArgChange
  const handleConstructorArgChange = useCallback((index: number, value: string) => {
    setConstructorArgs(prev => {
      const newArgs = [...prev];
      newArgs[index] = value;
      return newArgs;
    });
  }, []);

  // Memoizar handleLoadVersion
  const handleLoadVersion = useCallback((sourceCode: string, isDeployed: boolean) => {
    console.log('[ContractViewer] Loading version:', { 
      isDeployed, 
      currentCodeLength: currentCode?.length, 
      newCodeLength: sourceCode?.length,
      isSameCode: sourceCode === currentCode
    });
    
    setIsLoadedVersionDeployed(isDeployed);
    
    if (sourceCode !== currentCode) {
      onCodeChange(sourceCode);
      onCompile(sourceCode);
      resetDeploymentState();
      
      const codeUpdateEvent = new CustomEvent('code_updated', { 
        detail: { content: sourceCode, isDeployed } 
      });
      window.dispatchEvent(codeUpdateEvent);
      
      console.log('[ContractViewer] Code updated and event dispatched');
    } else {
      console.log('[ContractViewer] Code unchanged, skipping update');
    }
  }, [currentCode, onCodeChange, onCompile, resetDeploymentState]);

  // Actualizar el editor cuando cambia el código
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !currentCode) return;

    try {
      console.log('[ContractViewer] Updating editor model with current code');
      
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      
      // Get or create the model
      let model = editor.getModel();
      if (!model) {
        console.log('[ContractViewer] Creating new editor model for update');
        model = monaco.editor.createModel(
          currentCode,
          'solidity',
          monaco.Uri.parse('file:///workspace/contract.sol')
        );
        editor.setModel(model);
      } else {
        // Only update if the content has changed
        const currentValue = model.getValue();
        if (currentValue !== currentCode) {
          console.log('[ContractViewer] Updating editor content');
          model.pushEditOperations(
            [],
            [{
              range: model.getFullModelRange(),
              text: currentCode
            }],
            () => null
          );
        }
      }
    } catch (error) {
      console.error('[ContractViewer] Error updating editor model:', error);
    }
  }, [currentCode]);

  if (!currentArtifact) return null;

  return (
    <div className="flex flex-col h-full relative bg-gray-900">
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Editor Container */}
        <div className={`flex-1 relative mb-4 ${!showCodeEditor ? 'hidden' : ''}`}>
          <div className="absolute inset-0 rounded-lg overflow-hidden border border-gray-700/50">
            <Editor
              height="100%"
              defaultLanguage="solidity"
              theme="solidityTheme"
              value={currentArtifact?.source || ''}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: true },
                lineNumbers: 'on' as const,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                fontSize: 14,
                tabSize: 2,
                wordWrap: 'on' as const,
                renderValidationDecorations: 'editable' as const,
                glyphMargin: true,
                lightbulb: { enabled: 'on' as monaco.editor.ShowLightbulbIconMode },
                hover: {
                  enabled: true,
                  delay: 300
                },
                suggest: {
                  showWords: true
                },
                quickSuggestions: {
                  other: true,
                  comments: true,
                  strings: true
                },
                folding: true,
                lineDecorationsWidth: 10,
                renderLineHighlight: 'all' as const,
                occurrencesHighlight: 'singleFile' as const,
                renderWhitespace: 'none' as const,
                bracketPairColorization: {
                  enabled: true
                },
                guides: {
                  bracketPairs: true,
                  bracketPairsHorizontal: true,
                  highlightActiveBracketPair: true,
                  indentation: true
                }
              }}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;

                // Establecer el valor inicial
                console.log('[ContractViewer] Editor mounted, initializing model');
                
                try {
                  // Create a new model if it doesn't exist
                  let model = editor.getModel();
                  if (!model) {
                    console.log('[ContractViewer] Creating new editor model');
                    model = monaco.editor.createModel(
                      currentCode || '',
                      'solidity',
                      monaco.Uri.parse('file:///workspace/contract.sol')
                    );
                    editor.setModel(model);
                  }

                  // Only set the value if it's different from current
                  const currentValue = model.getValue();
                  if (currentValue !== currentCode) {
                    console.log('[ContractViewer] Setting initial code:', 
                      currentCode ? `${currentCode.substring(0, 50)}...` : 'No code available');
                    model.pushEditOperations(
                      [],
                      [{
                        range: model.getFullModelRange(),
                        text: currentCode || ''
                      }],
                      () => null
                    );
                  }
                  
                  // Si hay código, programar una compilación
                  if (currentCode && currentCode.trim().length > 10) {
                    console.log('[ContractViewer] Scheduling initial compilation after editor mount');
                    setTimeout(() => {
                      onCompile(currentCode);
                    }, 500);
                  }
                } catch (error) {
                  console.error('[ContractViewer] Error initializing editor model:', error);
                }

                // Registrar el lenguaje Solidity
                monaco.languages.register({ id: 'solidity' });

                // Configurar el resaltado de sintaxis para Solidity
                monaco.languages.setMonarchTokensProvider('solidity', {
                  defaultToken: '',
                  tokenPostfix: '.sol',

                  keywords: [
                    'pragma', 'solidity', 'contract', 'library', 'interface',
                    'function', 'modifier', 'event', 'constructor',
                    'address', 'string', 'bool', 'uint', 'int', 'bytes',
                    'public', 'private', 'internal', 'external',
                    'pure', 'view', 'payable', 'virtual', 'override',
                    'returns', 'memory', 'storage', 'calldata',
                    'if', 'else', 'for', 'while', 'do', 'break', 'continue',
                    'return', 'emit', 'try', 'catch', 'revert', 'require',
                    'assert', 'mapping', 'struct', 'enum', 'this', 'super'
                  ],

                  operators: [
                    '=', '>', '<', '!', '~', '?', ':',
                    '==', '<=', '>=', '!=', '&&', '||', '++', '--',
                    '+', '-', '*', '/', '&', '|', '^', '%', '<<',
                    '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
                    '^=', '%=', '<<=', '>>=', '>>>='
                  ],

                  symbols: /[=><!~?:&|+\-*\/\^%]+/,

                  tokenizer: {
                    root: [
                      [/[a-zA-Z_]\w*/, {
                        cases: {
                          '@keywords': { token: 'keyword', foreground: '569CD6' },
                          '@default': 'identifier'
                        }
                      }],
                      [/[{}()\[\]]/, '@brackets'],
                      [/@symbols/, {
                        cases: {
                          '@operators': 'operator',
                          '@default': ''
                        }
                      }],
                      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                      [/\d+/, 'number'],
                      [/[;,.]/, 'delimiter'],
                      [/"([^"\\]|\\.)*$/, 'string.invalid'],
                      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                      [/\/\/.*$/, 'comment'],
                      [/\/\*/, 'comment', '@comment'],
                    ],
                    string: [
                      [/[^\\"]+/, 'string'],
                      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
                      [/\\.[^"]*$/, 'string.invalid']
                    ],
                    comment: [
                      [/[^\/*]+/, 'comment'],
                      [/\*\//, 'comment', '@pop'],
                      [/[\/*]/, 'comment']
                    ]
                  }
                });

                // Configurar el editor para mostrar los marcadores de error
                editor.updateOptions({
                  glyphMargin: true,
                  lineNumbers: 'on',
                  folding: true,
                  renderValidationDecorations: 'on',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  lineDecorationsWidth: 10,
                  renderLineHighlight: 'all',
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  },
                  suggest: {
                    showWords: true
                  }
                });

                // Usar el tema memoizado
                monaco.editor.defineTheme('solidityTheme', editorTheme);
                monaco.editor.setTheme('solidityTheme');

                // Configure custom decorations for errors
                const decorations = editor.createDecorationsCollection();

                // Subscribe to marker changes
                const disposable = monaco.editor.onDidChangeMarkers(([resource]) => {
                  if (resource.toString() === editor.getModel()?.uri.toString()) {
                    const markers = monaco.editor.getModelMarkers({ resource });
                    const model = editor.getModel();
                    
                    if (!model) return;

                    const newDecorations = markers.map(marker => {
                      // Get the content of the line where the error occurs
                      const lineContent = model.getLineContent(marker.startLineNumber);
                      
                      // Calculate the actual error range
                      let startColumn = marker.startColumn;
                      let endColumn = marker.endColumn;
                      
                      // If we have a specific column in the error
                      if (marker.startColumn > 0) {
                        // Look for the closest token around the error position
                        const beforeError = lineContent.substring(0, marker.startColumn - 1);
                        const afterError = lineContent.substring(marker.startColumn - 1);
                        
                        // Find the last word boundary before the error
                        const lastWord = beforeError.match(/\w+$/);
                        if (lastWord) {
                          startColumn = marker.startColumn - lastWord[0].length;
                        }
                        
                        // Find the next word boundary after the error
                        const nextWord = afterError.match(/^\w+/);
                        if (nextWord) {
                          endColumn = marker.startColumn + nextWord[0].length;
                        } else {
                          // If no word is found, try to find the next symbol
                          const nextSymbol = afterError.match(/^[^\s\w]*/);
                          if (nextSymbol) {
                            endColumn = marker.startColumn + nextSymbol[0].length;
                          }
                        }
                      } else {
                        // If no specific column, highlight the first problematic token in the line
                        const tokenMatch = lineContent.match(/[^\s]+/);
                        if (tokenMatch) {
                          startColumn = tokenMatch.index! + 1;
                          endColumn = startColumn + tokenMatch[0].length;
                        }
                      }

                      return {
                        range: new monaco.Range(
                          marker.startLineNumber,
                          startColumn,
                          marker.startLineNumber,
                          endColumn
                        ),
                        options: {
                          isWholeLine: false,
                          className: marker.severity === monaco.MarkerSeverity.Error ? 'error-decoration' : 'warning-decoration',
                          glyphMarginClassName: 'glyph-margin-error',
                          hoverMessage: { value: marker.message },
                          overviewRuler: {
                            color: marker.severity === monaco.MarkerSeverity.Error ? '#F14C4C' : '#CCA700',
                            position: monaco.editor.OverviewRulerLane.Right
                          }
                        }
                      };
                    });

                    decorations.set(newDecorations);
                  }
                });

                // Manejar cambios en el contenido
                editor.onDidChangeModelContent(() => {
                  const newCode = editor.getValue();
                  onCodeChange(newCode);
                  
                  // Limpiar timeout anterior
                  if (compileTimeoutRef.current) {
                    clearTimeout(compileTimeoutRef.current);
                  }
                  
                  // Programar nueva compilación
                  compileTimeoutRef.current = setTimeout(() => {
                    console.log('[ContractViewer] Compiling after content change');
                    onCompile(newCode);
                  }, 1000);
                });

                // Cleanup
                return () => {
                  if (compileTimeoutRef.current) {
                    clearTimeout(compileTimeoutRef.current);
                  }
                  disposable.dispose();
                };
              }}
            />
          </div>
        </div>

        {/* Function Cards Container */}
        {!showCodeEditor && (
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 overflow-auto rounded-lg border border-gray-700/50">
              <div className="min-w-[640px]">
                <div className="p-6 space-y-8">
                  {/* Contract Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0 bg-gray-800/50 p-4 rounded-lg">
                    <div className="flex-shrink-0">
                      <h2 className="text-2xl font-bold text-white">{currentArtifact.name}</h2>
                      <p className="text-base text-gray-400 mt-1">{currentArtifact.description}</p>
                    </div>
                    {currentArtifact.address && isLoadedVersionDeployed && (
                      <div className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 bg-gray-700/50 rounded-lg border border-gray-600/50">
                        <span className="text-sm text-gray-300 whitespace-nowrap">Deployed at:</span>
                        <a 
                          href={`https://testnet.sonicscan.org/address/${currentArtifact.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 break-all hover:text-blue-300 hover:underline transition-colors"
                        >
                          {currentArtifact.address}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Functions Sections with improved spacing */}
                  {/* View/Pure Functions */}
                  {currentArtifact.functions && currentArtifact.functions.length > 0 && currentArtifact.functions.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure').length > 0 && (
                    <>
                      <div className="relative">
                        <div className="sticky top-0 z-10 backdrop-blur-sm bg-gray-900/80 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 border-b border-gray-700/50">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                              <MagnifyingGlassIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">Read Functions</h3>
                              <p className="text-sm text-gray-400">Query contract state without gas fees</p>
                            </div>
                          </div>
                        </div>
                        <div className={`mt-6 grid gap-4 lg:gap-6 min-w-0
                          ${isMaximized 
                            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                            : 'grid-cols-1 sm:grid-cols-2'
                          }`}>
                          {currentArtifact.functions
                            .filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure')
                            .map((func, index) => (
                              <MemoizedFunctionCard 
                                key={index} 
                                func={func} 
                                contractAddress={currentArtifact.address}
                                abi={currentArtifact.abi}
                                deploymentResult={deploymentResult}
                              />
                            ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Write Functions - Similar grid improvement */}
                  {currentArtifact.functions.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure').length > 0 && (
                    <div className="relative mt-8">
                      <div className="sticky top-0 z-10 backdrop-blur-sm bg-gray-900/80 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 border-b border-gray-700/50">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                            <BoltIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">Write Functions</h3>
                            <p className="text-sm text-gray-400">Modify contract state (requires gas)</p>
                          </div>
                        </div>
                      </div>
                      <div className={`mt-6 grid gap-4 lg:gap-6 min-w-0
                        ${isMaximized 
                          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                          : 'grid-cols-1 sm:grid-cols-2'
                        }`}>
                        {currentArtifact.functions
                          .filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure')
                          .map((func, index) => (
                            <MemoizedFunctionCard 
                              key={index} 
                              func={func} 
                              contractAddress={currentArtifact.address}
                              abi={currentArtifact.abi}
                              deploymentResult={deploymentResult}
                            />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Console, History, and Deploy */}
      <div className="flex-none space-y-4 p-4 bg-gray-800/50 border-t border-gray-700/50 backdrop-filter backdrop-blur-sm">
        {/* Console Area */}
        <div className="rounded-lg overflow-hidden border border-gray-700/50 shadow-xl transition-all duration-300 hover:shadow-blue-900/10">
          {/* Resize Handle */}
          <div 
            className="h-2 bg-gradient-to-r from-gray-700/50 via-gray-700 to-gray-700/50 hover:bg-gradient-to-r hover:from-blue-500/50 hover:via-blue-500 hover:to-blue-500/50 cursor-ns-resize transition-all duration-300 relative group"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startHeight = consoleHeight;
              const editorContainer = document.querySelector('.flex-1.relative');
              const viewportHeight = window.innerHeight;
              const containerRect = editorContainer?.getBoundingClientRect();
              
              if (!containerRect) return;
              
              // Calculamos límites basados en el espacio disponible
              const minHeight = 100;
              const maxHeight = Math.min(
                containerRect.height * 0.6, // Máximo 60% del contenedor del editor
                viewportHeight * 0.8 // O 80% del viewport
              );
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                moveEvent.preventDefault();
                const delta = startY - moveEvent.clientY;
                const newHeight = Math.min(Math.max(startHeight + delta, minHeight), maxHeight);
                
                if (newHeight >= minHeight && newHeight <= maxHeight) {
                  onConsoleResize(newHeight);
                }
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = 'default';
              };
              
              document.body.style.cursor = 'ns-resize';
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>

          {/* Console Content */}
          <div 
            className="bg-gradient-to-b from-gray-900 to-gray-950 backdrop-blur-sm flex flex-col"
            style={{ height: `${consoleHeight}px`, minHeight: '100px' }}
          >
            {/* Console Header */}
            <div className="flex-none h-10 border-b border-gray-700/70 px-4 flex items-center justify-between bg-gray-800/95 sticky top-0 z-10 shadow-sm">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <CommandLineIcon className="w-4 h-4 text-gray-400" />
                Console Log
              </h3>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer"></div>
              </div>
            </div>

            {/* Console Messages */}
            <div 
              ref={consoleContainerRef}
              className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
              onScroll={handleConsoleScroll}
            >
              <div ref={consoleContentRef} className="p-4 font-mono text-sm space-y-2">
                {consoleMessages.map((msg) => {
                  // Función para convertir direcciones y hashes en enlaces
                  const formatMessage = (content: string) => {
                    // Split the message by lines to handle each part separately
                    const lines = content.split('\n');
                    const formattedLines = lines.map(line => {
                      // Check for transaction hash line
                      if (line.startsWith('Transaction Hash:')) {
                        // Extract hash using regex
                        const hashMatch = line.match(/Transaction Hash: (0x[a-fA-F0-9]{64})/);
                        if (hashMatch && hashMatch[1]) {
                          const hash = hashMatch[1];
                          return `Transaction Hash: <a href="https://testnet.sonicscan.org/tx/${hash}" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="text-blue-400 hover:text-blue-300 hover:underline">${hash}</a>`;
                        }
                      }
                      
                      // Handle contract address line
                      if (line.startsWith('Contract address:')) {
                        // Extract address using regex
                        const addressMatch = line.match(/Contract address: (0x[a-fA-F0-9]{40})/);
                        if (addressMatch && addressMatch[1]) {
                          const address = addressMatch[1];
                          return `Contract address: <a href="https://testnet.sonicscan.org/address/${address}" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="text-blue-400 hover:text-blue-300 hover:underline">${address}</a>`;
                        }
                      }
                      
                      // For other lines, handle standalone addresses and hashes
                      let processedLine = line;
                      
                      // Process standalone addresses (not in HTML tags)
                      const addressPattern = /(0x[a-fA-F0-9]{40})/g;
                      processedLine = processedLine.replace(addressPattern, (address) => {
                        // Don't replace if already in an HTML tag
                        const prevChar = processedLine.charAt(processedLine.indexOf(address) - 1);
                        if (prevChar === '"' || prevChar === "'") {
                          return address;
                        }
                        return `<a href="https://testnet.sonicscan.org/address/${address}" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          class="text-blue-400 hover:text-blue-300 hover:underline">${address}</a>`;
                      });
                      
                      // Process standalone transaction hashes (not in HTML tags)
                      const txHashPattern = /(0x[a-fA-F0-9]{64})/g;
                      processedLine = processedLine.replace(txHashPattern, (hash) => {
                        // Don't replace if already in an HTML tag
                        const prevChar = processedLine.charAt(processedLine.indexOf(hash) - 1);
                        if (prevChar === '"' || prevChar === "'") {
                          return hash;
                        }
                        return `<a href="https://testnet.sonicscan.org/tx/${hash}" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          class="text-blue-400 hover:text-blue-300 hover:underline">${hash}</a>`;
                      });
                      
                      return processedLine;
                    });
                    
                    return <span dangerouslySetInnerHTML={{ __html: formattedLines.join('\n') }} />;
                  };

                  return (
                    <div
                      key={msg.id}
                      className={`
                        p-3 text-sm rounded-lg flex justify-between transition-all duration-200 hover:shadow-md border border-transparent
                        ${msg.type === 'error' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/40 hover:border-red-800/50' : 
                          msg.type === 'warning' ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/40 hover:border-yellow-800/50' : 
                          msg.type === 'success' ? 'bg-green-900/30 text-green-400 hover:bg-green-900/40 hover:border-green-800/50' : 
                          'bg-blue-900/30 text-blue-400 hover:bg-blue-900/40 hover:border-blue-800/50'
                        }`}
                    >
                      <div className="flex-1 whitespace-pre-wrap break-all">
                        {formatMessage(msg.content)}
                      </div>
                      <div className="flex-none ml-4 text-xs text-gray-500 whitespace-nowrap">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                      </div>
                    </div>
                  );
                })}
                <div id="console-bottom-anchor" className="h-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Contract Version History with improved styling */}
        <div className="rounded-lg overflow-hidden border border-gray-700/50 shadow-lg">
          <ContractVersionHistory
            contractAddress={currentArtifact?.address}
            conversationContexts={conversationContexts}
            activeContextId={conversationId}
            onLoadVersion={handleLoadVersion}
            onViewConversation={onViewConversation}
          />
        </div>

        {/* Deploy Section with improved styling */}
        {currentArtifact.bytecode && (
          <div className="rounded-lg overflow-hidden border border-gray-700/50 shadow-xl bg-gradient-to-b from-gray-800/90 to-gray-850/90 backdrop-blur-sm transition-all duration-300 hover:shadow-blue-900/10">
            {/* Header and Deploy Button Combined */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-850/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                  <RocketLaunchIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-medium text-white">Deploy Contract</h4>
                  {constructor && constructor.inputs && constructor.inputs.length > 0 && (
                    <p className="text-sm text-gray-400">
                      {constructor.inputs.length} constructor argument{constructor.inputs.length > 1 ? 's' : ''} required
                    </p>
                  )}
                </div>
              </div>

              {constructor && constructor.inputs && constructor.inputs.length > 0 ? (
                <button
                  onClick={() => setIsDeploymentCollapsed(!isDeploymentCollapsed)}
                  className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/70 active:bg-gray-600/70 transition-all duration-200"
                  title={isDeploymentCollapsed ? "Show constructor arguments" : "Hide constructor arguments"}
                >
                  <svg 
                    className={`w-5 h-5 transition-transform duration-300 ${isDeploymentCollapsed ? '' : 'rotate-180'}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : null}
            </div>

            {/* Constructor Arguments Content */}
            <div className={`transition-all duration-300 ease-in-out ${
              isDeploymentCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
            } overflow-hidden`}>
              {constructor && constructor.inputs && constructor.inputs.length > 0 && (
                <div className="p-5 space-y-4 border-b border-gray-700/50 bg-gray-900/40 backdrop-filter backdrop-blur-sm">
                  {constructor.inputs.map((input: { name: string; type: string }, index: number) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <label className="flex-none text-sm font-medium text-gray-300 min-w-[120px]">
                        {input.name} <span className="text-gray-500">({input.type})</span>
                      </label>
                      <input
                        type="text"
                        onChange={(e) => handleConstructorArgChange(index, e.target.value)}
                        placeholder={`Enter ${input.type}`}
                        className="flex-1 px-4 py-2.5 bg-gray-900/70 border border-gray-700 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-transparent text-sm transition-all duration-200 shadow-inner hover:border-gray-600"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deploy Button */}
            <div className="p-5">
              <button
                onClick={handleDeploy}
                disabled={isDeploying || !isConnected}
                className={`w-full py-3 rounded-lg flex items-center justify-center gap-3 text-white font-medium transition-all duration-300 shadow-lg ${
                  isDeploying || !isConnected
                    ? 'bg-gray-700 cursor-not-allowed opacity-70'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-900/30 active:scale-[0.98]'
                }`}
              >
                <RocketLaunchIcon className={`w-5 h-5 ${isDeploying ? 'animate-pulse' : ''}`} />
                <span>{isDeploying ? 'Deploying...' : 'Deploy Contract'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Exportar el componente memoizado
export default memo(ContractViewer);