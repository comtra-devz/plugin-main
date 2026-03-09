#!/usr/bin/env node
/**
 * Imposta admin@comtra.dev come unico utente ammesso al login (magic link).
 * Rimuove gli altri utenti dalla tabella admin_users.
 * Env: POSTGRES_URL o DATABASE_URL (opzionale: carica da .env nella cartella admin-dashboard)
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}
loadEnv();

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const SINGLE_ADMIN_EMAIL = 'admin@comtra.dev';

if (!URL) {
  console.error('Imposta POSTGRES_URL o DATABASE_URL (o aggiungili al file .env)');
  process.exit(1);
}

const sql = postgres(URL, { max: 1 });

async function main() {
  const placeholderHash = await bcrypt.hash('magic-link-only', 10);
  const now = new Date().toISOString();

  await sql`DELETE FROM admin_users WHERE LOWER(email) != ${SINGLE_ADMIN_EMAIL.toLowerCase()}`;
  await sql`
    INSERT INTO admin_users (id, email, password_hash, created_at, updated_at)
    VALUES (gen_random_uuid(), ${SINGLE_ADMIN_EMAIL}, ${placeholderHash}, ${now}, ${now})
    ON CONFLICT (email) DO UPDATE SET updated_at = ${now}
  `;

  console.log('Unico utente ammesso:', SINGLE_ADMIN_EMAIL);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
