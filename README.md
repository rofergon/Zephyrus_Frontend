# Zephyrus Contract Builder Agent

Zephyrus is an AI-powered smart contract development agent that helps users create, edit, deploy, and manage smart contracts on the Sonic network. The platform combines advanced AI capabilities with blockchain technology to provide an intuitive and efficient smart contract development experience.

## Features

### Smart Contract Development
- AI-assisted contract creation and editing
- Real-time code validation and compilation
- Automatic error detection and fixing
- Integration with OpenZeppelin contracts
- Built-in code editor with syntax highlighting

### Session Management
- Persistent development sessions
- Multiple session support
- Session history tracking
- Wallet-based session synchronization
- Real-time session updates

### File System
- Virtual file system for contract management
- File creation, editing, and deletion
- Directory organization
- Import resolution for dependencies

### User Interface
- Modern, responsive design
- Real-time chat interface with AI agent
- File explorer with drag-and-drop support
- Debug console for development feedback
- Dark mode optimized for long coding sessions

### Network Integration
- Native support for Sonic Blaze Testnet
- Wallet connection via Web3
- Network status monitoring
- Automatic network switching

## Setup

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8 or higher
- Anthropic API key for AI capabilities

### Backend Setup
1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
- Copy `.env.example` to `.env`
- Add your Anthropic API key
- Adjust other settings as needed

5. Start the backend server:
```bash
python main.py
```

### Frontend Setup
1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env.example` to `.env`
- Add your WalletConnect Project ID
- Configure other necessary variables

3. Start the development server:
```bash
npm run dev
```

## Usage

1. Connect your wallet using the connect button in the navigation bar
2. Create a new session or select an existing one
3. Use the file explorer to manage your contracts
4. Interact with the AI agent through the chat interface to:
   - Create new contracts
   - Edit existing contracts
   - Fix compilation errors
   - Get suggestions and improvements
5. Use the debug console to track operations and view compilation results

## Development

### Project Structure
```
├── backend/
│   ├── agent.py           # AI agent implementation
│   ├── file_manager.py    # File system management
│   ├── main.py           # FastAPI server
│   └── session_manager.py # Session handling
├── src/
│   ├── components/       # React components
│   ├── pages/           # Application pages
│   ├── services/        # Frontend services
│   └── workers/         # Web workers
```

### Key Technologies
- Frontend: React, TypeScript, Tailwind CSS
- Backend: Python, FastAPI, Anthropic Claude
- Blockchain: Web3, WalletConnect
- Storage: IndexedDB, File System API

