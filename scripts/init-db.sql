-- Eliminar tablas existentes
DROP TABLE IF EXISTS deployed_contracts;
DROP TABLE IF EXISTS code_history;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS agent_function_params;
DROP TABLE IF EXISTS agent_functions;
DROP TABLE IF EXISTS agent_notifications;
DROP TABLE IF EXISTS agent_execution_logs;
DROP TABLE IF EXISTS agent_schedules;
DROP TABLE IF EXISTS agents;
DROP TABLE IF EXISTS contracts;

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

-- Create contracts table
CREATE TABLE contracts (
    contract_id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    abi JSON NOT NULL,
    deployed_at TIMESTAMP NOT NULL,
    owner_address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(address, chain_id)
);

-- Create agents table
CREATE TABLE agents (
    agent_id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK (status IN ('active', 'paused', 'stopped')) DEFAULT 'paused',
    gas_limit TEXT,
    max_priority_fee TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE
);

-- Create agent_functions table
CREATE TABLE agent_functions (
    function_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    function_name TEXT NOT NULL,
    function_signature TEXT NOT NULL,
    function_type TEXT CHECK (function_type IN ('read', 'write', 'payable')) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    validation_rules JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE,
    UNIQUE(agent_id, function_signature)
);

-- Create agent_function_params table
CREATE TABLE agent_function_params (
    param_id TEXT PRIMARY KEY,
    function_id TEXT NOT NULL,
    param_name TEXT NOT NULL,
    param_type TEXT NOT NULL,
    default_value TEXT,
    validation_rules JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (function_id) REFERENCES agent_functions(function_id) ON DELETE CASCADE
);

-- Create agent_schedules table
CREATE TABLE agent_schedules (
    schedule_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    schedule_type TEXT CHECK (schedule_type IN ('interval', 'cron')) NOT NULL,
    interval_seconds INTEGER,
    cron_expression TEXT,
    next_execution TIMESTAMP,
    last_execution TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
);

-- Create agent_notifications table
CREATE TABLE agent_notifications (
    notification_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    notification_type TEXT CHECK (notification_type IN ('email', 'discord', 'telegram')) NOT NULL,
    configuration JSON NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
);

-- Create agent_execution_logs table
CREATE TABLE agent_execution_logs (
    log_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    function_id TEXT NOT NULL,
    transaction_hash TEXT,
    status TEXT CHECK (status IN ('pending', 'success', 'failed')) NOT NULL,
    error_message TEXT,
    gas_used TEXT,
    gas_price TEXT,
    execution_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE,
    FOREIGN KEY (function_id) REFERENCES agent_functions(function_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_contracts_owner ON contracts(owner_address);
CREATE INDEX idx_agents_contract ON agents(contract_id);
CREATE INDEX idx_agent_functions_agent ON agent_functions(agent_id);
CREATE INDEX idx_agent_schedules_agent ON agent_schedules(agent_id);
CREATE INDEX idx_agent_notifications_agent ON agent_notifications(agent_id);
CREATE INDEX idx_agent_execution_logs_agent ON agent_execution_logs(agent_id);
CREATE INDEX idx_agent_execution_logs_time ON agent_execution_logs(execution_time);

-- Create triggers to update updated_at timestamp
CREATE TRIGGER update_contracts_timestamp 
AFTER UPDATE ON contracts
BEGIN
    UPDATE contracts SET updated_at = CURRENT_TIMESTAMP WHERE contract_id = NEW.contract_id;
END;

CREATE TRIGGER update_agents_timestamp 
AFTER UPDATE ON agents
BEGIN
    UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE agent_id = NEW.agent_id;
END;

CREATE TRIGGER update_agent_functions_timestamp 
AFTER UPDATE ON agent_functions
BEGIN
    UPDATE agent_functions SET updated_at = CURRENT_TIMESTAMP WHERE function_id = NEW.function_id;
END;

CREATE TRIGGER update_agent_function_params_timestamp 
AFTER UPDATE ON agent_function_params
BEGIN
    UPDATE agent_function_params SET updated_at = CURRENT_TIMESTAMP WHERE param_id = NEW.param_id;
END;

CREATE TRIGGER update_agent_schedules_timestamp 
AFTER UPDATE ON agent_schedules
BEGIN
    UPDATE agent_schedules SET updated_at = CURRENT_TIMESTAMP WHERE schedule_id = NEW.schedule_id;
END;

CREATE TRIGGER update_agent_notifications_timestamp 
AFTER UPDATE ON agent_notifications
BEGIN
    UPDATE agent_notifications SET updated_at = CURRENT_TIMESTAMP WHERE notification_id = NEW.notification_id;
END; 