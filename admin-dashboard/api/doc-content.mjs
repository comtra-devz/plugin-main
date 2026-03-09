/**
 * GET/POST /api/doc-content — Content Management per Documentation (plugin).
 * Richiede auth admin. GET: restituisce contenuto. POST: salva.
 */
import { sql } from '../lib/db.mjs';
import { requireAdmin } from '../lib/admin-auth.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

const DEFAULT_DOC = {
  header: { title: 'Knowledge Base', subtitle: 'Master the system. Scale your workflow.' },
  tutorials: {
    WORKFLOW: {
      title: 'The Perfect Workflow',
      content: '<div class="space-y-2 text-xs leading-relaxed text-gray-700"><p><strong class="text-black">1. Scan First:</strong> Always start with the Audit tab.</p><p><strong class="text-black">2. Group Fixes:</strong> Use the "Auto-Fix All" button.</p><p><strong class="text-black">3. Generate Contextually:</strong> Select a reference or create a wireframe.</p></div>',
    },
    ASSETS: {
      title: 'Images & SVGs (Asset Registry)',
      content: '<div class="space-y-2 text-xs leading-relaxed text-gray-700"><p>We use the <strong class="text-black">Asset Registry Protocol</strong>.</p></div>',
    },
    SYNC: {
      title: 'Deep Sync & Drift',
      content: '<div class="space-y-2 text-xs leading-relaxed text-gray-700"><p><strong class="text-black">What is Drift?</strong> Drift occurs when Figma and code are out of sync.</p></div>',
    },
  },
  videos: [
    { id: 'v1', title: 'Figma in 5 Minutes', time: '5:00', url: 'https://www.youtube.com/watch?v=5V50GPV3Zts' },
  ],
  faqs: [
    { q: 'How much does a Scan cost?', a: 'Audit costs depend on size.' },
  ],
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;

  if (!sql) return res.status(503).json({ error: 'Database not configured' });

  try {
    if (req.method === 'GET') {
      let data = DEFAULT_DOC;
      try {
        const rows = await sql`SELECT data FROM doc_content WHERE id = 'documentation' LIMIT 1`;
        const row = rows?.rows?.[0];
        if (row?.data) data = row.data;
      } catch (e) {
        if (!/relation "doc_content" does not exist/i.test(String(e))) throw e;
      }
      return res.status(200).json({ data });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const data = body.data;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data object required' });

      const jsonStr = JSON.stringify(data);
      await sql`
        INSERT INTO doc_content (id, data, updated_at)
        VALUES ('documentation', ${jsonStr}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('doc-content', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
