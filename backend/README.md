# Smart Contract AI Assistant Backend

This is the backend for the Smart Contract AI Assistant. It provides a WebSocket interface to communicate with an AI agent that can help write, edit, and debug Solidity contracts.

## Features

- Integration with Anthropic's Claude AI for intelligent assistance
- Real-time communication via WebSocket
- File and directory management
- Solidity contract compilation and validation
- Automatic compilation error correction
- File caching system for better performance
- Support for multiple simultaneous clients
- Automatic client ID generation

## Requirements

- Python 3.8 or higher
- An Anthropic API key (Claude)
- Solidity Compiler (solc) installed on the system

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <directory-name>
```

2. Create a virtual environment:
```bash
# On Windows
python -m venv venv
.\venv\Scripts\activate

# On Linux/Mac
python -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
- Copy `.env.example` to `.env`
- Add your Anthropic API key in `ANTHROPIC_API_KEY`
- Adjust other settings as needed

## Usage

1. Start the server:
```bash
python main.py
```

The server will start at `http://localhost:8000` with two WebSocket endpoints available:
- `ws://localhost:8000/ws/agent` - Connection without client ID (automatically generated)
- `ws://localhost:8000/ws/agent/{client_id}` - Connection with specific client ID

### WebSocket Connection Example

```javascript
// Connection without client ID
const ws = new WebSocket('ws://localhost:8000/ws/agent');

// The server will send a message with the assigned client ID
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'connection_established') {
        console.log('Client ID:', data.client_id);
    }
};

// Send a message to the agent
ws.send(JSON.stringify({
    content: "Your message here",
    context: {
        currentFile: "path/to/file.sol",
        currentCode: "current code",
        fileSystem: {}
    }
}));
```

## Project Structure

```
backend/
├── main.py              # Main FastAPI server
├── agent.py             # AI agent logic
├── file_manager.py      # File and directory handling
├── requirements.txt     # Project dependencies
└── .env                # Environment variables (not included in git)
```

## Server Responses

The server can send different types of messages:

```json
{
    "type": "message|code_edit|file_create|file_delete|error|connection_established",
    "content": "response content",
    "metadata": {
        "path": "path/to/file",
        "language": "solidity"
    }
}
```

## Development

1. For local development, make sure you have the virtual environment activated
2. The server has hot-reload enabled by default
3. Logs are displayed in the console in real-time

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is under the MIT License - see the [LICENSE](LICENSE) file for details. 