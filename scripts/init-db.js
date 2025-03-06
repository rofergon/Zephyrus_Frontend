import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    // Dividir las declaraciones SQL
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Ejecutar cada declaración
    for (const statement of statements) {
      await client.execute(statement);
      console.log('Executed:', statement.substring(0, 50) + '...');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

main(); 