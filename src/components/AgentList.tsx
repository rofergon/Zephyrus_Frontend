import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Agent, AgentFunction } from '../services/agentService';
import { DeployedContract } from '../types/contracts';

interface AgentListProps {
  agents: Agent[];
  contract: DeployedContract;
  onSelectAgent: (agent: Agent) => void;
  onNewAgent: () => void;
}

const AgentList: React.FC<AgentListProps> = ({ agents, contract, onSelectAgent, onNewAgent }) => {
  // Estado para almacenar las funciones de cada agente
  const [agentFunctions, setAgentFunctions] = useState<Record<string, AgentFunction[]>>({});
  const [loadingFunctions, setLoadingFunctions] = useState<Record<string, boolean>>({});
  
  // Función para cargar las funciones de un agente al pasar el cursor
  const loadAgentFunctions = async (agentId: string) => {
    // Si ya están cargadas o están cargando, no hacer nada
    if (agentFunctions[agentId] || loadingFunctions[agentId]) return;
    
    setLoadingFunctions(prev => ({ ...prev, [agentId]: true }));
    
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/db/agents/${agentId}/functions`);
      
      if (response.ok) {
        const data = await response.json();
        setAgentFunctions(prev => ({ ...prev, [agentId]: data }));
      }
    } catch (error) {
      console.error('Error loading agent functions:', error);
    } finally {
      setLoadingFunctions(prev => ({ ...prev, [agentId]: false }));
    }
  };
  
  // Función para formatear la fecha
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return dateString;
    }
  };

  // Elementos de animación para las tarjetas
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="w-full h-full">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-blue-300 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Agentes para {contract.name}
        </h2>
        <button
          onClick={onNewAgent}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Create New Agent
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="text-center p-8 bg-gray-800/30 rounded-xl border border-gray-700/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400 mb-4">No hay agentes configurados para este contrato.</p>
          <button
            onClick={onNewAgent}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
          >
            Configurar un agente ahora
          </button>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {agents.map((agent) => (
            <motion.div
              key={agent.agent_id}
              className="backdrop-blur-xl bg-gray-800/30 rounded-xl p-5 border border-gray-700/40 hover:border-blue-500/30 cursor-pointer transition-all duration-300 group"
              onClick={() => onSelectAgent(agent)}
              onMouseEnter={() => loadAgentFunctions(agent.agent_id)}
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-white group-hover:text-blue-300 transition-colors">
                  {agent.name}
                </h3>
                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                  agent.status === 'active' 
                  ? 'bg-green-900/50 text-green-400 border border-green-500/30' 
                  : 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {agent.status}
                </span>
              </div>
              
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                {agent.description || 'Sin descripción'}
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Gas Limit</div>
                  <div className="text-sm font-mono text-gray-300">{agent.gas_limit}</div>
                </div>
                <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Max Priority Fee</div>
                  <div className="text-sm font-mono text-gray-300">{agent.max_priority_fee}</div>
                </div>
              </div>
              
              {/* Indicador de funciones configuradas */}
              <div className="mb-4">
                {loadingFunctions[agent.agent_id] ? (
                  <div className="flex items-center text-gray-400 text-sm">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando funciones...
                  </div>
                ) : agentFunctions[agent.agent_id] ? (
                  <div className="flex flex-wrap gap-2">
                    {/* Mostrar badges para read y write functions */}
                    <div className="bg-emerald-900/20 text-emerald-400 text-xs px-2 py-1 rounded-lg border border-emerald-700/30 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                      {agentFunctions[agent.agent_id].filter(f => f.function_type === 'read').length} Lectura
                    </div>
                    <div className="bg-amber-900/20 text-amber-400 text-xs px-2 py-1 rounded-lg border border-amber-700/30 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      {agentFunctions[agent.agent_id].filter(f => f.function_type === 'write').length} Escritura
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs">Funciones: Pasa el cursor para ver</div>
                )}
              </div>
              
              <div className="flex justify-between items-center text-xs text-gray-500">
                <div>ID: <span className="font-mono">{agent.agent_id.substring(0, 8)}...</span></div>
                <div>
                  Actualizado: {formatDate(agent.updated_at)}
                </div>
              </div>
              
              <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg flex items-center gap-1 border border-blue-600/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Ver Ejecución
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default AgentList; 