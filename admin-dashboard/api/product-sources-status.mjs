/**
 * GET /api/product-sources-status
 * Mostra “quando” partirà la prossima analisi approfondita (Fase 0/3/4/5/6 deep run).
 *
 * Calcolo:
 * - ultimo run con status='ok' e skipped=false => lastOkRanAt
 * - nextAt = lastOkRanAt + gateMs (gate giorni da env, default 4)
 * - remainingMs = nextAt - now
 *
 * In più:
 * - se è attiva la modalità coda (Fase 3) e c’è un batch con job pending, segnala la coda:
 *   in quel caso il cron bypassa il gate e “consuma la coda” prima della prossima run schedulata.
 */
import { sql } from '../lib/db.mjs';
import { requireAdmin } from '../lib/admin-auth.mjs';
import { findActiveBatchWithPendingJobs, isQueueModeEnabled } from '../lib/product-sources-queue.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

function getGateDays() {
  const raw = process.env.PRODUCT_SOURCES_CRON_GATE_DAYS;
  const defaultDays = 4;
  const n = raw != null && String(raw).trim() !== '' ? Number(raw) : defaultDays;
  if (!Number.isFinite(n) || n <= 0) return defaultDays;
  return Math.min(n, 30);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireAdmin(req, res))) return;
  if (!sql) return res.status(503).json({ error: 'Database non configurato' });

  const gateDays = getGateDays();
  const gateMs = gateDays * 24 * 60 * 60 * 1000;
  const serverNowMs = Date.now();
  const serverNowIso = new Date(serverNowMs).toISOString();

  let lastOkRanAtMs = null;
  let lastOkRanAtIso = null;
  try {
    const prev = await sql`
      SELECT ran_at
      FROM product_sources_cron_runs
      WHERE status = 'ok' AND skipped = false
      ORDER BY id DESC
      LIMIT 1
    `;
    const row = prev?.rows?.[0];
    if (row?.ran_at) {
      const t = new Date(row.ran_at).getTime();
      if (Number.isFinite(t)) {
        lastOkRanAtMs = t;
        lastOkRanAtIso = new Date(t).toISOString();
      }
    }
  } catch (e) {
    console.error('product-sources-status lastOk', e);
  }

  const nextAtMs = (lastOkRanAtMs != null ? lastOkRanAtMs + gateMs : serverNowMs);
  const nextAtIso = new Date(nextAtMs).toISOString();
  const remainingMs = Math.max(0, nextAtMs - serverNowMs);

  let queuePending = false;
  let queueBatchId = null;
  try {
    if (isQueueModeEnabled()) {
      const active = await findActiveBatchWithPendingJobs();
      if (active) {
        queuePending = true;
        queueBatchId = active.id;
      }
    }
  } catch (e) {
    console.error('product-sources-status queue', e);
  }

  return res.status(200).json({
    ok: true,
    serverNowMs,
    serverNowIso,
    gateDays,
    gateMs,
    lastOkRanAtMs,
    lastOkRanAtIso,
    nextAtMs,
    nextAtIso,
    remainingMs,
    queuePending,
    queueBatchId,
  });
}

