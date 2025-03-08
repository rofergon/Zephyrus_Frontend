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
  const { isConnected } = useAccount();
  const { readContractData } = useContractInteraction();

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
      console.log('[FunctionCard] Contract deployed:', deploymentResult.contractAddress);
    }
  }, [deploymentResult]);

  // Actualizar la dirección efectiva cuando cambie el prop contractAddress
  useEffect(() => {
    if (contractAddress) {
      setEffectiveAddress(contractAddress);
      console.log('[FunctionCard] Contract address updated:', contractAddress);
    }
  }, [contractAddress]);

  // Validar la dirección del contrato al iniciar
  useEffect(() => {
    const validateContractAddress = async () => {
      const address = contractAddress || deploymentResult?.contractAddress;
      if (address) {
        try {
          // Verificar que la dirección es válida
          const isValid = /^0x[a-fA-F0-9]{40}$/.test(address);
          if (isValid) {
            setEffectiveAddress(address);
            console.log('[FunctionCard] Valid contract address set:', address);
          } else {
            console.error('[FunctionCard] Invalid contract address format:', address);
            setError('Invalid contract address format');
          }
        } catch (error) {
          console.error('[FunctionCard] Error validating contract address:', error);
          setError('Error validating contract address');
        }
      }
    };

    validateContractAddress();
  }, []); // Solo se ejecuta una vez al montar el componente

  useEffect(() => {
    if (!abi || !func) return;
    
    // Validar que la función exista en el ABI
    const abiElement = abi.find((element: any) => {
      return element.type === func.type && element.name === func.name;
    });

    if (!abiElement) {
    }
  }, [abi, func]);

  // Gestionar la respuesta de una transacción
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
    }
  }, [hash]);

  // Gestionar el recibo de la transacción cuando se confirma
  useEffect(() => {
    if (isConfirmed && receipt) {
      // Solo mantener este log crítico
      console.log(`[FunctionCard] Transaction confirmed successfully`);
    }
  }, [isConfirmed, receipt]);

  const handleInputChange = (name: string, value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const processedInputs = func.inputs.map((input) => {
        const value = inputValues[input.name] || '';
        
        // Procesar según el tipo de datos
        if (input.type.includes('int') && value) {
          return BigInt(value);
        } else if (input.type === 'bool') {
          return value.toLowerCase() === 'true';
        }
        
        return value;
      });

      // Función de lectura (view/pure)
      if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
        try {
          const response = await readContractData(effectiveAddress, abi || [], func.name, processedInputs);
          console.log(`[FunctionCard] Read success: ${func.name}`);
          setResult(response);
        } catch (error: any) {
          const retryCount = 0;
          const maxRetries = 2;
          
          // Reintentar en caso de errores transitorios
          if (retryCount < maxRetries) {
            try {
              const response = await readContractData(effectiveAddress, abi || [], func.name, processedInputs);
              setResult(response);
            } catch (retryError: any) {
              setError(`Error: ${retryError.message || 'Unknown error'}`);
            }
          } else {
            setError(`Error: ${error.message || 'Unknown error'}`);
          }
        }
      }
      // Función de escritura (non-payable/payable)
      else {
        // Solo mantener este log crítico
        console.log(`[FunctionCard] Writing to contract: ${func.name}`);

        // Usar Wagmi writeContract
        if (abi) {
          writeContract({
            address: effectiveAddress as `0x${string}`,
            abi: abi as any, // Cast a any para evitar el error de tipo
            functionName: func.name,
            args: processedInputs,
          });
        } else {
          throw new Error('ABI is undefined');
        }
      }
    } catch (error: any) {
      setError(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format function results

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-4 hover:border-blue-500/50 transition-colors h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{func.name}</h3>
          <p className="text-sm text-gray-400">{func.description}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded-full ${
            func.stateMutability === 'view' || func.stateMutability === 'pure'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : func.stateMutability === 'payable'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {func.stateMutability}
            {func.stateMutability === 'payable' && (
              <span className="ml-1">💰</span>
            )}
          </span>
        </div>
      </div>

      {/* Inputs */}
      {func.inputs.length > 0 && (
        <div className="space-y-3 mb-4 flex-grow">
          {func.inputs.map((input, index) => (
            <div key={index} className="space-y-1">
              <label className="text-sm text-gray-400 flex items-center gap-1">
                <span className="font-medium">{input.name}</span> 
                <span className="text-xs text-gray-500">({input.type})</span>
              </label>
              <input
                type="text"
                value={inputValues[input.name] || ''}
                onChange={(e) => handleInputChange(input.name, e.target.value)}
                placeholder={`Enter ${input.type}`}
                className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          ))}
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={isLoading || isPending || isConfirming || !isConnected || !effectiveAddress}
        className={`w-full py-2 px-4 rounded-lg font-medium ${
          isLoading || isPending || isConfirming || !isConnected || !effectiveAddress
            ? 'bg-gray-700 cursor-not-allowed opacity-50'
            : func.stateMutability === 'view' || func.stateMutability === 'pure'
            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg'
            : func.stateMutability === 'payable'
              ? 'bg-amber-600 hover:bg-amber-700 shadow-md hover:shadow-lg'
              : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
        } text-white transition-all duration-200`}
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
          <div className="text-sm text-white break-all font-mono overflow-auto max-h-32">
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