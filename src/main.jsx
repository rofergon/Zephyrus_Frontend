import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

import App from './App'
import './index.css'

// Configurar la red Sonic Blaze Testnet según la documentación oficial
const sonicBlaze = {
  id: 57054,
  name: 'Sonic Blaze Testnet',
  network: 'sonic-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Sonic',
    symbol: 'S',
  },
  rpcUrls: {
    public: { http: ['https://rpc.blaze.soniclabs.com'] },
    default: { http: ['https://rpc.blaze.soniclabs.com'] },
  },
  blockExplorers: {
    default: { name: 'SonicScan', url: 'https://testnet.sonicscan.org' },
  },
  testnet: true,
}

if (!import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID) {
  throw new Error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable')
}

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID

const metadata = {
  name: 'Zephyrus Contract Builder',
  description: 'Smart Contract Builder Agent',
  url: 'https://zephyrus.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

// Create react-query client
const queryClient = new QueryClient()

// Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks: [sonicBlaze],
  projectId,
  metadata,
  ssr: true
})

// Create AppKit
createAppKit({
  adapters: [wagmiAdapter],
  networks: [sonicBlaze],
  projectId,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: []
  }
})

// Establecer el título inicial
document.title = 'Sonic Blaze Testnet • Zephyrus Contract Builder Agent'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)