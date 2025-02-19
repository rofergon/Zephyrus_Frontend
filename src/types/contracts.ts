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
  functions: ContractFunction[];
  abi?: any[];
  bytecode?: string;
  address?: string;
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