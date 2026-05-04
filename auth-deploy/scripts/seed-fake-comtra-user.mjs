#!/usr/bin/env node
/**
 * Crea/aggiorna un utente Comtra **senza OAuth Figma** (id stabile `comtra_*`), utile mentre il login Figma è in pausa.
 *
 * Richiede lo stesso Postgres di produzione (Supabase / Vercel Postgres): copia `DATABASE_URL` o `POSTGRES_URL`.
 *
 * Dopo l’upsert, se imposti `JWT_SECRET` (lo stesso di Vercel auth-deploy), stampa un Bearer JWT valido per:
 *   GET /api/credits, POST /api/credits/consume, ecc.
 *
 * Uso (da directory auth-deploy, dopo `npm install`):
 *   DATABASE_URL='postgresql://...' JWT_SECRET='...' node scripts/seed-fake-comtra-user.mjs
 *
 * Variabili:
 *   FAKE_USER_ID   default comtra_test_e2e
 *   FAKE_EMAIL     default test.plugin.e2e@comtra.test  (deve essere univoca in users.email)
 *   FAKE_NAME      default QA Fake Plugin User
 *   JWT_SECRET     opzionale — se presente, stampa il token plugin-style (365d)
 */
import postgres from 'postgres';
import jwt from 'jsonwebtoken';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const FAKE_USER_ID = (process.env.FAKE_USER_ID || 'comtra_test_e2e').trim();
const FAKE_EMAIL = (process.env.FAKE_EMAIL || 'test.plugin.e2e@comtra.test').trim().toLowerCase();
const FAKE_NAME = (process.env.FAKE_NAME || 'QA Fake Plugin User').trim();
const JWT_SECRET = process.env.JWT_SECRET;

async function main() {
  if (!DATABASE_URL) {
    console.error('Imposta DATABASE_URL o POSTGRES_URL (connection string Postgres).');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    await sql`
      INSERT INTO users (
        id, email, name, img_url, plan, credits_total, credits_used,
        total_xp, current_level, figma_user_id, updated_at
      )
      VALUES (
        ${FAKE_USER_ID}, ${FAKE_EMAIL}, ${FAKE_NAME}, null, 'FREE',
        25, 0, 0, 1, null, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = NOW()
    `;

    console.log('Utente upsert OK.');
    console.log('  id   ', FAKE_USER_ID);
    console.log('  email', FAKE_EMAIL);

    if (JWT_SECRET) {
      const token = jwt.sign({ sub: FAKE_USER_ID }, JWT_SECRET, { expiresIn: '365d' });
      console.log('\nJWT (Authorization: Bearer …), come dopo magic link / login:');
      console.log(token);
      console.log('\nProva crediti:');
      console.log(
        `  curl -s -H "Authorization: Bearer ${token}" https://auth.comtra.dev/api/credits?lite=1`
      );
    } else {
      console.log('\n(Imposta JWT_SECRET uguale a Vercel auth-deploy per stampare un JWT di test.)');
    }
  } catch (e) {
    if (e.code === '23505') {
      console.error(
        'Violazione unique (spesso email già usata da un altro account). Cambia FAKE_EMAIL o elimina la riga duplicata in Supabase.'
      );
    }
    console.error(e);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
