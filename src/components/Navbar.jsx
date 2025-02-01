import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useChainId, useDisconnect, useSwitchChain } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

const Navbar = () => {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

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

  const handleConnect = async () => {
    try {
      if (isConnected) {
        await disconnect();
      } else {
        await open();
      }
    } catch (error) {
      console.error('Error al conectar/desconectar wallet:', error);
    }
  };

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
            <appkit-button />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;