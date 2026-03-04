/**
 * Postgres client per le API admin (stesso DB di auth-deploy).
 * Variabili: POSTGRES_URL o DATABASE_URL.
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
