export interface ContractFunction {
  name: string;
  description: string;
  type: 'function';
  stateMutability: string;
  inputs: {
    name: string;
    type: string;
    internalType?: string;
    components?: any[];
  }[];
  outputs: {
    name: string;
    type: string;
    internalType?: string;
    components?: any[];
  }[];
}

export interface ContractEvent {
  name: string;
  description: string;
  type: 'event';
  inputs: {
    name: string;
    type: string;
    indexed: boolean;
  }[];
}

export interface ContractError {
  name: string;
  description: string;
  type: 'error';
  inputs: {
    name: string;
    type: string;
  }[];
}

export interface ContractConstructor {
  description: string;
  type: 'constructor';
  inputs: {
    name: string;
    type: string;
    internalType?: string;
  }[];
}

export interface ContractArtifact {
  name: string;
  description: string;
  address?: string;
  bytecode?: string;
  abi: any[];
  functions: ContractFunction[];
  events?: ContractEvent[];
  errors?: ContractError[];
  constructor: ContractConstructor | null;
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
  isTyping?: boolean;
  showAnimation?: boolean;
}

export interface ConsoleMessage {
  id: string;
  type: 'info' | 'error' | 'warning' | 'success';
  content: string;
  timestamp: number;
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
  user_wallet?: string;
  contract_address?: string;
  name?: string;
  conversation_id?: string;
  deployed_at?: string;
  deployedAt?: number;
  source_code?: string | any;
  sourceCode?: string | any;
  abi?: any;
  bytecode?: string;
  constructor_args?: string;
  constructorArgs?: any[];
  network_id?: number;
  networkId?: string;
  compiler_version?: string;
  compilerVersion?: string;
  tx_hash?: string;
  transactionHash?: string;
} 