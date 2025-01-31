import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setIsConnected(true);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask to use this feature!');
    }
  };

  return (
    <nav className="glass-morphism border-b border-gray-800/50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-200">Z</span>
              </div>
              <span className="ml-3 text-xl font-bold text-gray-200">
                Zephyrus Contract Builder Agent
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-1">
              <span className="h-2 w-2 bg-emerald-500/70 rounded-full animate-pulse"></span>
              <span className="text-gray-400 text-sm">Ethereum Mainnet</span>
            </div>
            <button
              onClick={connectWallet}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isConnected
                  ? 'bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-300/90'
                  : 'bg-gray-700/50 hover:bg-gray-700/70 text-gray-300'
              }`}
            >
              {isConnected
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;