import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function DeploymentConsole() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
  const [gasPrice, setGasPrice] = useState(5);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [deployedContract, setDeployedContract] = useState(null);
  const [shareFormData, setShareFormData] = useState({
    title: '',
    description: '',
    tags: []
  });

  const networks = [
    { 
      id: 'ethereum', 
      name: 'Ethereum Mainnet', 
      icon: '🌐',
      chainId: 1
    },
    { 
      id: 'goerli', 
      name: 'Goerli Testnet', 
      icon: '🔷',
      chainId: 5
    },
    { 
      id: 'polygon', 
      name: 'Polygon', 
      icon: '💜',
      chainId: 137
    },
    { 
      id: 'bsc', 
      name: 'BSC', 
      icon: '💛',
      chainId: 56
    },
    { 
      id: 'sonic', 
      name: 'Sonic Blaze Testnet', 
      icon: '⚡',
      chainId: 57054,
      rpcUrl: 'https://rpc.blaze.soniclabs.com',
      nativeCurrency: {
        name: 'Sonic',
        symbol: 'S',
        decimals: 18
      }
    }
  ];

  const switchNetwork = async (networkId) => {
    const network = networks.find(n => n.id === networkId);
    if (!network) return;

    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${network.chainId.toString(16)}` }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${network.chainId.toString(16)}`,
                  chainName: network.name,
                  rpcUrls: network.rpcUrl ? [network.rpcUrl] : [],
                  nativeCurrency: network.nativeCurrency,
                },
              ],
            });
          } catch (addError) {
            console.error('Error adding network:', addError);
            setLogs(prev => [...prev, { type: 'error', message: `Failed to add network: ${addError.message}` }]);
          }
        }
        console.error('Error switching network:', switchError);
        setLogs(prev => [...prev, { type: 'error', message: `Failed to switch network: ${switchError.message}` }]);
      }
    }
  };

  const handleNetworkChange = async (e) => {
    const newNetwork = e.target.value;
    setSelectedNetwork(newNetwork);
    await switchNetwork(newNetwork);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setLogs([{ type: 'info', message: 'Starting deployment process...' }]);

    try {
      // Ensure correct network
      await switchNetwork(selectedNetwork);
      
      setLogs(prev => [...prev, 
        { type: 'process', message: 'Compiling contracts...' },
        { type: 'process', message: 'Optimizing bytecode...' },
        { type: 'success', message: 'Compilation successful!' },
        { type: 'process', message: 'Deploying to network...' },
      ]);

      // Deployment logic here...
      
      setLogs(prev => [...prev,
        { type: 'success', message: 'Contract deployed successfully!' },
        { type: 'info', message: 'Contract Address: 0x1234...5678' }
      ]);

      setDeployedContract({
        address: '0x1234...5678',
        network: selectedNetwork,
        timestamp: new Date().toISOString(),
        code: '// Contract code here...'
      });
      
      setShowShareDialog(true);
    } catch (error) {
      console.error('Deployment error:', error);
      setLogs(prev => [...prev, { type: 'error', message: `Deployment failed: ${error.message}` }]);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleShare = () => {
    const contractData = {
      ...shareFormData,
      address: deployedContract.address,
      network: deployedContract.network,
      code: deployedContract.code,
      deployedAt: deployedContract.timestamp,
      author: 'Current User',
      rewardEnabled: true,
      rewardPercentage: 40
    };

    navigate('/social');
    setShowShareDialog(false);
  };

  return (
    <div className="container mx-auto relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-200">
          Deploy Contract
        </h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-morphism gradient-border rounded-lg p-6"
      >
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Network
              </label>
              <select
                value={selectedNetwork}
                onChange={handleNetworkChange}
                className="w-full p-3 glass-morphism rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.icon} {network.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Gas Price (Gwei)
              </label>
              <input
                type="number"
                value={gasPrice}
                onChange={(e) => setGasPrice(e.target.value)}
                className="w-full p-3 glass-morphism rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">
            Deployment Console
          </h3>
          <div className="glass-morphism rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`mb-2 ${
                  log.type === 'success'
                    ? 'text-emerald-400'
                    : log.type === 'error'
                    ? 'text-red-400'
                    : log.type === 'process'
                    ? 'text-gray-400'
                    : 'text-gray-500'
                }`}
              >
                {`> ${log.message}`}
              </motion.div>
            ))}
            {isDeploying && (
              <div className="flex items-center space-x-2 text-gray-400">
                <span className="animate-pulse">⚡</span>
                <span>Processing...</span>
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={handleDeploy}
          disabled={isDeploying}
          className={`w-full py-3 rounded-lg text-gray-200 font-medium transition-all duration-200 ${
            isDeploying
              ? 'bg-gray-700/50 cursor-not-allowed'
              : 'glass-morphism hover:bg-gray-700/30'
          }`}
        >
          {isDeploying ? 'Deploying...' : 'Deploy Contract'}
        </button>
      </motion.div>

      {/* Share Contract Dialog */}
      <AnimatePresence>
        {showShareDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-morphism rounded-lg p-6 max-w-lg w-full mx-4"
            >
              <h2 className="text-xl font-bold mb-4 text-gray-200">
                Zephyrus Contract Deployed Successfully! 🎉
              </h2>
              <p className="text-gray-300 mb-6">
                Share your Zephyrus contract with the community and earn rewards when others use it as a template.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Contract Title
                  </label>
                  <input
                    type="text"
                    value={shareFormData.title}
                    onChange={(e) => setShareFormData({...shareFormData, title: e.target.value})}
                    className="w-full p-3 glass-morphism rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="E.g., Zephyrus NFT Marketplace Pro"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Description
                  </label>
                  <textarea
                    value={shareFormData.description}
                    onChange={(e) => setShareFormData({...shareFormData, description: e.target.value})}
                    className="w-full p-3 glass-morphism rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe your contract and its main features..."
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    placeholder="NFT, DeFi, Gaming (comma separated)"
                    className="w-full p-3 glass-morphism rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setShareFormData({
                      ...shareFormData,
                      tags: e.target.value.split(',').map(tag => tag.trim())
                    })}
                  />
                </div>

                <div className="p-4 glass-morphism rounded-lg bg-blue-500/10">
                  <h4 className="text-blue-400 font-medium mb-2">Rewards Program</h4>
                  <p className="text-gray-300">
                    By sharing your contract, you'll automatically receive <span className="text-blue-400 font-semibold">40%</span> of the 
                    deployment commission every time someone uses your contract as a template.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleShare}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Share and Earn
                </button>
                <button
                  onClick={() => setShowShareDialog(false)}
                  className="flex-1 py-3 glass-morphism text-gray-300 rounded-lg hover:bg-gray-700/30 transition-colors duration-200"
                >
                  Not Now
                </button>
              </div>

              <p className="text-sm text-gray-400 mt-4 text-center">
                By sharing your contract, you agree to the terms of use and rewards policy.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DeploymentConsole;