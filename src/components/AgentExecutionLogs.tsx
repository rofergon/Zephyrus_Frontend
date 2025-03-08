import React, { useState, useEffect, useRef } from 'react';
import { DeployedContract } from '../types/contracts';
import { AgentConfiguration } from './AgentConfigForm';
import { Agent } from '../services/agentService';

interface AgentExecutionLogsProps {
  contract: DeployedContract;
  agentConfig?: AgentConfiguration;
  onBack?: () => void;
  selectedAgent?: Agent | null;
  agent?: Agent | null;
  onConfigureAgent?: () => void;
  onBackToList?: () => void;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

// Agregar esta interfaz para representar los parámetros de las funciones
interface FunctionParameter {
  name: string;
  type: string;
  validation?: Record<string, any>;
  value?: string;
}

// Agregar esta interfaz para la estructura de función procesada
interface ProcessedFunction {
  functionId: string;
  functionName: string;
  type: 'read' | 'write';
  isAllowed: boolean;
  parameters: FunctionParameter[];
}

const AgentExecutionLogs: React.FC<AgentExecutionLogsProps> = ({ 
  contract, 
  agentConfig, 
  onBack,
  selectedAgent = null,
  agent = null}) => {
  const [isRunning, setIsRunning] = useState(agentConfig?.agent.status !== 'paused');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [nextExecution, setNextExecution] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [showDescriptionEdit, setShowDescriptionEdit] = useState(false);
  const [description, setDescription] = useState(agentConfig?.agent.description || '');
  const [newDescription] = useState(agentConfig?.agent.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showContractDetails, setShowContractDetails] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'read' | 'write' | 'all'>('all');
  const [expandedMethods, setExpandedMethods] = useState<string[]>([]);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // Estado para controlar el drag & resize
  const [isDragging, setIsDragging] = useState(false);
  const [initialPos, setInitialPos] = useState(0);
  const [initialFunctionsHeight, setInitialFunctionsHeight] = useState(0);
  const [initialLogsHeight, setInitialLogsHeight] = useState(0);
  
  const functionsRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  // Connectar al websocket para recibir logs en tiempo real
  useEffect(() => {
    // Para evitar errores, verificamos que contractId existe
    const contractId = agentConfig?.agent.contractId || agent?.agent_id || selectedAgent?.agent_id;
    if (!contractId) {
      console.error('Missing contractId, cannot establish WebSocket connection');
      return;
    }
    
    // Establecer conexión WebSocket
    try {
      // Usar la URL de WebSocket para agentes desde el .env
      const wsUrl = import.meta.env.MODE === 'production' 
        ? import.meta.env.VITE_WS_AGENT_URL_PROD
        : import.meta.env.VITE_WS_AGENT_URL_DEV;
      
      // Obtener el ID del agente
      const agentId = agentConfig?.agent.contractId || agent?.agent_id || selectedAgent?.agent_id;
      
      // Construir la URL completa del WebSocket
      const fullWsUrl = `${wsUrl}/ws/agent/${agentId}`;
      
      // Log de la URL del WebSocket para depuración
      console.log('Connecting to WebSocket URL:', fullWsUrl);
      // Mostrar la URL en el panel de logs
      addLog(`Connecting to WebSocket URL: ${fullWsUrl}`, 'info');
      
      // Conectar al WebSocket para agentes
      const ws = new WebSocket(fullWsUrl);

      ws.onopen = () => {
        // Añadir la URL en el log visible para mejorar la depuración
        addLog(`Connected to agent service at ${fullWsUrl}`, 'success');
        console.log(`WebSocket connected to ${fullWsUrl}`);
        
        // Al establecer conexión, mostrar información del agente
        if (agentId) {
          console.log('Connected with agent ID:', agentId);
          addLog(`Registered with agent ID: ${agentId}`, 'info');
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log all messages received for debugging
          console.log('WebSocket message received:', JSON.stringify(data, null, 2));
          
          // Mostrar mensaje recibido en el panel
          const messageType = data.type || 'unknown';
          
          if (data.type === 'log') {
            addLog(data.message, data.logType || 'info');
          } else if (data.type === 'status') {
            // Mostrar detalles del estado
            addLog(`Received status update: ${JSON.stringify(data)}`, 'info');
            
            setIsRunning(data.running);
            if (data.lastExecuted) {
              setLastExecuted(new Date(data.lastExecuted).toLocaleString());
            }
            if (data.nextExecution) {
              setNextExecution(new Date(data.nextExecution).toLocaleString());
            }
          } else if (data.type === 'error') {
            addLog(`Error: ${data.message || JSON.stringify(data)}`, 'error');
            console.error('WebSocket error response:', data);
          } else if (data.type === 'execute_response') {
            // Mostrar respuesta de ejecución
            addLog(`Execution response: ${JSON.stringify(data)}`, 'success');
          } else {
            // Log unknown message types
            addLog(`Received message type [${messageType}]: ${JSON.stringify(data)}`, 'info');
            console.log('Unknown message type received:', data.type, data);
          }
        } catch (error) {
          console.error('Error parsing websocket message:', error);
          addLog(`Error parsing WebSocket message: ${error}`, 'error');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event);
        const reason = event.reason ? ` Reason: ${event.reason}` : '';
        const code = event.code ? ` (Code: ${event.code})` : '';
        addLog(`Disconnected from agent service${code}${reason}`, 'warning');
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Convertir el error a string para mostrarlo
        const errorMessage = typeof error === 'object' ? JSON.stringify(error) : String(error);
        addLog(`Error connecting to agent service: ${errorMessage}`, 'error');
      };

      setSocket(ws);

      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      addLog('Failed to connect to agent service', 'error');
    }
  }, [agentConfig?.agent.contractId, agent?.agent_id, selectedAgent?.agent_id]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toLocaleString(),
        message,
        type
      }
    ]);
  };

  const handleStartStop = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Usar contractId si no hay agent_id
      const agentId = selectedAgent?.agent_id || agent?.agent_id || agentConfig?.agent.contractId;
      if (!agentId) {
        console.error('No agent ID available');
        return;
      }
      
      socket.send(JSON.stringify({
        action: isRunning ? 'stop' : 'start',
        agentId: agentId,
      }));
      setIsRunning(!isRunning);
      addLog(`Agent ${isRunning ? 'stopped' : 'started'}`, 'info');
    } else {
      addLog('WebSocket not connected. Try refreshing the page.', 'error');
    }
  };
  
  const handleManualRun = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Usar contractId si no hay agent_id
      const agentId = selectedAgent?.agent_id || agent?.agent_id || agentConfig?.agent.contractId;
      if (!agentId) {
        console.error('No agent ID available');
        return;
      }
      
      // Usar el formato exacto que espera el servidor
      const message = {
        type: "websocket_execution",
        agent_id: agentId
      };
      
      // Crear representación del mensaje para los logs
      const messageStr = JSON.stringify(message, null, 2);
      
      // Añadir logs detallados para depuración
      console.log('Sending execution request for agent:', agentId);
      console.log('Message format:', messageStr);
      
      // Añadir detalles del mensaje a los logs visibles
      addLog(`Sending WebSocket message: ${messageStr}`, 'info');
      
      // Enviar mensaje al WebSocket
      socket.send(JSON.stringify(message));
      
      // Añadir log visible para el usuario
      addLog(`Sending execution request for agent ${agentId}`, 'info');
      setLastExecuted(new Date().toISOString());
    } else {
      addLog('WebSocket not connected. Try refreshing the page.', 'error');
    }
  };

  const toggleMethodDetails = (functionId: string) => {
    setExpandedMethods(prev => {
      if (prev.includes(functionId)) {
        return prev.filter(id => id !== functionId);
      } else {
        return [...prev, functionId];
      }
    });
  };

  const toggleDescriptionEdit = () => {
    setShowDescriptionEdit(!showDescriptionEdit);
  };

  const handleEditDescription = () => {
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    setIsEditingDescription(false);
    setDescription(newDescription);
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Usar contractId si no hay agent_id
      const agentId = selectedAgent?.agent_id || agent?.agent_id || agentConfig?.agent.contractId;
      if (!agentId) {
        console.error('No agent ID available');
        return;
      }
      
      socket.send(JSON.stringify({
        action: 'updateConfig',
        agentId: agentId,
        config: {
          description: newDescription
        }
      }));
      addLog('Agent description updated', 'success');
    } else {
      addLog('WebSocket not connected. Try refreshing the page.', 'error');
    }
  };

  const handleCancelEdit = () => {
    setDescription(agentConfig?.agent.description || '');
    setIsEditingDescription(false);
  };

  const toggleContractDetails = () => {
    setShowContractDetails(!showContractDetails);
  };

  const processAgentFunctions = (): ProcessedFunction[] => {
    // Si no hay configuración, devolver un array vacío
    if (!agentConfig) return [];
    
    // Si no hay funciones en la configuración, devolver array vacío
    if (!agentConfig.functions || !Array.isArray(agentConfig.functions) || agentConfig.functions.length === 0) {
      console.log('No hay funciones en agentConfig o no es un array:', agentConfig.functions);
      return [];
    }
    
    console.log('Funciones del agentConfig:', JSON.stringify(agentConfig.functions, null, 2));
    
    return agentConfig.functions.map((func: any, index) => {
      const functionName = func.function_name;
      
      return {
        functionId: `${index}-${functionName}`,
        functionName: functionName,
        type: func.function_type || 'read',
        isAllowed: func.is_enabled || false,
        parameters: func.parameters 
          ? func.parameters.map((param: any) => ({
              name: param.name,
              type: param.type,
              validation: param.validation || {}
            })) 
          : // Si no, tratar de extraerlos del ABI del contrato
            Array.isArray(contract?.abi) ? 
              contract.abi
                .find((item: any) => item.type === 'function' && 
                     (item.name === functionName || 
                      item.name.toLowerCase() === functionName.toLowerCase()))
                ?.inputs?.map((input: any) => ({
                  name: input.name,
                  type: input.type,
                  validation: {}
                })) || []
              : []
      };
    });
  };
  
  // Obtener las funciones permitidas del contrato
  const allowedFunctions = processAgentFunctions();
  
  console.log('Funciones procesadas:', allowedFunctions);

  // Add a banner to indicate if this is an existing agent
  const ExistingAgentBanner = () => {
    if (!selectedAgent && !agent) return null;
    
    const displayAgent = agent || selectedAgent;
    if (!displayAgent) return null;
    
    return (
      <div className="flex flex-row items-center gap-4 mb-6 p-4 bg-indigo-900/30 rounded-xl border border-indigo-700/40">
        <div>
          <h3 className="text-lg font-semibold text-indigo-300 mb-1">Agente existente: Smart Contract Agent</h3>
          <p className="text-gray-400 text-sm">ID: {selectedAgent?.agent_id || agent?.agent_id || agentConfig?.agent.contractId}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleStartStop}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              isRunning ? 'bg-red-600/20 border border-red-600/30 text-red-400 hover:bg-red-600/30' : 'bg-green-600/20 border border-green-600/30 text-green-400 hover:bg-green-600/30'
            } transition-colors`}
          >
            {isRunning ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop Agent
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Start Agent
              </>
            )}
          </button>
          
          <button 
            onClick={handleManualRun}
            className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg border border-indigo-500/30"
          >
            Execute Now
          </button>
        </div>
      </div>
    );
  };

  // Sección de funciones configuradas
  const FunctionsList = () => {
    if (!allowedFunctions || allowedFunctions.length === 0) {
      return (
        <div className="py-6 px-4 text-center bg-gray-800/30 rounded-lg border border-gray-700/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-400">No se encontraron funciones configuradas para este agente.</p>
        </div>
      );
    }

    const filteredFunctions = allowedFunctions.filter(func => 
      selectedTab === 'all' || func.type === selectedTab
    );

    if (filteredFunctions.length === 0) {
      return (
        <div className="py-6 px-4 text-center bg-gray-800/30 rounded-lg border border-gray-700/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-400">No hay funciones de tipo "{selectedTab}" configuradas.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredFunctions.map((func, index) => (
          <div 
            key={func.functionId || index} 
            className={`bg-gray-800/50 border ${
              func.type === 'read' 
                ? 'border-emerald-500/20' 
                : 'border-amber-500/20'
            } rounded-lg p-4 transition-all duration-300`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  func.type === 'read' 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {func.type === 'read' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <h4 className="text-md font-semibold text-white">{func.functionName}</h4>
                  <p className="text-sm text-gray-400">
                    {func.type === 'read' ? 'Read Function' : 'Write Function'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => toggleMethodDetails(func.functionId || index.toString())}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform ${expandedMethods.includes(func.functionId || index.toString()) ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Parámetros y detalles */}
            {expandedMethods.includes(func.functionId || index.toString()) && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                {func.parameters && func.parameters.length > 0 ? (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-gray-300">Parameters</h5>
                    <div className="space-y-2">
                      {func.parameters.map((param, pIndex) => {
                        // Verificar si el parámetro ya tiene un valor predefinido
                        const paramValue = param.value || '';
                        
                        return (
                          <div key={pIndex} className="flex flex-col">
                            <div className="flex justify-between">
                              <label className="text-sm text-gray-400">
                                {param.name} <span className="text-gray-500">({param.type})</span>
                              </label>
                              {paramValue && (
                                <span className="text-xs font-mono bg-gray-700/50 px-2 py-1 rounded text-blue-300">
                                  Default: {paramValue}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              className="mt-1 bg-gray-700/50 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full"
                              placeholder={`Enter ${param.name}`}
                              defaultValue={paramValue}
                              disabled={func.type === 'read'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No parameters required</p>
                )}
                
                {func.type === 'read' ? (
                  <button 
                    className="mt-4 w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 py-2 rounded-lg transition-colors"
                  >
                    Query
                  </button>
                ) : (
                  <button 
                    className="mt-4 w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 py-2 rounded-lg transition-colors"
                  >
                    Execute
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Nueva implementación del redimensionamiento
  const handleMouseDown = (e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
    let clientY;
    
    if ('touches' in e) {
      clientY = (e as TouchEvent).touches[0].clientY;
    } else {
      clientY = (e as MouseEvent).clientY;
    }
    
    setIsDragging(true);
    setInitialPos(clientY);
    
    if (functionsRef.current && logsRef.current) {
      setInitialFunctionsHeight(functionsRef.current.getBoundingClientRect().height);
      setInitialLogsHeight(logsRef.current.getBoundingClientRect().height);
    }
    
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };
  
  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    let clientY;
    if (e instanceof TouchEvent) {
      clientY = e.touches[0].clientY;
    } else {
      clientY = e.clientY;
    }
    
    const delta = clientY - initialPos;
    
    if (functionsRef.current && logsRef.current) {
      const newFunctionsHeight = Math.max(100, initialFunctionsHeight + delta);
      const newLogsHeight = Math.max(100, initialLogsHeight - delta);
      
      functionsRef.current.style.height = `${newFunctionsHeight}px`;
      logsRef.current.style.height = `${newLogsHeight}px`;
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  };
  
  // Agregar y limpiar event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Suscribir el resizer a los eventos
  useEffect(() => {
    const resizer = resizerRef.current;
    
    const handleDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      handleMouseDown(e);
    };
    
    if (resizer) {
      resizer.addEventListener('mousedown', handleDown);
      resizer.addEventListener('touchstart', handleDown);
    }
    
    return () => {
      if (resizer) {
        resizer.removeEventListener('mousedown', handleDown);
        resizer.removeEventListener('touchstart', handleDown);
      }
    };
  }, [handleMouseDown]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-blue-300 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Smart Contract Agent - Execution Panel
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="px-3 py-1 text-xs bg-gray-800/60 text-gray-400 rounded-lg hover:bg-gray-700 transition-all duration-200"
          >
            {showDebugInfo ? "Ocultar Debug" : "Mostrar Debug"}
          </button>
          
          <button
            onClick={onBack}
            className="px-4 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Back
          </button>
        </div>
      </div>

      <ExistingAgentBanner />
      
      {/* Debug Info Panel */}
      {showDebugInfo && agentConfig && (
        <div className="mb-6 p-4 bg-gray-900/80 border border-gray-700 rounded-lg overflow-auto max-h-60">
          <h3 className="text-sm font-semibold text-white mb-2">Información de depuración</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-gray-400 mb-1">agentConfig.functions:</h4>
              <pre className="text-xs overflow-auto bg-gray-800 p-2 rounded text-green-400 max-h-36">
                {JSON.stringify(agentConfig.functions, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-400 mb-1">Funciones procesadas:</h4>
              <pre className="text-xs overflow-auto bg-gray-800 p-2 rounded text-blue-400 max-h-36">
                {JSON.stringify(allowedFunctions, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
      
      {/* Sección principal con dashboard y estado */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/90 rounded-xl p-5 mb-6 shadow-lg border border-gray-700/40 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-indigo-300 mb-1">Agente existente: Smart Contract Agent</h3>
            <p className="text-gray-400 text-sm">ID: {selectedAgent?.agent_id || agent?.agent_id || agentConfig?.agent.contractId}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <span className={`h-3 w-3 rounded-full mr-2 ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className={`${isRunning ? 'text-green-400' : 'text-red-400'} text-sm font-medium`}>
                {isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            
            <button
              onClick={handleStartStop}
              className={`px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                isRunning 
                  ? 'bg-red-600/90 hover:bg-red-700 text-white border border-red-500/30' 
                  : 'bg-green-600/90 hover:bg-green-700 text-white border border-green-500/30'
              }`}
            >
              {isRunning ? 'Stop Agent' : 'Start Agent'}
            </button>
            
            <button
              onClick={handleManualRun}
              className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg border border-indigo-500/30"
            >
              Execute Now
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700/40 hover:border-indigo-500/20 transition-all duration-200 shadow-md">
            <h3 className="text-sm font-semibold mb-2 text-gray-400">Status</h3>
            <p className="flex items-center text-xl font-medium text-white">
              <span className={`h-3 w-3 rounded-full mr-2 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>{isRunning ? 'Active' : 'Stopped'}</span>
            </p>
          </div>
          
          <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700/40 hover:border-indigo-500/20 transition-all duration-200 shadow-md">
            <h3 className="text-sm font-semibold mb-2 text-gray-400">Last Execution</h3>
            <p className="text-xl font-medium text-white">{lastExecuted || 'Never'}</p>
          </div>
          
          <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700/40 hover:border-indigo-500/20 transition-all duration-200 shadow-md">
            <h3 className="text-sm font-semibold mb-2 text-gray-400">Next Execution</h3>
            <p className="text-xl font-medium text-white">{nextExecution || 'Not scheduled'}</p>
          </div>
        </div>
      </div>
      
      {/* Sección de descripción del comportamiento */}
      <div className="bg-gray-800/60 rounded-xl p-5 mb-6 border border-gray-700/40 transition-all duration-200 hover:border-blue-500/20 shadow-md">
        <div 
          className="flex justify-between items-center cursor-pointer"
          onClick={toggleDescriptionEdit}
        >
          <h3 className="text-lg font-semibold text-indigo-300 flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Agent Behavior Description
          </h3>
          <svg 
            className={`w-5 h-5 transition-transform text-indigo-300 ${showDescriptionEdit ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>

        {showDescriptionEdit && (
          <div className="mt-3">
            {isEditingDescription ? (
              <div className="space-y-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-32 p-3 bg-gray-900/70 text-gray-300 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-all"
                  placeholder="Describe the behavior of this agent..."
                />
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-gray-700/80 text-gray-300 rounded-md hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveDescription}
                    className="px-4 py-2 bg-indigo-600/90 text-white rounded-md hover:bg-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 relative">
                <div className="p-4 bg-gray-900/50 rounded-lg text-gray-300 whitespace-pre-wrap border border-gray-700/40">
                  {description || <span className="text-gray-500 italic">No description provided</span>}
                </div>
                <button 
                  onClick={handleEditDescription}
                  className="absolute top-3 right-3 p-1.5 bg-gray-800/80 rounded-md hover:bg-gray-700 transition-all duration-200"
                  title="Edit description"
                >
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contract Details Section */}
      <div className="bg-gray-800/60 rounded-xl p-5 mb-6 border border-gray-700/40 transition-all duration-200 hover:border-blue-500/20 shadow-md">
        <div 
          className="flex justify-between items-center cursor-pointer"
          onClick={toggleContractDetails}
        >
          <h3 className="text-lg font-semibold text-indigo-300 flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 12V8H6C4.89543 8 4 7.10457 4 6V18C4 19.1046 4.89543 20 6 20H20V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 6V4M12 8V6M12 6H20C21.1046 6 22 5.10457 22 4V6C22 7.10457 21.1046 8 20 8H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Contract Details
          </h3>
          <svg 
            className={`w-5 h-5 transition-transform text-indigo-300 ${showContractDetails ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>

        {showContractDetails && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 hover:border-indigo-500/30 transition-colors">
              <p className="text-sm text-gray-400 mb-1">Contract ID</p>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-200 font-mono break-all">{selectedAgent?.agent_id || agent?.agent_id || agentConfig?.agent.contractId}</p>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = selectedAgent?.agent_id || agent?.agent_id || agentConfig?.agent.contractId;
                    if (id) navigator.clipboard.writeText(id);
                  }}
                  className="text-gray-400 hover:text-indigo-400 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 4V16C8 17.1046 8.89543 18 10 18H20C21.1046 18 22 17.1046 22 16V7.41421C22 6.88378 21.7893 6.37507 21.4142 6L18 2.58579C17.6249 2.21071 17.1162 2 16.5858 2H10C8.89543 2 8 2.89543 8 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 18V20C16 21.1046 15.1046 22 14 22H4C2.89543 22 2 21.1046 2 20V8C2 6.89543 2.89543 6 4 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 hover:border-indigo-500/30 transition-colors">
              <p className="text-sm text-gray-400 mb-1">Owner Address</p>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-200 font-mono break-all">
                  {agentConfig?.agent.owner || agent?.owner || contract.owner || 'Not available'}
                </p>
                {(agentConfig?.agent.owner || agent?.owner || contract.owner) && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const owner = agentConfig?.agent.owner || agent?.owner || contract.owner;
                      if (owner) navigator.clipboard.writeText(owner);
                    }}
                    className="text-gray-400 hover:text-indigo-400 transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 4V16C8 17.1046 8.89543 18 10 18H20C21.1046 18 22 17.1046 22 16V7.41421C22 6.88378 21.7893 6.37507 21.4142 6L18 2.58579C17.6249 2.21071 17.1162 2 16.5858 2H10C8.89543 2 8 2.89543 8 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 18V20C16 21.1046 15.1046 22 14 22H4C2.89543 22 2 21.1046 2 20V8C2 6.89543 2.89543 6 4 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {agentConfig?.agent.contract_state && (
              <div className="grid grid-cols-2 gap-4">
                <div key="totalSupply" className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 hover:border-indigo-500/30 transition-colors">
                  <p className="text-sm text-gray-400 mb-1">Total Supply</p>
                  <p className="text-sm text-gray-200 font-mono">{agentConfig.agent.contract_state.totalSupply || '0'}</p>
                </div>

                <div key="symbol" className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 hover:border-indigo-500/30 transition-colors">
                  <p className="text-sm text-gray-400 mb-1">Symbol</p>
                  <p className="text-sm text-gray-200 font-mono">{agentConfig.agent.contract_state.symbol || 'N/A'}</p>
                </div>

                <div key="status" className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 hover:border-indigo-500/30 transition-colors col-span-2">
                  <p className="text-sm text-gray-400 mb-1">Contract Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${agentConfig.agent.contract_state.paused ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      agentConfig.agent.contract_state.paused
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-green-500/20 text-green-400 border border-green-500/30'
                    }`}>
                      {agentConfig.agent.contract_state.paused ? 'Paused' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sección de funciones configuradas */}
      <div 
        ref={functionsRef}
        className="bg-gray-800/60 rounded-xl p-5 mb-2 border border-gray-700/40 shadow-md overflow-auto"
        style={{ minHeight: '150px', maxHeight: '60vh' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-indigo-300 flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 12C14 14.2091 12.2091 16 10 16C7.79086 16 6 14.2091 6 12C6 9.79086 7.79086 8 10 8C12.2091 8 14 9.79086 14 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Funciones Configuradas
          </h3>
          <div className="flex space-x-2 bg-gray-900/60 p-1 rounded-full">
            <button
              className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                selectedTab === 'read' ? 'bg-emerald-500/80 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setSelectedTab('read')}
            >
              Read
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                selectedTab === 'write' ? 'bg-amber-500/80 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setSelectedTab('write')}
            >
              Write
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                selectedTab === 'all' ? 'bg-blue-500/80 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setSelectedTab('all')}
            >
              All
            </button>
          </div>
        </div>
        
        <div className="bg-gray-900/40 rounded-lg p-0.5">
          <FunctionsList />
        </div>
      </div>

      {/* Indicador de redimensionamiento */}
      <div 
        ref={resizerRef}
        className="h-4 w-full flex justify-center items-center mb-2 group"
      >
        <div className="w-32 h-2 rounded-full bg-gray-600/40 group-hover:bg-indigo-500/40 cursor-ns-resize transition-all duration-150 flex items-center justify-center">
          <div className="w-6 h-1 bg-gray-500/60 group-hover:bg-indigo-400/60 rounded-full"></div>
        </div>
      </div>

      {/* Sección de logs con altura flexible */}
      <div 
        ref={logsRef}
        className="flex-1 min-h-0 bg-gray-800/60 rounded-xl p-5 border border-gray-700/40 shadow-md overflow-hidden"
        style={{ minHeight: '150px', maxHeight: '60vh' }}
      >
        <h3 className="text-lg font-semibold mb-3 text-indigo-300 flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Execution Logs
        </h3>
        <div 
          className="h-[calc(100%-40px)] overflow-y-auto overflow-x-hidden custom-scrollbar bg-gray-900/70 rounded-lg p-4 font-mono text-sm border border-gray-700/20" 
          style={{ width: 'calc(100% - 8px)', margin: '0 4px' }}
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <svg className="w-12 h-12 text-gray-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-gray-500 italic">No logs yet. Start the agent to see execution data.</p>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words w-full">
              {logs.map((log, index) => (
                <div key={index} className={`mb-2 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'warning' ? 'text-yellow-400' :
                  'text-gray-300'
                }`}>
                  <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.4);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.6);
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        body.resizing {
          cursor: ns-resize !important;
          user-select: none;
        }
        `}
      </style>
    </div>
  );
};

export default AgentExecutionLogs;