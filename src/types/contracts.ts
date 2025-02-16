export interface ContractFunction {
  name: string;
  description: string;
  type: 'function' | 'constructor' | 'event';
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
  inputs: Array<{
    name: string;
    type: string;
    description?: string;
    components?: Array<{
      name: string;
      type: string;
    }>;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
    components?: Array<{
      name: string;
      type: string;
    }>;
  }>;
}

export interface ContractArtifact {
  name: string;
  description: string;
  functions: ContractFunction[];
  address?: string;
  abi?: any[];
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
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
  timestamp: number;
}

export interface CompilationResult {
  success: boolean;
  markers?: Array<{
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    message: string;
    severity: number;
  }>;
  output?: any;
  error?: string;
} 