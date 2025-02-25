export interface ContractFunction {
  name: string;
  description: string;
  type: 'function' | 'constructor' | 'event';
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
  inputs: {
    name: string;
    type: string;
    description?: string;
    components?: any[];
  }[];
  outputs?: {
    name: string;
    type: string;
    components?: any[];
  }[];
}

export interface ContractArtifact {
  name: string;
  description: string;
  functions: Array<{
    name: string;
    description: string;
    type: 'function';
    stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
    inputs: Array<{
      name: string;
      type: string;
      description: string;
      components?: any[];
    }>;
    outputs: Array<{
      name: string;
      type: string;
      components?: any[];
    }>;
  }>;
  events?: Array<{
    name: string;
    description: string;
    type: 'event';
    inputs: Array<{
      name: string;
      type: string;
      description: string;
      components?: any[];
      indexed: boolean;
    }>;
  }>;
  constructor?: {
    name: string;
    description: string;
    type: 'constructor';
    stateMutability: 'nonpayable' | 'payable';
    inputs: Array<{
      name: string;
      type: string;
      description: string;
      components?: any[];
    }>;
  } | null;
  errors?: Array<{
    name: string;
    description: string;
    type: 'error';
    inputs: Array<{
      name: string;
      type: string;
      description: string;
      components?: any[];
    }>;
  }>;
  address?: string;
  abi: any[];
  bytecode?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

export interface ConsoleMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'process';
  message: string;
  timestamp?: number;
}

export interface CompilationResult {
  success: boolean;
  markers?: any[];
  output?: {
    artifact?: ContractArtifact;
    [key: string]: any;
  };
  error?: string;
}

export interface DeployedContract {
  id: string;
  wallet_address: string;
  conversation_id: string;
  contract_address: string;
  name: string;
  abi: string | null;
  bytecode: string;
  source_code: string | null;
  compiler_version: string | null;
  constructor_args: string | null;
  network_id: string | null;
  deployed_at: string;
  sourceCode: {
    content: string;
    language: string;
    version: string;
    timestamp: string;
    format: string;
    encoding: string;
  } | string | null;
  constructorArgs: any[] | null;
} 