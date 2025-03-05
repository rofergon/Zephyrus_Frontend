import React, { useState, useEffect } from 'react';
import { DeployedContract } from '../types/contracts';
import { AgentConfig } from './AgentConfigForm';

interface AgentExecutionLogsProps {
  contract: DeployedContract;
  agentConfig: AgentConfig;
  onBack: () => void;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const AgentExecutionLogs: React.FC<AgentExecutionLogsProps> = ({ contract, agentConfig, onBack }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [nextExecution, setNextExecution] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [showMethodDetails, setShowMethodDetails] = useState<Record<string, boolean>>({});
  const [showDescriptionEdit, setShowDescriptionEdit] = useState(false);
  const [description, setDescription] = useState(agentConfig.description);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Connectar al websocket para recibir logs en tiempo real
  useEffect(() => {
    // Determinar qué URL de WebSocket usar basado en el entorno
    const wsUrl = import.meta.env.MODE === 'production' 
      ? import.meta.env.VITE_WS_URL_PROD
      : import.meta.env.VITE_WS_URL_DEV;
    
    const ws = new WebSocket(`${wsUrl}/${contract.address}`);

    ws.onopen = () => {
      addLog('Connected to agent service', 'info');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          addLog(data.message, data.logType || 'info');
        } else if (data.type === 'status') {
          setIsRunning(data.running);
          if (data.lastExecuted) {
            setLastExecuted(new Date(data.lastExecuted).toLocaleString());
          }
          if (data.nextExecution) {
            setNextExecution(new Date(data.nextExecution).toLocaleString());
          }
        }
      } catch (error) {
        console.error('Error parsing websocket message:', error);
      }
    };

    ws.onclose = () => {
      addLog('Disconnected from agent service', 'warning');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addLog('Error connecting to agent service', 'error');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [contract.address]);

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
      socket.send(JSON.stringify({
        action: isRunning ? 'stop' : 'start',
        agentId: contract.address
      }));
    } else {
      addLog('Not connected to agent service', 'error');
    }
  };

  const handleManualRun = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'execute',
        agentId: contract.address
      }));
      addLog('Requested manual execution', 'info');
    } else {
      addLog('Not connected to agent service', 'error');
    }
  };

  const toggleMethodDetails = (functionId: string) => {
    setShowMethodDetails(prev => ({
      ...prev,
      [functionId]: !prev[functionId]
    }));
  };

  const toggleDescriptionEdit = () => {
    setShowDescriptionEdit(!showDescriptionEdit);
  };

  const handleEditDescription = () => {
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    // Aquí se implementaría la lógica para guardar la descripción en el backend
    try {
      // Simular una operación de guardado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Actualizar el agente en el backend
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          action: 'updateConfig',
          agentId: contract.address,
          config: {
            description
          }
        }));
      }
      
      addLog('Agent description updated', 'success');
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Error saving description:', error);
      addLog('Failed to update agent description', 'error');
    }
  };

  const handleCancelEdit = () => {
    setDescription(agentConfig.description);
    setIsEditingDescription(false);
  };

  // Obtener las funciones permitidas del contrato
  const allowedFunctions = agentConfig.allowedFunctions.filter(func => func.isAllowed);

  return (
    <div className="bg-gray-900 text-white rounded-xl p-6 shadow-xl w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-indigo-400">
          Agent: {agentConfig.name}
        </h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Configuration
        </button>
      </div>

      {/* Sección de descripción del comportamiento */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 relative">
        <div 
          className="flex justify-between items-center cursor-pointer"
          onClick={toggleDescriptionEdit}
        >
          <h3 className="text-lg font-semibold text-indigo-300">Agent Behavior Description</h3>
          <svg 
            className={`w-5 h-5 transition-transform ${showDescriptionEdit ? 'rotate-180' : ''}`} 
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
                  className="w-full h-32 p-3 bg-gray-900 text-gray-300 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe the behavior of this agent..."
                />
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={handleCancelEdit}
                    className="px-3 py-1 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveDescription}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 relative">
                <div className="p-3 bg-gray-900/50 rounded-lg text-gray-300 whitespace-pre-wrap">
                  {description || <span className="text-gray-500 italic">No description provided</span>}
                </div>
                <button 
                  onClick={handleEditDescription}
                  className="absolute top-3 right-3 p-1 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
                  title="Edit description"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-indigo-300">Status</h3>
          <p className="flex items-center">
            <span className={`h-3 w-3 rounded-full mr-2 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>{isRunning ? 'Running' : 'Stopped'}</span>
          </p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-indigo-300">Last Execution</h3>
          <p>{lastExecuted || 'Never'}</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-indigo-300">Next Execution</h3>
          <p>{nextExecution || 'Not scheduled'}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={handleStartStop}
          className={`px-4 py-2 rounded-lg transition-colors ${
            isRunning 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isRunning ? 'Stop Agent' : 'Start Agent'}
        </button>
        
        <button
          onClick={handleManualRun}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          disabled={!isRunning}
        >
          Execute Now
        </button>
      </div>

      {/* Sección de métodos permitidos */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-indigo-300">Allowed Contract Methods</h3>
        <div className="space-y-3">
          {allowedFunctions.length === 0 ? (
            <p className="text-gray-500 italic">No methods were allowed for this agent.</p>
          ) : (
            allowedFunctions.map((func) => (
              <div key={func.functionId} className="border border-gray-700 rounded-lg overflow-hidden">
                <div 
                  className="flex justify-between items-center p-3 bg-gray-700/30 cursor-pointer"
                  onClick={() => toggleMethodDetails(func.functionId)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      func.type === 'read' 
                        ? 'bg-blue-900/50 text-blue-300' 
                        : 'bg-purple-900/50 text-purple-300'
                    }`}>
                      {func.type.toUpperCase()}
                    </span>
                    <span className="font-medium">{func.functionName}</span>
                  </div>
                  <svg 
                    className={`w-5 h-5 transition-transform ${showMethodDetails[func.functionId] ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
                {showMethodDetails[func.functionId] && (
                  <div className="p-3 bg-gray-900/50 border-t border-gray-700">
                    {func.parameters && func.parameters.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Parameters:</h4>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="pb-2 text-gray-400">Name</th>
                              <th className="pb-2 text-gray-400">Type</th>
                              <th className="pb-2 text-gray-400">Validation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {func.parameters.map((param, idx) => (
                              <tr key={idx} className="border-t border-gray-800">
                                <td className="py-2 pr-4 text-gray-300">{param.name}</td>
                                <td className="py-2 pr-4 text-gray-300">{param.type}</td>
                                <td className="py-2 text-gray-300">
                                  {param.validation ? (
                                    <ul className="list-disc list-inside text-xs">
                                      {param.validation.min !== undefined && 
                                        <li>Min: {param.validation.min}</li>
                                      }
                                      {param.validation.max !== undefined && 
                                        <li>Max: {param.validation.max}</li>
                                      }
                                      {param.validation.pattern && 
                                        <li>Pattern: {param.validation.pattern}</li>
                                      }
                                    </ul>
                                  ) : (
                                    <span className="text-gray-500 italic">None</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No parameters</p>
                    )}
                    
                    {/* Detalles adicionales sobre el método del contrato */}
                    {(() => {
                      const abiFunction = contract.abi.find(
                        (item: any) => 
                          item.type === 'function' && 
                          item.name === func.functionName
                      );
                      
                      if (abiFunction) {
                        return (
                          <div className="mt-3 pt-3 border-t border-gray-800">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Contract Function Details:</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-400">State Mutability:</span>
                                <span className="ml-2 text-gray-300">{abiFunction.stateMutability}</span>
                              </div>
                              {abiFunction.outputs && abiFunction.outputs.length > 0 && (
                                <div>
                                  <span className="text-gray-400">Return Type:</span>
                                  <span className="ml-2 text-gray-300">
                                    {abiFunction.outputs.map((o: any) => o.type).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2 text-indigo-300">Execution Logs</h3>
        <div className="h-96 overflow-y-auto custom-scrollbar bg-gray-900 rounded p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500 italic">No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`mb-2 ${
                log.type === 'error' ? 'text-red-400' :
                log.type === 'success' ? 'text-green-400' :
                log.type === 'warning' ? 'text-yellow-400' :
                'text-gray-300'
              }`}>
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))
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
          background: rgba(31, 41, 55, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.4);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.6);
        }
        `}
      </style>
    </div>
  );
};

export default AgentExecutionLogs; 