export interface CompilerInput {
  language: 'Solidity';
  sources: {
    [key: string]: {
      content: string;
    };
  };
  settings: {
    outputSelection: {
      [key: string]: {
        [key: string]: string[];
      };
    };
    [key: string]: any;
  };
}

export interface CompilerOutput {
  contracts?: {
    [key: string]: {
      [key: string]: {
        abi: any[];
        evm: any;
        metadata: string;
        [key: string]: any;
      };
    };
  };
  errors?: CompilerError[];
  sources?: {
    [key: string]: {
      id: number;
      [key: string]: any;
    };
  };
}

export interface CompilerError {
  component: string;
  errorCode: string;
  formattedMessage: string;
  message: string;
  severity: string;
  sourceLocation?: {
    end: number;
    file: string;
    start: number;
  };
  type: string;
}

export interface ImportCallback {
  (path: string): { contents?: string; error?: string };
} 