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
  transactionHash?: string;
  source?: string;
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
  address: string;
  name: string;
  network: string;
  deployedAt: string;
  type: string;
  abi: any[];
  contract_address?: string;
  conversation_id?: string;
  deployed_at?: string;
  tx_hash?: string;
  transactionHash?: string;
  source_code?: string;
  bytecode?: string;
  stats: {
    totalSupply?: string;
    holders?: string;
    transactions?: string;
    volume?: string;
    [key: string]: string | undefined;
  };
  contractState: ContractState[];
}

export interface ContractState {
  label: string;
  value: string | any[];
  type: 'status' | 'address' | 'number' | 'string';
}

export interface AdminAction {
  name: string;
  label: string;
  description: string;
  params: AdminActionParam[];
}

export interface AdminActionParam {
  name: string;
  type: string;
  placeholder: string;
  value?: string;
} 