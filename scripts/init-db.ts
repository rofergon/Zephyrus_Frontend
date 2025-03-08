import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

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
    const sqlPath = path.join(__dirname, 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

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