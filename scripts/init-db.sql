-- Eliminar tablas existentes
DROP TABLE IF EXISTS deployed_contracts;
DROP TABLE IF EXISTS code_history;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS users;

-- Crear tablas
CREATE TABLE users (
    wallet_address TEXT PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_wallet TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_wallet) REFERENCES users(wallet_address)
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    content TEXT NOT NULL,
    sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE code_history (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    code_content TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'solidity',
    version TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE deployed_contracts (
    id TEXT PRIMARY KEY,
    user_wallet TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    name TEXT NOT NULL,
    abi TEXT NOT NULL,
    bytecode TEXT NOT NULL,
    source_code TEXT NOT NULL,
    compiler_version TEXT,
    constructor_args TEXT,
    network_id INTEGER NOT NULL DEFAULT 57054,
    deployed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_wallet) REFERENCES users(wallet_address),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Crear índices
CREATE INDEX idx_conversations_user_wallet ON conversations(user_wallet);
CREATE INDEX idx_conversations_last_accessed ON conversations(last_accessed);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_code_history_conversation_id ON code_history(conversation_id);
CREATE INDEX idx_deployed_contracts_user_wallet ON deployed_contracts(user_wallet);
CREATE INDEX idx_deployed_contracts_conversation_id ON deployed_contracts(conversation_id); 