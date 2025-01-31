import React, { useState } from 'react';
import { motion } from 'framer-motion';

function ContractAdmin() {
  const [selectedContract, setSelectedContract] = useState(null);
  const [deployedContracts] = useState([
    {
      address: '0x1234...5678',
      name: 'NFT Marketplace',
      network: 'ethereum',
      deployedAt: '2024-01-20T10:00:00Z',
      type: 'NFT',
      stats: {
        totalSupply: '10,000',
        holders: '1,234',
        transactions: '5,678',
        volume: '123.45 ETH'
      },
      contractState: [
        { label: 'Paused', value: 'No', type: 'status' },
        { label: 'Owner', value: '0xabc...def', type: 'address' },
        { label: 'Implementation', value: '0x789...012', type: 'address' },
        { label: 'Total Supply', value: '10,000', type: 'number' }
      ],
      adminActions: [
        {
          name: 'pause',
          label: 'Pause Contract',
          description: 'Temporarily pause all contract operations',
          params: []
        },
        {
          name: 'unpause',
          label: 'Unpause Contract',
          description: 'Resume contract operations',
          params: []
        },
        {
          name: 'setBaseURI',
          label: 'Set Base URI',
          description: 'Update the base URI for token metadata',
          params: [
            { name: 'baseURI', type: 'string', placeholder: 'https://api.example.com/token/' }
          ]
        },
        {
          name: 'withdraw',
          label: 'Withdraw Funds',
          description: 'Withdraw accumulated fees to treasury',
          params: [
            { name: 'amount', type: 'uint256', placeholder: 'Amount in wei' },
            { name: 'recipient', type: 'address', placeholder: 'Recipient address' }
          ]
        }
      ]
    },
    {
      address: '0x5678...9012',
      name: 'Token Contract',
      network: 'polygon',
      deployedAt: '2024-01-19T15:30:00Z',
      type: 'ERC20',
      stats: {
        totalSupply: '1,000,000',
        holders: '567',
        transactions: '2,345',
        volume: '45,678 MATIC'
      },
      contractState: [
        { label: 'Paused', value: 'Yes', type: 'status' },
        { label: 'Owner', value: '0xdef...789', type: 'address' },
        { label: 'Total Supply', value: '1,000,000', type: 'number' },
        { label: 'Decimals', value: '18', type: 'number' }
      ],
      adminActions: [
        {
          name: 'mint',
          label: 'Mint Tokens',
          description: 'Create new tokens and assign them to an address',
          params: [
            { name: 'recipient', type: 'address', placeholder: 'Recipient address' },
            { name: 'amount', type: 'uint256', placeholder: 'Amount of tokens' }
          ]
        },
        {
          name: 'burn',
          label: 'Burn Tokens',
          description: 'Permanently remove tokens from circulation',
          params: [
            { name: 'amount', type: 'uint256', placeholder: 'Amount to burn' }
          ]
        }
      ]
    }
  ]);

  const executeAdminAction = async (contract, action, params = {}) => {
    try {
      console.log(`Executing ${action.name} on contract ${contract.address}`);
      console.log('Parameters:', params);
      
      // Aquí iría la lógica real de interacción con la blockchain
      // 1. Conectar con Web3/ethers
      // 2. Obtener el contrato
      // 3. Llamar a la función con los parámetros
      // 4. Esperar la confirmación
      
    } catch (error) {
      console.error('Error executing action:', error);
    }
  };

  if (!selectedContract) {
    return (
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-200">
            Your Contracts
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deployedContracts.map((contract) => (
            <motion.div
              key={contract.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-morphism gradient-border rounded-lg p-6 cursor-pointer hover:bg-gray-800/50 transition-all duration-200"
              onClick={() => setSelectedContract(contract)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-200 mb-2">
                    {contract.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-400">
                      {contract.address}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                      {contract.network}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                      {contract.type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {Object.entries(contract.stats).map(([key, value]) => (
                  <div key={key} className="glass-morphism p-3 rounded-lg">
                    <div className="text-sm text-gray-400 capitalize mb-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-base font-medium text-gray-200">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm text-gray-400">
                <span>
                  Deployed: {new Date(contract.deployedAt).toLocaleDateString()}
                </span>
                <button className="text-blue-400 hover:text-blue-300 transition-colors">
                  Manage →
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedContract(null)}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            ← Back to Contracts
          </button>
          <h2 className="text-xl font-bold text-gray-200">
            Contract Administration
          </h2>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-morphism gradient-border rounded-lg p-6"
      >
        {/* Contract Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="mb-4 md:mb-0">
            <h3 className="text-lg font-medium text-gray-200 mb-2">
              {selectedContract.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-400">
                {selectedContract.address}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                {selectedContract.network}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                {selectedContract.type}
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Deployed: {new Date(selectedContract.deployedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Contract Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(selectedContract.stats).map(([key, value]) => (
            <div key={key} className="glass-morphism p-4 rounded-lg">
              <div className="text-sm text-gray-400 capitalize mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="text-lg font-medium text-gray-200">
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Contract State */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Contract State</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedContract.contractState.map((item, index) => (
              <div
                key={index}
                className="glass-morphism p-4 rounded-lg"
              >
                <div className="text-sm text-gray-400 mb-1">{item.label}</div>
                <div className="font-mono text-sm break-all">
                  {item.type === 'status' ? (
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      item.value === 'Yes' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {item.value}
                    </span>
                  ) : item.type === 'address' ? (
                    <a
                      href={`https://etherscan.io/address/${item.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <span className="text-gray-200">{item.value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Actions */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Administrative Actions</h4>
          <div className="space-y-4">
            {selectedContract.adminActions.map((action, index) => (
              <div
                key={index}
                className="glass-morphism p-4 rounded-lg"
              >
                <div className="flex flex-col md:flex-row justify-between mb-4">
                  <div>
                    <h5 className="text-base font-medium text-gray-200 mb-1">
                      {action.label}
                    </h5>
                    <p className="text-sm text-gray-400">
                      {action.description}
                    </p>
                  </div>
                </div>

                {action.params.length > 0 ? (
                  <div className="space-y-4">
                    {action.params.map((param, pIndex) => (
                      <div key={pIndex} className="flex flex-col">
                        <label className="text-sm text-gray-400 mb-1">
                          {param.name} ({param.type})
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={param.placeholder}
                            className="flex-1 px-3 py-2 glass-morphism rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={(e) => param.value = e.target.value}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => executeAdminAction(selectedContract, action, action.params.reduce((acc, param) => ({
                        ...acc,
                        [param.name]: param.value
                      }), {}))}
                      className="w-full px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                    >
                      Execute {action.label}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => executeAdminAction(selectedContract, action)}
                    className="w-full px-4 py-2 glass-morphism text-gray-300 rounded-lg hover:bg-gray-700/30 transition-colors"
                  >
                    Execute {action.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default ContractAdmin;