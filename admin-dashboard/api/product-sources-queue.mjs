/**
 * GET /api/product-sources-queue — stato coda Fase 3 (batch + job pending)
 *
 * Auth: admin JWT (come product-sources-runs).
 */
import { requireAdmin } from '../lib/admin-auth.mjs';
import { listQueueBatches } from '../lib/product-sources-queue.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  try {
    const limit = Math.min(80, Math.max(1, parseInt(req.query?.limit, 10) || 40));
    const { batches, migrationNeeded } = await listQueueBatches({ limit });
    return res.status(200).json({ ok: true, batches, migrationNeeded: !!migrationNeeded });
  } catch (e) {
    console.error('product-sources-queue', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ ok: false, error: msg });
  }
}
