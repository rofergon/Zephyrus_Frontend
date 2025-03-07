import { Buffer as BufferPolyfill } from 'rollup-plugin-node-polyfills/polyfills/buffer-es6';
import process from 'process';

if (typeof window !== 'undefined') {
  window.global = window;
  window.Buffer = BufferPolyfill;
  window.process = process;
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { safe } from 'wagmi/connectors'
import { sonicBlaze } from './config/chains'

import App from './App'
import './index.css'

// Create react-query client
const queryClient = new QueryClient()

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

// Create Safe Connector
const safeConnector = safe({
  chains: [sonicBlaze],
  options: {
    allowedDomains: [/gnosis-safe.io$/, /app.safe.global$/],
    debug: false,
  },
})

// Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks: [sonicBlaze],
  projectId,
  ssr: true,
  transports: {
    [sonicBlaze.id]: http(sonicBlaze.rpcUrls.default.http[0])
  },
  connectors: [safeConnector]
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

// Create AppKit Provider component
function AppKitProvider({ children }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

// Prevent multiple root creation
let root
const rootElement = document.getElementById('root')

if (!root && rootElement) {
  root = ReactDOM.createRoot(rootElement)
}

root.render(
  <React.StrictMode>
    <AppKitProvider>
      <App />
    </AppKitProvider>
  </React.StrictMode>
)