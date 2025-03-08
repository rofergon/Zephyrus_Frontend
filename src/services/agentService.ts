import { AgentConfiguration } from '../components/AgentConfigForm';

// Define the agent interface based on the API response structure
export interface Agent {
  agent_id: string;
  contract_id: string;
  name: string;
  description: string;
  status: 'active' | 'paused';
  gas_limit: string;
  max_priority_fee: string;
  owner: string;
  contract_state: {
    paused?: boolean;
    totalSupply?: string;
    symbol?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

// Define the agent function interface
export interface AgentFunction {
  function_id: string;
  agent_id: string;
  name?: string;
  function_name?: string;
  description?: string;
  function_abi?: any;
  function_signature?: string;
  function_type: 'read' | 'write';
  gas_limit?: string;
  is_enabled?: number | boolean;
  validation_rules?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  parameters?: {
    param_id?: string;
    function_id?: string;
    name: string;
    type: string;
    value?: string;
    position?: number;
  }[];
}

export class AgentService {
  private static instance: AgentService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  }

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * Get all agents for a specific contract
   * @param contractId The contract address
   * @returns Array of agents
   */
  public async getAgentsForContract(contractId: string): Promise<Agent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/agents/${contractId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching agents: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in getAgentsForContract:', error);
      return [];
    }
  }

  /**
   * Get functions configured for a specific agent
   * @param agentId The agent ID
   * @returns Array of agent functions
   */
  public async getAgentFunctions(agentId: string): Promise<AgentFunction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/agents/${agentId}/functions`);
      
      if (!response.ok) {
        throw new Error(`Error fetching agent functions: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in getAgentFunctions:', error);
      return [];
    }
  }

  /**
   * Get the most recent agent for a contract
   * @param contractId The contract address
   * @returns The most recent agent or null if none exists
   */
  public async getMostRecentAgentForContract(contractId: string): Promise<Agent | null> {
    try {
      const agents = await this.getAgentsForContract(contractId);
      
      if (!agents || agents.length === 0) {
        return null;
      }
      
      // Sort by updated_at in descending order
      const sortedAgents = agents.sort((a, b) => {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      
      return sortedAgents[0];
    } catch (error) {
      console.error('Error in getMostRecentAgentForContract:', error);
      return null;
    }
  }

  /**
   * Convert API Agent format to AgentConfiguration format using agent functions
   * @param agent The agent from the API
   * @param contractAbi The contract ABI
   * @param agentFunctions The agent's configured functions
   * @returns AgentConfiguration object
   */
  public convertAgentToConfiguration(
    agent: Agent, 
    contractAbi: string,
    agentFunctions: AgentFunction[] = []
  ): AgentConfiguration {
    try {
      // Parse ABI to an array if it's a string
      const abiArray = typeof contractAbi === 'string' ? JSON.parse(contractAbi) : contractAbi;
      
      console.log('Raw agent functions:', JSON.stringify(agentFunctions, null, 2));
      
      // Map the agent functions to the format needed for AgentConfiguration
      const functions = agentFunctions.map((func) => {
        // Find the ABI for this function
        const functionAbi = func.function_abi || abiArray.find(
          (item: any) => item.type === 'function' && item.name === func.name
        );
        
        // Create the function object with all fields from the API
        const processedFunction = {
          function_id: func.function_id,
          function_name: func.name || func.function_name, // Usar name si está disponible, o function_name como respaldo
          function_signature: func.function_signature || 
            `${func.name || func.function_name}(${functionAbi?.inputs?.map((input: any) => input.type).join(',') || ''})`,
          function_type: func.function_type as 'read' | 'write',
          is_enabled: typeof func.is_enabled === 'number' ? func.is_enabled === 1 : true,
          validation_rules: func.validation_rules || {},
          abi: functionAbi || null,
          // Asegurar que parameters sea siempre un array
          parameters: Array.isArray(func.parameters) ? 
            func.parameters.map((p: any) => ({
              name: p.name,
              type: p.type,
              value: p.value || '',
              position: p.position || 0
            })) : []
        };
        
        console.log('Processed function:', processedFunction);
        return processedFunction;
      });
      
      // If no agent functions provided, create default functions from contract ABI
      if (functions.length === 0) {
        console.log('No agent functions found, using contract ABI');
        const functionAbis = abiArray.filter((item: any) => item.type === 'function');
        
        // Create functions array from ABI
        const defaultFunctions = functionAbis.map((abi: any) => {
          return {
            function_name: abi.name,
            function_signature: `${abi.name}(${abi.inputs?.map((input: any) => input.type).join(',') || ''})`,
            function_type: (abi.stateMutability === 'view' || abi.stateMutability === 'pure') ? 'read' as const : 'write' as const,
            is_enabled: true,
            validation_rules: {},
            abi: abi
          };
        });
        
        functions.push(...defaultFunctions);
      }
      
      console.log('Final functions array:', functions);
      
      // Create a notification array - in a real scenario, you would get this from the API
      const notifications = [
        {
          notification_type: 'email' as const,
          configuration: { email: '' },
          is_enabled: false
        },
        {
          notification_type: 'discord' as const,
          configuration: { webhook_url: '' },
          is_enabled: false
        },
        {
          notification_type: 'telegram' as const,
          configuration: { chat_id: '' },
          is_enabled: false
        }
      ];

      // Create a default schedule - in a real scenario, this would come from the API
      const schedule = {
        schedule_type: 'cron' as const,
        cron_expression: '0 * * * *', // Default to hourly execution
        is_active: false
      };
      
      const agentConfiguration = {
        contract: {
          contract_id: agent.contract_id,
          address: agent.contract_id,
          chain_id: 11155111, // Default to Sepolia testnet
          name: agent.name,
          type: "ERC20", // Assuming ERC20, would need to be determined
          abi: contractAbi,
          deployed_at: agent.created_at,
          owner_address: agent.owner
        },
        agent: {
          contractId: agent.contract_id,
          name: agent.name,
          description: agent.description,
          status: agent.status,
          gas_limit: agent.gas_limit,
          max_priority_fee: agent.max_priority_fee,
          owner: agent.owner,
          contract_state: agent.contract_state || {}
        },
        functions: functions,
        schedule: schedule,
        notifications: notifications
      };
      
      console.log('Complete agent configuration:', agentConfiguration);
      return agentConfiguration;
    } catch (error) {
      console.error('Error converting agent to configuration:', error);
      throw new Error('Failed to convert agent to configuration format');
    }
  }
} 