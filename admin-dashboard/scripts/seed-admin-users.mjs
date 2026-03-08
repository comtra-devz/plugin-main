#!/usr/bin/env node
/**
 * Seed dei 2 utenti admin (esegui una volta dopo la migrazione).
 * Env: POSTGRES_URL (o DATABASE_URL), ADMIN_USER_1_EMAIL, ADMIN_USER_2_EMAIL, ADMIN_SEED_PASSWORD
 * npm install poi: node scripts/seed-admin-users.mjs
 */
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const email1 = process.env.ADMIN_USER_1_EMAIL?.trim().toLowerCase();
const email2 = process.env.ADMIN_USER_2_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD;

if (!URL) {
  console.error('Set POSTGRES_URL or DATABASE_URL');
  process.exit(1);
}
if (!email1 || !email2) {
  console.error('Set ADMIN_USER_1_EMAIL and ADMIN_USER_2_EMAIL');
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('Set ADMIN_SEED_PASSWORD (min 8 caratteri)');
  process.exit(1);
}

const sql = postgres(URL, { max: 1 });

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  await sql`
    INSERT INTO admin_users (id, email, password_hash, created_at, updated_at)
    VALUES (gen_random_uuid(), ${email1}, ${hash}, ${now}, ${now})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO admin_users (id, email, password_hash, created_at, updated_at)
    VALUES (gen_random_uuid(), ${email2}, ${hash}, ${now}, ${now})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at
  `;
  console.log('Utenti admin creati/aggiornati:', email1, email2);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
