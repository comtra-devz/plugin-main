/**
 * Postgres client compatibile con Supabase (pooler). Usa DATABASE_URL o POSTGRES_URL.
 * Restituisce { rows, rowCount } come @vercel/postgres per non cambiare i chiamanti.
 *
 * prepare: false — Supabase pool (PgBouncer transaction mode) invalida prepared statements
 * tra richieste serverless; senza questo si vede PostgresError "prepared statement does not exist".
 */
import postgres from 'postgres';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const raw = URL ? postgres(URL, { max: 1, prepare: false }) : null;

function wrapResult(rows) {
  const r = Array.isArray(rows) ? rows : rows || [];
  return { rows: r, rowCount: r.length };
}

export const sql = raw
  ? (strings, ...values) => raw(strings, ...values).then((rows) => wrapResult(rows))
  : null;

/**
 * Esegue fn in una transazione. Il callback riceve la stessa forma di `sql` ({ rows, rowCount }).
 * Il client `tx` di postgres altrimenti restituirebbe un array, rompendo ogni `r.rows` nei chiamanti.
 */
export const withTransaction = raw
  ? (fn) =>
      raw.begin(async (tx) => {
        const wrapped = (strings, ...values) => tx(strings, ...values).then((rows) => wrapResult(rows));
        return fn(wrapped);
      })
  : null;
