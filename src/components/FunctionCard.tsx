import React, { useState } from 'react';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface ContractFunction {
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

interface FunctionCardProps {
  func: ContractFunction;
}

const generateExampleValue = (type: string): string => {
  switch (type) {
    case 'uint256':
    case 'uint':
      return '1000000000000000000';
    case 'uint8':
      return '100';
    case 'address':
      return '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    case 'bool':
      return 'true';
    case 'string':
      return '"Example String"';
    case 'bytes':
      return '0x0123456789abcdef';
    default:
      if (type.includes('[]')) {
        return '[]';
      }
      return '""';
  }
};

const FunctionCard: React.FC<FunctionCardProps> = ({ func }) => {
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleInputChange = (name: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCopyFunction = () => {
    const functionText = `${func.name}(${func.inputs.map(input => `${input.type} ${input.name}`).join(', ')})`;
    navigator.clipboard.writeText(functionText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isViewOrPure = func.stateMutability === 'view' || func.stateMutability === 'pure';
  
  return (
    <div 
      className={`relative transform transition-all duration-200 ${
        isExpanded ? 'scale-100' : isHovered ? 'scale-[1.02]' : 'scale-100'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="function-card"
    >
      <div className={`
        relative overflow-hidden rounded-xl backdrop-blur-sm
        ${isExpanded ? 'ring-2' : 'hover:ring-1'} 
        ${isViewOrPure 
          ? 'bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 ring-emerald-500/30' 
          : 'bg-gradient-to-br from-blue-900/20 to-blue-800/10 ring-blue-500/30'
        }
        transition-all duration-300 ease-out
      `}>
        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-white">
                  {func.name}
                </h3>
                <div className={`
                  px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${isViewOrPure 
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' 
                    : 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                  }
                `}>
                  {func.stateMutability}
                </div>
                <button
                  onClick={handleCopyFunction}
                  className={`
                    p-1.5 rounded-lg transition-all duration-200
                    ${isCopied 
                      ? 'bg-green-500/20 text-green-300' 
                      : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'
                    }
                  `}
                  title={isCopied ? "Copied!" : "Copy function signature"}
                >
                  {isCopied ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                {func.description}
              </p>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`
                p-2 rounded-lg transition-all duration-300
                ${isExpanded 
                  ? isViewOrPure ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                  : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'
                }
              `}
            >
              <ChevronDownIcon className={`
                w-5 h-5 transform transition-transform duration-300
                ${isExpanded ? 'rotate-180' : 'rotate-0'}
              `} />
            </button>
          </div>

          {/* Expanded Content */}
          <div className={`
            space-y-6 transition-all duration-300 ease-out
            ${isExpanded ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden'}
          `}>
            {/* Inputs */}
            {func.inputs.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                  <DocumentTextIcon className="w-4 h-4" />
                  <span>Input Parameters</span>
                </h4>
                <div className="space-y-4">
                  {func.inputs.map((input, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">
                          <span className="text-gray-300">{input.name}</span>
                          <span className="text-gray-500 ml-2">({input.type})</span>
                        </label>
                        <button
                          onClick={() => handleInputChange(input.name, generateExampleValue(input.type))}
                          className={`
                            text-xs px-2 py-1 rounded-md transition-colors duration-200
                            ${isViewOrPure 
                              ? 'text-emerald-400 hover:bg-emerald-500/20' 
                              : 'text-blue-400 hover:bg-blue-500/20'
                            }
                          `}
                        >
                          Use example
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={inputValues[input.name] || ''}
                          onChange={(e) => handleInputChange(input.name, e.target.value)}
                          placeholder={`Enter ${input.type} value`}
                          className={`
                            w-full bg-gray-900/50 rounded-lg px-4 py-2.5 text-white text-sm
                            border transition-colors duration-200
                            ${isViewOrPure 
                              ? 'border-emerald-500/30 focus:border-emerald-500 focus:ring-emerald-500/50' 
                              : 'border-blue-500/30 focus:border-blue-500 focus:ring-blue-500/50'
                            }
                            focus:outline-none focus:ring-2 placeholder-gray-500
                          `}
                        />
                        {input.description && (
                          <p className="mt-1.5 text-xs text-gray-500">{input.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outputs */}
            {func.outputs && func.outputs.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                  <ArrowPathIcon className="w-4 h-4" />
                  <span>Return Values</span>
                </h4>
                <div className={`
                  rounded-lg p-3 space-y-2
                  ${isViewOrPure 
                    ? 'bg-emerald-900/20 border border-emerald-500/20' 
                    : 'bg-blue-900/20 border border-blue-500/20'
                  }
                `}>
                  {func.outputs.map((output, idx) => (
                    <div key={idx} className="text-sm flex items-center space-x-2">
                      <span className="text-gray-300">{output.name || `output${idx + 1}`}</span>
                      <span className="text-gray-500">({output.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Button */}
            <button
              className={`
                w-full px-4 py-3 rounded-lg text-white text-sm font-medium
                transition-all duration-200 transform hover:translate-y-[-1px]
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
                ${isViewOrPure 
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 focus:ring-emerald-500' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:ring-blue-500'
                }
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
              `}
              onClick={() => {
                // Aquí iría la lógica de ejecución
                console.log('Function inputs:', inputValues);
              }}
            >
              <span className="flex items-center justify-center space-x-2">
                {isViewOrPure ? (
                  <>
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    <span>Query</span>
                  </>
                ) : (
                  <>
                    <BoltIcon className="w-4 h-4" />
                    <span>Execute</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunctionCard; 