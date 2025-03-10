# Zephyrus Contract Builder Agent

Zephyrus is an AI-powered smart contract development agent that helps users create, edit, deploy, and manage smart contracts on the Sonic network. The platform combines advanced AI capabilities with blockchain technology to provide an intuitive and efficient smart contract development experience.

## Features

### Smart Contract Development
- AI-assisted agent, contract creation and editing
- Real-time code validation and compilation
- Automatic error detection and fixing
- Integration with OpenZeppelin contracts
- Solidity linting support

### Agent System
- AI-powered contract agent for building and modifying contracts
- Contract function execution monitoring and logs
- Agent configuration interface for customizing behavior
- Real-time WebSocket communication with the agent
- Function-level permissions and validation rules

### Session Management
- Persistent development sessions
- Multiple session support with workspace organization
- Session history and conversation tracking
- Wallet-based session synchronization
- Real-time session updates and context switching

### File System
- Virtual file system for contract management
- File creation, editing, and deletion
- Directory organization with file explorer interface
- Import resolution for dependencies
- Drag-and-drop file manipulation

### User Interface
- Modern, responsive design with Tailwind CSS
- Real-time chat interface with AI agent
- File explorer with context menus
- Debug console for development feedback
- Dark mode optimized for long coding sessions
- Resizable panels for custom workspace layout

### Blockchain Integration
- Native support for Sonic Blaze Testnet
- Wallet connection via Web3Modal and WalletConnect
- Network status monitoring
- Contract deployment and interaction
- Contract state visualization
- Function-level interaction with deployed contracts

## Setup

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8 or higher
- Anthropic API key for AI capabilities
- WalletConnect Project ID

### Installation
1. Clone the repository:
```bash
git clone https://github.com/rofergon/Zephyrus_Frontend.git
cd Zephyrus_Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
- Copy `.env.example` to `.env`
- Add your WalletConnect Project ID
- Configure API endpoints and other necessary variables

4. Start the development server:
```bash
npm run dev
```

## Usage

1. Connect your wallet using the connect button in the navigation bar
2. Create a new workspace or select an existing one
3. Use the file explorer to manage your contracts
4. Interact with the AI agent through the chat interface to:
   - Create new contracts
   - Edit existing contracts
   - Fix compilation errors
   - Get suggestions and improvements
5. Use the debug console to track operations and view compilation results
6. Deploy and interact with your contracts directly through the interface
7. Configure agents to automate interactions with your deployed contracts

## Project Structure

```
├── src/
│   ├── components/          # React UI components
│   │   ├── chat/            # Chat interface components
│   │   ├── contract/        # Contract-related components
│   │   ├── AgentConfigForm.tsx  # Agent configuration interface
│   │   ├── AgentExecutionLogs.tsx # Agent execution monitoring
│   │   └── FileExplorer.tsx  # File system explorer
│   ├── pages/              # Application page components
│   │   └── AssistedChat.tsx # Main contract development interface
│   ├── services/           # Core application services
│   │   ├── chatService.ts   # AI chat communication
│   │   ├── compilationService.ts # Contract compilation 
│   │   ├── databaseService.ts # Local data persistence
│   │   ├── agentService.ts  # Agent management
│   │   └── deploymentService.ts # Contract deployment
│   ├── hooks/              # React custom hooks
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── workers/            # Web workers for background tasks
├── contracts/             # Example and template contracts
├── public/                # Static assets
└── docs/                  # Documentation
```

## Development

### Key Technologies
- **Frontend**: React, TypeScript, Tailwind CSS, Monaco Editor
- **State Management**: React Context API and custom services
- **Blockchain**: Web3.js, ethers.js, WalletConnect, wagmi
- **AI**: Integration with Anthropic Claude API
- **Storage**: IndexedDB for local persistence
- **Compilation**: Solidity compiler integration

### Environment Variables
Required environment variables:
- `VITE_WALLETCONNECT_PROJECT_ID`: Your WalletConnect Project ID
- `VITE_API_URL`: Backend API endpoint
- `VITE_WEBSOCKET_URL`: WebSocket endpoint for real-time updates
- `VITE_COMPILER_API_URL`: Solidity compiler API endpoint

## Repositories

The Zephyrus ecosystem consists of the following repositories:

- [Zephyrus Frontend](https://github.com/rofergon/Zephyrus_Frontend) - The main user interface and frontend application
- [Zephyrus Agent](https://github.com/rofergon/Zephyrus_Agent) - The AI agent that assists with smart contract development
- [Zephyrus Backend](https://github.com/rofergon/Zephyrus_Backend) - Backend services and API for the Zephyrus platform
- [Zephyrus Compiler](https://github.com/rofergon/Zephyrus_Compiler) - Smart contract compilation and validation service

