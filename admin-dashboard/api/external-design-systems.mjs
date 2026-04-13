import { sql } from '../lib/db.mjs';
import { requireAdmin } from '../lib/admin-auth.mjs';

const ALLOWED_STATUSES = new Set(['draft', 'published', 'archived']);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!(await requireAdmin(req, res))) return;
  if (!sql) return res.status(503).json({ error: 'Database not configured' });

  if (req.method === 'GET') {
    try {
      const sel = await sql`
        SELECT slug, display_name, ds_source, status, ds_package, created_at, updated_at
        FROM external_design_systems
        ORDER BY updated_at DESC
        LIMIT 500
      `;
      return res.status(200).json({ items: sel.rows || [] });
    } catch (err) {
      console.error('GET /api/external-design-systems', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    const slug = String(body.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 120);
    const displayName = String(body.display_name || body.displayName || '')
      .trim()
      .slice(0, 200);
    const dsSource = String(body.ds_source || body.dsSource || slug)
      .trim()
      .slice(0, 160);
    const statusRaw = String(body.status || 'draft').trim().toLowerCase();
    const status = ALLOWED_STATUSES.has(statusRaw) ? statusRaw : 'draft';
    const dsPackage = body.ds_package ?? body.dsPackage;

    if (!slug) return res.status(400).json({ error: 'slug required' });
    if (!displayName) return res.status(400).json({ error: 'display_name required' });
    if (!dsPackage || typeof dsPackage !== 'object' || Array.isArray(dsPackage)) {
      return res.status(400).json({ error: 'ds_package object required' });
    }

    try {
      const dsPackageStr = JSON.stringify(dsPackage);
      await sql`
        INSERT INTO external_design_systems (
          slug, display_name, ds_source, status, ds_package, created_at, updated_at
        )
        VALUES (
          ${slug}, ${displayName}, ${dsSource}, ${status}, ${dsPackageStr}::jsonb, NOW(), NOW()
        )
        ON CONFLICT (slug) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          ds_source = EXCLUDED.ds_source,
          status = EXCLUDED.status,
          ds_package = EXCLUDED.ds_package,
          updated_at = NOW()
      `;
      return res.status(200).json({ ok: true, slug, status });
    } catch (err) {
      console.error('PUT /api/external-design-systems', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
