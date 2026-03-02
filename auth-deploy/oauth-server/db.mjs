/**
 * Postgres client compatibile con Supabase (pooler). Usa DATABASE_URL o POSTGRES_URL.
 * Restituisce { rows, rowCount } come @vercel/postgres per non cambiare i chiamanti.
 */
import postgres from 'postgres';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const raw = URL ? postgres(URL, { max: 1 }) : null;

export const sql = raw
  ? (strings, ...values) =>
      raw(strings, ...values).then((rows) => ({
        rows: rows || [],
        rowCount: (rows || []).length,
      }))
  : null;
