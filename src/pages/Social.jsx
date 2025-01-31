import React, { useState } from 'react';
import { motion } from 'framer-motion';

function Social() {
  const [contracts, setContracts] = useState([
    {
      id: 1,
      title: "NFT Marketplace Pro",
      author: "CryptoMaster",
      authorAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      description: "Complete marketplace with auction and offer support",
      likes: 156,
      forks: 23,
      tags: ["NFT", "Marketplace", "DeFi"],
      createdAt: "2023-12-20",
      verified: true
    },
    {
      id: 2,
      title: "DeFi Yield Farming",
      author: "YieldHunter",
      authorAddress: "0x1234567890123456789012345678901234567890",
      description: "Farming contract with dynamic APY and multiple rewards",
      likes: 89,
      forks: 12,
      tags: ["DeFi", "Yield", "Farming"],
      createdAt: "2023-12-19"
    }
  ]);

  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handleLike = (id) => {
    setContracts(contracts.map(contract => 
      contract.id === id ? { ...contract, likes: contract.likes + 1 } : contract
    ));
  };

  const handleFork = (id) => {
    setContracts(contracts.map(contract => 
      contract.id === id ? { ...contract, forks: contract.forks + 1 } : contract
    ));
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="container mx-auto px-4">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-200">
            Contract Community
          </h1>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
            Publish Contract
          </button>
        </div>
        
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Search contracts..."
            className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="nft">NFT</option>
            <option value="defi">DeFi</option>
            <option value="dao">DAO</option>
            <option value="gaming">Gaming</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contracts.map((contract) => (
          <motion.div
            key={contract.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-morphism gradient-border rounded-lg p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {contract.author[0]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {contract.title}
                  </h3>
                  <div className="flex flex-col">
                    <p className="text-sm text-gray-400">
                      by {contract.author}
                    </p>
                    <a 
                      href={`https://etherscan.io/address/${contract.authorAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {formatAddress(contract.authorAddress)}
                    </a>
                  </div>
                </div>
              </div>
              {contract.verified && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                  Verified
                </span>
              )}
            </div>

            <p className="text-gray-300 mb-4">
              {contract.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {contract.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-400">
              <div className="flex space-x-4">
                <button
                  onClick={() => handleLike(contract.id)}
                  className="flex items-center space-x-1 hover:text-blue-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>{contract.likes}</span>
                </button>
                <button
                  onClick={() => handleFork(contract.id)}
                  className="flex items-center space-x-1 hover:text-blue-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <span>{contract.forks}</span>
                </button>
              </div>
              <span>{contract.createdAt}</span>
            </div>

            <div className="mt-4 flex space-x-2">
              <button className="flex-1 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors">
                View Code
              </button>
              <button className="flex-1 px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors">
                Use as Template
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default Social;