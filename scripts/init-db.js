import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample data for initialization
const sampleData = {
  contract: {
    contract_id: "0xa199dadb19440efdd5d9f19de435d070b9c05c94",
    address: "0xa199dadb19440efdd5d9f19de435d070b9c05c94",
    chain_id: 11155111,
    name: "Test Token",
    type: "ERC20",
    abi: JSON.stringify([
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          }
        ],
        "name": "allowance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ]),
    deployed_at: new Date().toISOString(),
    owner_address: "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38"
  },
  agent: {
    agent_id: "67a6fcdc-23ad-4eff-8e4e-761c3-982cd27",
    contract_id: "0xa199dadb19440efdd5d9f19de435d070b9c05c94",
    name: "Smart Contract Agent",
    description: "Sample agent for testing",
    status: "paused",
    gas_limit: "300000",
    max_priority_fee: "1.5",
    owner: "0xaB6E247B25463F76E81aBAbBb6b0b86B40d45D38",
    contract_state: JSON.stringify({
      paused: false,
      symbol: "TST"
    })
  },
  functions: [
    {
      function_id: "9d232309-4c74-449f-b99f-7dd54a3feb4e",
      agent_id: "67a6fcdc-23ad-4eff-8e4e-761c3-982cd27",
      function_name: "allowance",
      function_signature: "allowance(address,address)",
      function_type: "read",
      is_enabled: true,
      validation_rules: JSON.stringify({
        owner: {},
        spender: {}
      }),
      abi: JSON.stringify({
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address"
          },
          {
            internalType: "address",
            name: "spender",
            type: "address"
          }
        ],
        name: "allowance",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      })
    }
  ],
  schedule: {
    schedule_id: "19a64d8a-19a0-4ae5-b411-dbd6abf0556c",
    agent_id: "67a6fcdc-23ad-4eff-8e4e-761c3-982cd27",
    schedule_type: "cron",
    cron_expression: "0 0 * * *",
    is_active: true,
    next_execution: null
  }
};

async function insertSampleData(client) {
  try {
    // Insert contract
    await client.execute({
      sql: `INSERT INTO contracts (contract_id, address, chain_id, name, type, abi, deployed_at, owner_address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sampleData.contract.contract_id,
        sampleData.contract.address,
        sampleData.contract.chain_id,
        sampleData.contract.name,
        sampleData.contract.type,
        sampleData.contract.abi,
        sampleData.contract.deployed_at,
        sampleData.contract.owner_address
      ]
    });

    // Insert agent
    await client.execute({
      sql: `INSERT INTO agents (agent_id, contract_id, name, description, status, gas_limit, max_priority_fee, owner, contract_state) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sampleData.agent.agent_id,
        sampleData.agent.contract_id,
        sampleData.agent.name,
        sampleData.agent.description,
        sampleData.agent.status,
        sampleData.agent.gas_limit,
        sampleData.agent.max_priority_fee,
        sampleData.agent.owner,
        sampleData.agent.contract_state
      ]
    });

    // Insert functions
    for (const func of sampleData.functions) {
      await client.execute({
        sql: `INSERT INTO agent_functions (function_id, agent_id, function_name, function_signature, function_type, is_enabled, validation_rules, abi) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          func.function_id,
          func.agent_id,
          func.function_name,
          func.function_signature,
          func.function_type,
          func.is_enabled,
          func.validation_rules,
          func.abi
        ]
      });
    }

    // Insert schedule
    await client.execute({
      sql: `INSERT INTO agent_schedules (schedule_id, agent_id, schedule_type, cron_expression, is_active, next_execution) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        sampleData.schedule.schedule_id,
        sampleData.schedule.agent_id,
        sampleData.schedule.schedule_type,
        sampleData.schedule.cron_expression,
        sampleData.schedule.is_active,
        sampleData.schedule.next_execution
      ]
    });

    console.log('Sample data inserted successfully');
  } catch (error) {
    console.error('Error inserting sample data:', error);
    throw error;
  }
}

function splitSqlStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inTrigger = false;

  // Split by lines and process each line
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue;
    }

    // Check if we're starting a trigger
    if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
      inTrigger = true;
      currentStatement = trimmedLine;
      continue;
    }

    // If we're in a trigger, keep adding lines until we find END;
    if (inTrigger) {
      currentStatement += '\n' + line;
      if (trimmedLine.toUpperCase() === 'END;') {
        statements.push(currentStatement);
        currentStatement = '';
        inTrigger = false;
      }
      continue;
    }

    // For non-trigger statements, add to current statement
    currentStatement += ' ' + trimmedLine;

    // If the line ends with a semicolon, it's the end of a statement
    if (trimmedLine.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  return statements;
}

async function main() {
  const url = process.env.VITE_TURSO_DATABASE_URL;
  const authToken = process.env.VITE_TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error('Missing Turso database credentials');
    process.exit(1);
  }

  const client = createClient({
    url,
    authToken,
  });

  try {
    // Leer el archivo SQL
    const sqlPath = join(__dirname, 'init-db.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    // Dividir las declaraciones SQL usando la nueva función
    const statements = splitSqlStatements(sql);

    // Ejecutar cada declaración
    for (const statement of statements) {
      if (statement.trim()) {
        await client.execute(statement);
        console.log('Executed:', statement.substring(0, 50) + '...');
      }
    }

    // Insert sample data
    await insertSampleData(client);

    console.log('Database initialized successfully with sample data');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

main(); 