import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useChainId, useDisconnect, useSwitchChain } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { 
  HomeIcon, 
  ArrowRightOnRectangleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const Navbar = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  // Cambiar a la red Sonic cuando se conecte
  useEffect(() => {
    if (isConnected && chainId !== 57054) {
      switchChain?.({ chainId: 57054 });
    }
  }, [isConnected, chainId, switchChain]);

  // Actualizar el título de la página cuando cambie la red
  useEffect(() => {
    const networkName = chainId === 57054 ? 'Sonic Blaze Testnet' : (chainId ? `Chain ${chainId}` : 'No Network');
    document.title = `${networkName} • Zephyrus Contract Builder Agent`;
  }, [chainId]);

  // Función para obtener el color del indicador de red
  const getNetworkIndicatorColor = () => {
    if (!isConnected) return 'bg-gray-500/70';
    if (chainId === 57054) return 'bg-emerald-500/70';
    return 'bg-yellow-500/70';
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
            {/* Network Status */}
            <div className="hidden md:flex items-center space-x-2">
              <span className={`h-2 w-2 ${getNetworkIndicatorColor()} rounded-full animate-pulse`}></span>
              <span className={`text-sm ${chainId === 57054 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {chainId === 57054 ? 'Sonic Blaze Testnet' : (chainId ? `Chain ${chainId}` : 'No Network')}
                {isConnected && chainId !== 57054 && (
                  <button
                    onClick={() => switchChain?.({ chainId: 57054 })}
                    className="ml-2 text-xs bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-300/90 px-2 py-1 rounded"
                  >
                    Switch to Sonic
                  </button>
                )}
              </span>
            </div>

            {/* Navigation Links - Only show when connected */}
            {isConnected && !isLandingPage && (
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  to="/dashboard"
                  className="flex items-center px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700/50 transition-colors"
                >
                  <HomeIcon className="w-5 h-5 mr-1" />
                  Dashboard
                </Link>
              </div>
            )}

            {/* Connect Wallet Button */}
            <div className="flex items-center">
              <appkit-button />
            </div>

            {/* User Menu - Only show when connected */}
            {isConnected && (
              <div className="relative group">
                <button className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700/50 transition-colors">
                  <span className="text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
                <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="py-1">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => disconnect()}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;