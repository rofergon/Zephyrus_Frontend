import React, { useState } from 'react';
import { ContractFunction } from '../types/contracts';
import { useContractInteraction } from '../services/contractInteractionService';

interface FunctionCardProps {
  func: ContractFunction;
  contractAddress?: string;
  abi?: any[];
}


const FunctionCard: React.FC<FunctionCardProps> = ({ func, contractAddress, abi }) => {
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { executeWrite, executeRead } = useContractInteraction(contractAddress || '', abi || []);

  const handleInputChange = (name: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleExecute = async () => {
    if (!contractAddress || !abi) {
      setError('Contract address or ABI not provided');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Preparar los argumentos en el orden correcto
      const args = func.inputs.map(input => {
        const value = inputValues[input.name];
        // Convertir el valor según el tipo
        switch (input.type) {
          case 'uint256':
            return BigInt(value);
          case 'bool':
            return value.toLowerCase() === 'true';
          case 'address':
            return value as `0x${string}`;
          default:
            return value;
        }
      });

      // Ejecutar la función
      const response = func.stateMutability === 'view' || func.stateMutability === 'pure'
        ? await executeRead(func.name, args)
        : await executeWrite(func.name, args);

      if (response.success) {
        setResult(response.data || response.transactionHash);
      } else {
        setError(response.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
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
        disabled={isLoading || !contractAddress}
        className={`w-full py-2 px-4 rounded-lg ${
          isLoading
            ? 'bg-gray-700 cursor-not-allowed'
            : func.stateMutability === 'view' || func.stateMutability === 'pure'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white transition-colors duration-200`}
      >
        {isLoading ? 'Executing...' : 'Execute'}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-gray-400 mb-1">Result:</h4>
          <div className="text-sm text-white break-all">
            {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
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