/**
 * Postgres client per le API admin (stesso DB di auth-deploy).
 * Variabili: POSTGRES_URL o DATABASE_URL.
 */
import postgres from 'postgres';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
/** max>1: evita coda e timeout quando più route admin girano in parallelo (es. Home). */
const raw = URL ? postgres(URL, { max: 8 }) : null;

export const sql = raw
  ? (strings, ...values) =>
      raw(strings, ...values).then((rows) => ({
        rows: rows || [],
        rowCount: (rows || []).length,
      }))
  : null;

/** Client postgres originale (insert dinamici `sql\`...\${sql(rows)}\``); usare solo dove serve. */
export const sqlRaw = raw;
