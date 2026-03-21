/**
 * GET /api/product-sources-runs — elenco run cron fonti prodotto (+ ?id= per dettaglio con Markdown completo)
 * POST /api/product-sources-runs — azioni Git stub / manuale PR URL
 *
 * Auth: sessione admin (JWT) come le altre API dashboard.
 */
import { sql } from '../lib/db.mjs';
import { requireAdmin } from '../lib/admin-auth.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;
  if (!sql) return res.status(503).json({ error: 'Database non configurato' });

  try {
    if (req.method === 'GET') {
      const idRaw = req.query?.id;
      if (idRaw != null && String(idRaw).trim() !== '') {
        const id = Number.parseInt(String(idRaw), 10);
        if (!Number.isFinite(id) || id < 1) {
          return res.status(400).json({ error: 'id non valido' });
        }
        const result = await sql`
          SELECT id, ran_at, status, skipped, link_count,
                 linkedin_urls_attempted, linkedin_items_returned,
                 notion_mode, notion_source_id, error_message,
                 discord_notified, github_sync_status, github_pr_url, github_updated_at, github_error,
                 report_markdown
          FROM product_sources_cron_runs
          WHERE id = ${id}
          LIMIT 1
        `;
        const row = result.rows?.[0];
        if (!row) return res.status(404).json({ error: 'Run non trovata' });
        return res.status(200).json({ ok: true, run: row });
      }

      const limit = Math.min(200, Math.max(1, parseInt(req.query?.limit, 10) || 80));
      const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

      const [list, countRes] = await Promise.all([
        sql`
          SELECT id, ran_at, status, skipped, link_count,
                 linkedin_urls_attempted, linkedin_items_returned,
                 notion_mode, notion_source_id, error_message,
                 discord_notified, github_sync_status, github_pr_url, github_updated_at, github_error,
                 LEFT(COALESCE(report_markdown, ''), 400) AS markdown_preview
          FROM product_sources_cron_runs
          ORDER BY ran_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS c FROM product_sources_cron_runs`,
      ]);
      const total = countRes.rows?.[0]?.c ?? 0;
      return res.status(200).json({
        ok: true,
        runs: list.rows,
        total,
        limit,
        offset,
      });
    }

    const body = parseBody(req);
    const action = String(body.action || '');
    const runId = Number.parseInt(String(body.runId ?? body.id ?? ''), 10);
    if (!Number.isFinite(runId) || runId < 1) {
      return res.status(400).json({ error: 'runId non valido' });
    }

    const exists = await sql`SELECT id FROM product_sources_cron_runs WHERE id = ${runId} LIMIT 1`;
    if (!exists.rows?.[0]) return res.status(404).json({ error: 'Run non trovata' });

    if (action === 'request_pr_stub') {
      await sql`
        UPDATE product_sources_cron_runs
        SET github_sync_status = 'pending',
            github_updated_at = NOW(),
            github_error = NULL
        WHERE id = ${runId}
      `;
      return res.status(200).json({
        ok: true,
        stub: true,
        message:
          'Stato aggiornato: in lavorazione. Le PR restano sempre manuali (sicurezza). Scarica il Markdown, apri la PR sul repo; quando esiste, usa «Segna PR» in dashboard per salvare l’URL.',
      });
    }

    if (action === 'set_pr_url') {
      const prUrl = String(body.prUrl || '').trim();
      if (!/^https:\/\/github\.com\//i.test(prUrl)) {
        return res.status(400).json({ error: 'L’URL deve iniziare con https://github.com/' });
      }
      await sql`
        UPDATE product_sources_cron_runs
        SET github_sync_status = 'pr_opened',
            github_pr_url = ${prUrl},
            github_updated_at = NOW(),
            github_error = NULL
        WHERE id = ${runId}
      `;
      return res.status(200).json({ ok: true });
    }

    if (action === 'reset_git') {
      await sql`
        UPDATE product_sources_cron_runs
        SET github_sync_status = 'not_sent',
            github_pr_url = NULL,
            github_updated_at = NOW(),
            github_error = NULL
        WHERE id = ${runId}
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Azione non supportata' });
  } catch (e) {
    console.error('product-sources-runs', e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/discord_notified|github_sync_status|column/i.test(msg)) {
      return res.status(503).json({
        error:
          'Migration mancante: esegui migrations/005_product_sources_git_discord.sql sullo stesso database.',
      });
    }
    return res.status(500).json({ error: msg });
  }
}
