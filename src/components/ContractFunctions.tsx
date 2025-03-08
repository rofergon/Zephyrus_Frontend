import React, { useState } from 'react';
import { DeployedContract } from '../types/contracts';
import FunctionCard from './FunctionCard';

interface ContractFunctionsProps {
  contract: DeployedContract;
  showInColumns?: boolean;
}

const ContractFunctions: React.FC<ContractFunctionsProps> = ({ 
  contract, 
  showInColumns = true
}) => {
  const [] = useState<'all' | 'read' | 'write'>('all');

  // Verificar que el contrato tenga un ABI
  if (!contract.abi || !Array.isArray(contract.abi)) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
        <p className="text-red-400">No se pudo cargar el ABI del contrato o el formato no es válido.</p>
      </div>
    );
  }

  // Obtener las funciones de lectura (view/pure)
  const readFunctions = contract.abi.filter((item: any) => 
    item.type === 'function' && 
    (item.stateMutability === 'view' || item.stateMutability === 'pure')
  );

  // Obtener las funciones de escritura no pagables
  const nonPayableFunctions = contract.abi.filter((item: any) => 
    item.type === 'function' && 
    item.stateMutability === 'nonpayable'
  );

  // Obtener las funciones pagables
  const payableFunctions = contract.abi.filter((item: any) => 
    item.type === 'function' && 
    item.stateMutability === 'payable'
  );

  return (
    <div className="space-y-8">
      <h4 className="text-base font-medium text-gray-300 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Contract Functions
      </h4>
      
      {/* Read Functions (View/Pure) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h5 className="text-base font-medium text-emerald-400 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            Read Functions
          </h5>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
            View/Pure
          </span>
          <span className="text-xs bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full border border-gray-600/30">
            {readFunctions.length} {readFunctions.length === 1 ? 'function' : 'functions'}
          </span>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          These functions retrieve data from the blockchain without modifying the contract state. No gas fees required.
        </p>
        <div className={`grid grid-cols-1 ${showInColumns ? 'md:grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
          {readFunctions.map((func: any, index: number) => (
            <FunctionCard
              key={`read-${index}`}
              func={func}
              contractAddress={contract.address}
              abi={contract.abi}
            />
          ))}
        </div>
      </div>
      
      {/* Write Functions (Non-payable/Payable) */}
      <div className="space-y-4 mt-12">
        <div className="flex items-center gap-3">
          <h5 className="text-base font-medium text-blue-400 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Write Functions
          </h5>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">
              Non-payable
            </span>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
              Payable
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </div>
          <span className="text-xs bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full border border-gray-600/30">
            {nonPayableFunctions.length + payableFunctions.length} {nonPayableFunctions.length + payableFunctions.length === 1 ? 'function' : 'functions'}
          </span>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          These functions modify the blockchain state and require gas fees for execution.
        </p>
        
        {/* NonPayable Functions */}
        <div className={`grid grid-cols-1 ${showInColumns ? 'md:grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
          {nonPayableFunctions.map((func: any, index: number) => (
            <FunctionCard
              key={`nonpayable-${index}`}
              func={func}
              contractAddress={contract.address}
              abi={contract.abi}
            />
          ))}
        </div>
        
        {/* Payable Functions - if any exist */}
        {payableFunctions.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <h6 className="text-base font-medium text-amber-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.433.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                Payable Functions
              </h6>
              <span className="text-xs bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full border border-gray-600/30">
                {payableFunctions.length} {payableFunctions.length === 1 ? 'function' : 'functions'}
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              These functions require you to send ETH along with the transaction.
            </p>
            <div className={`grid grid-cols-1 ${showInColumns ? 'md:grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
              {payableFunctions.map((func: any, index: number) => (
                <FunctionCard
                  key={`payable-${index}`}
                  func={func}
                  contractAddress={contract.address}
                  abi={contract.abi}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractFunctions; 