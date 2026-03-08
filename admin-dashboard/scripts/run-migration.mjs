#!/usr/bin/env node
/** Esegue migrations/001_admin_users.sql (richiede POSTGRES_URL) */
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Set POSTGRES_URL or DATABASE_URL');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const file = join(__dirname, '..', 'migrations', '001_admin_users.sql');
const content = readFileSync(file, 'utf8');
const statements = content
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter((s) => s.length > 0);

for (const statement of statements) {
  await sql.unsafe(statement + ';');
  console.log('OK:', statement.slice(0, 50) + '...');
}
console.log('Migration done.');
process.exit(0);
