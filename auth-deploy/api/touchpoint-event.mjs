/**
 * POST /api/touchpoint-event — beacon per visite e click dalla landing (e altri touchpoint).
 * Body: { source, event_type [, metadata] }
 * source: landing | plugin | linkedin | instagram | tiktok
 * event_type: visit | click | signup | usage | upgrade
 * Header opzionale: X-Touchpoint-Key (stesso valore di TOUCHPOINT_EVENT_KEY in env) per limitare abusi.
 */
if (process.env.DATABASE_URL) process.env.POSTGRES_URL = process.env.DATABASE_URL;
import postgres from 'postgres';

const SOURCES = ['landing', 'plugin', 'linkedin', 'instagram', 'tiktok'];
const EVENT_TYPES = ['visit', 'click', 'signup', 'usage', 'upgrade'];
const API_KEY = (process.env.TOUCHPOINT_EVENT_KEY || '').trim();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Touchpoint-Key');
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (API_KEY) {
    const key = req.headers['x-touchpoint-key'] || (req.query?.key || '').trim();
    if (key !== API_KEY) return res.status(401).json({ error: 'Invalid or missing key' });
  }

  let body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) body = await parseBody(req);

  const source = (body.source || '').toString().trim().toLowerCase();
  const eventType = (body.event_type || '').toString().trim().toLowerCase();

  if (!SOURCES.includes(source)) return res.status(400).json({ error: 'Invalid source' });
  if (!EVENT_TYPES.includes(eventType)) return res.status(400).json({ error: 'Invalid event_type' });

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return res.status(503).json({ error: 'Database not configured' });

  const sql = postgres(url, { max: 1 });
  try {
    await sql`
      INSERT INTO touchpoint_events (source, event_type, metadata)
      VALUES (${source}, ${eventType}, ${body.metadata && typeof body.metadata === 'object' ? JSON.stringify(body.metadata) : null})
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (/relation "touchpoint_events" does not exist/i.test(String(err))) {
      return res.status(503).json({ error: 'Touchpoint tracking not set up. Run migration 005_touchpoint_funnel.sql.' });
    }
    console.error('touchpoint-event', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
