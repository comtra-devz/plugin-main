/**
 * GET/POST /api/generate-governance — Playbook (libreria prompt) + ToV JSON (§8.2).
 * Richiede stesse credenziali admin della dashboard.
 */
import { sql } from '../lib/db.mjs';
import { requireAdmin } from '../lib/admin-auth.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : {};
  } catch {
    return {};
  }
}

function isMissingTableError(err) {
  const msg = err?.message != null ? String(err.message) : '';
  return /relation .* does not exist|table .* does not exist/i.test(msg);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!(await requireAdmin(req, res))) return;
  if (!sql) return res.status(503).json({ error: 'Database not configured' });

  if (req.method === 'GET') {
    try {
      let playbooks = [];
      try {
        const pb = await sql`
          SELECT id::text, title, body,
                 EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_at_ms
          FROM generate_playbooks
          ORDER BY updated_at DESC
          LIMIT 200
        `;
        playbooks = pb.rows || [];
      } catch (e) {
        if (!isMissingTableError(e)) throw e;
      }
      let prompt_overrides = {};
      try {
        const tov = await sql`
          SELECT prompt_overrides FROM generate_tov_config WHERE singleton = 'default' LIMIT 1
        `;
        const row = tov.rows?.[0];
        if (row?.prompt_overrides && typeof row.prompt_overrides === 'object') {
          prompt_overrides = row.prompt_overrides;
        }
      } catch (e) {
        if (!isMissingTableError(e)) throw e;
      }
      return res.status(200).json({ playbooks, tov: { prompt_overrides } });
    } catch (err) {
      console.error('GET /api/generate-governance', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const action = String(body.action || '').trim().toLowerCase();

    try {
      if (action === 'create_playbook') {
        const title = String(body.title || '').trim().slice(0, 200);
        const text = String(body.body ?? '').slice(0, 50000);
        if (!title) return res.status(400).json({ error: 'title required' });
        const ins = await sql`
          INSERT INTO generate_playbooks (title, body, updated_at)
          VALUES (${title}, ${text}, NOW())
          RETURNING id::text AS id
        `;
        const id = ins.rows?.[0]?.id;
        return res.status(200).json({ ok: true, id });
      }

      if (action === 'delete_playbook') {
        const id = String(body.id || '').trim();
        if (!id) return res.status(400).json({ error: 'id required' });
        await sql`DELETE FROM generate_playbooks WHERE id = ${id}::uuid`;
        return res.status(200).json({ ok: true });
      }

      if (action === 'save_tov') {
        const po = body.prompt_overrides;
        if (!po || typeof po !== 'object' || Array.isArray(po)) {
          return res.status(400).json({ error: 'prompt_overrides object required' });
        }
        const json = JSON.stringify(po);
        await sql`
          INSERT INTO generate_tov_config (singleton, prompt_overrides, updated_at)
          VALUES ('default', ${json}::jsonb, NOW())
          ON CONFLICT (singleton) DO UPDATE SET
            prompt_overrides = EXCLUDED.prompt_overrides,
            updated_at = NOW()
        `;
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({
        error: 'Unknown action (create_playbook | delete_playbook | save_tov)',
      });
    } catch (err) {
      if (isMissingTableError(err)) {
        return res.status(503).json({ error: 'Run migration 015_generate_playbooks_and_tov.sql' });
      }
      console.error('POST /api/generate-governance', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
