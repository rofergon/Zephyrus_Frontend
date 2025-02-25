import React, { useState, useEffect } from 'react';
import { ContractFunction } from '../types/contracts';
import { useContractInteraction } from '../services/contractInteractionService';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type BaseError, Hash } from 'viem';
import { safeStringify } from '../utils/bigIntUtils';

interface FunctionCardProps {
  func: ContractFunction;
  contractAddress?: string;
  abi?: any[];
  deploymentResult?: {
    success?: boolean;
    contractAddress?: string;
    transactionHash?: string;
    error?: string;
  } | null;
}

const FunctionCard: React.FC<FunctionCardProps> = ({ func, contractAddress, abi, deploymentResult }) => {
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [effectiveAddress, setEffectiveAddress] = useState<string>(contractAddress || '');
  const [txHash, setTxHash] = useState<Hash | undefined>();
  const { address, isConnected } = useAccount();
  const { executeRead } = useContractInteraction(effectiveAddress, abi || []);

  // Configurar useWriteContract para funciones de escritura
  const { 
    data: hash,
    error: writeError,
    isPending,
    writeContract 
  } = useWriteContract();

  // Esperar a que la transacción se complete usando el nuevo hook
  const { 
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Actualizar la dirección efectiva cuando cambie el deploymentResult
  useEffect(() => {
    if (deploymentResult?.success && deploymentResult.contractAddress) {
      setEffectiveAddress(deploymentResult.contractAddress);
      console.log('[FunctionCard] Updated contract address:', deploymentResult.contractAddress);
    }
  }, [deploymentResult]);

  // Actualizar la dirección efectiva cuando cambie contractAddress
  useEffect(() => {
    if (contractAddress) {
      setEffectiveAddress(contractAddress);
      console.log('[FunctionCard] Updated contract address from props:', contractAddress);
    }
  }, [contractAddress]);

  useEffect(() => {
    if (abi && func.name) {
      console.log(`[FunctionCard] Validating function "${func.name}" in ABI...`);
      console.log('[FunctionCard] Full ABI:', abi);

      // Buscar el elemento en el ABI según su tipo
      const abiElement = abi.find((item: any) => {
        if (func.type === 'function' && item.type === 'function') {
          return item.name === func.name;
        } else if (func.type === 'event' && item.type === 'event') {
          return item.name === func.name;
        } else if (func.type === 'constructor' && item.type === 'constructor') {
          return true; // Solo puede haber un constructor
        }
        return false;
      });

      if (abiElement) {
        console.log(`[FunctionCard] Found ${func.type} "${func.name}" in ABI:`, abiElement);
      } else {
        const availableFunctions = abi
          .filter((item: any) => item.type === func.type)
          .map((item: any) => item.name || 'constructor')
          .filter(Boolean);
        console.log(`[FunctionCard] ${func.type} "${func.name}" not found in ABI. Available ${func.type}s:`, availableFunctions);
      }
    }
  }, [abi, func.name, func.type]);

  // Actualizar el hash de la transacción cuando se reciba
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
      console.log(`[FunctionCard] Transaction hash received:`, hash);
    }
  }, [hash]);

  // Actualizar el resultado cuando la transacción se confirme
  useEffect(() => {
    if (isConfirmed && receipt) {
      console.log(`[FunctionCard] Transaction confirmed:`, receipt);
      setResult(receipt);
      setError(null);
    }
  }, [isConfirmed, receipt]);

  const handleInputChange = (name: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [name]: value
    }));
    console.log('[FunctionCard] Input changed:', name, value);
  };

  const handleExecute = async () => {
    if (!effectiveAddress || !abi || !func.name) {
      console.error('[FunctionCard] Missing required parameters:', { effectiveAddress, abi, funcName: func.name });
      return;
    }

    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      console.error('[FunctionCard] Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setResult(null); // Clear previous results

      // Procesar los valores de entrada
      const processedInputs = func.inputs.map((input) => {
        const value = inputValues[input.name] || '';
        console.log(`[FunctionCard] Processing input "${input.name}" (${input.type}):`, value);
        
        // Convert string inputs to appropriate types
        if (input.type.startsWith('uint') || input.type.startsWith('int')) {
          // Handle BigInt conversion
          try {
            return value === '' ? '0' : BigInt(value).toString();
          } catch (e) {
            throw new Error(`Invalid number format for ${input.name}`);
          }
        } else if (input.type === 'bool') {
          return value.toLowerCase() === 'true';
        } else if (input.type === 'address') {
          if (value && !value.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error(`Invalid address format for ${input.name}`);
          }
          return value || address; // Use connected address as default
        }
        return value;
      });

      // Determinar si es una función de lectura o escritura
      const isViewFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';

      if (isViewFunction) {
        // Ejecutar función de lectura
        console.log(`[FunctionCard] Executing read function "${func.name}" with inputs:`, processedInputs);
        
        let retryCount = 0;
        const maxRetries = 3;
        let lastError;

        while (retryCount < maxRetries) {
          try {
            const response = await executeRead(func.name, processedInputs);
            console.log(`[FunctionCard] Read function "${func.name}" result:`, response);
            
            if (response.success) {
              // Format the result based on the output type
              const formattedResult = formatFunctionResult(response.data, func.outputs);
              setResult(formattedResult);
              break;
            } else {
              lastError = new Error(response.error || 'Unknown error occurred');
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`[FunctionCard] Retrying read (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
                continue;
              }
              throw lastError;
            }
          } catch (error) {
            lastError = error;
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`[FunctionCard] Retrying read (${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              continue;
            }
            throw error;
          }
        }
      } else {
        // Ejecutar función de escritura
        console.log(`[FunctionCard] Executing write function "${func.name}" with inputs:`, processedInputs);
        writeContract?.({
          address: effectiveAddress as `0x${string}`,
          abi: abi || [],
          functionName: func.name,
          args: processedInputs.length > 0 ? processedInputs : [],
        });
      }
    } catch (error) {
      console.error(`[FunctionCard] Error executing ${func.type} "${func.name}":`, error);
      setError(error instanceof Error ? error.message : String(error));
      setResult(null); // Clear any partial results
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format function results
  const formatFunctionResult = (result: any, outputs?: { type: string; name: string }[]) => {
    if (!outputs || outputs.length === 0) return result;

    // Handle single output
    if (outputs.length === 1) {
      const output = outputs[0];
      if (output.type.startsWith('uint') || output.type.startsWith('int')) {
        return result.toString();
      }
      return result;
    }

    // Handle multiple outputs
    if (Array.isArray(result)) {
      return result.map((value, index) => {
        const output = outputs[index];
        if (output.type.startsWith('uint') || output.type.startsWith('int')) {
          return value.toString();
        }
        return value;
      });
    }

    return result;
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-4 hover:border-blue-500/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{func.name}</h3>
          <p className="text-sm text-gray-400">{func.description}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded-full ${
            func.stateMutability === 'view' || func.stateMutability === 'pure'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {func.stateMutability}
          </span>
        </div>
      </div>

      {/* Inputs */}
      {func.inputs.length > 0 && (
        <div className="space-y-3 mb-4">
          {func.inputs.map((input, index) => (
            <div key={index} className="space-y-1">
              <label className="text-sm text-gray-400">
                {input.name} ({input.type})
              </label>
              <input
                type="text"
                value={inputValues[input.name] || ''}
                onChange={(e) => handleInputChange(input.name, e.target.value)}
                placeholder={`Enter ${input.type}`}
                className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={isLoading || isPending || isConfirming || !isConnected || !effectiveAddress}
        className={`w-full py-2 px-4 rounded-lg ${
          isLoading || isPending || isConfirming || !isConnected || !effectiveAddress
            ? 'bg-gray-700 cursor-not-allowed opacity-50'
            : func.stateMutability === 'view' || func.stateMutability === 'pure'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white transition-colors duration-200`}
      >
        {isLoading || isPending
          ? 'Preparing...' 
          : isConfirming
          ? 'Confirming...'
          : !isConnected 
          ? 'Connect Wallet' 
          : !effectiveAddress 
          ? 'No Contract Address'
          : 'Execute'}
      </button>

      {/* Write Error */}
      {writeError && (
        <div className="mt-4 p-3 bg-red-900/20 rounded-lg border border-red-700">
          <h4 className="text-sm font-medium text-red-400 mb-1">Transaction Error:</h4>
          <div className="text-sm text-red-300">
            {(writeError as BaseError).shortMessage || writeError.message}
          </div>
        </div>
      )}

      {/* Transaction Hash */}
      {txHash && (
        <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-700">
          <h4 className="text-sm font-medium text-blue-400 mb-1">Transaction Hash:</h4>
          <div className="text-sm text-blue-300 break-all font-mono">{txHash}</div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-gray-400 mb-1">Result:</h4>
          <div className="text-sm text-white break-all font-mono">
            {typeof result === 'object' 
              ? safeStringify(result, 2)
              : String(result)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/20 rounded-lg border border-red-700">
          <h4 className="text-sm font-medium text-red-400 mb-1">Error:</h4>
          <div className="text-sm text-red-300">{error}</div>
        </div>
      )}
    </div>
  );
};

export default FunctionCard; 