/**
 * GET /api/cron-product-sources
 *
 * Legacy automation disabled: product-sources cron is no longer run from this deploy.
 * Returns 410 so any Vercel Cron still pointing here fails fast without side effects.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(410).json({
    ok: false,
    disabled: true,
    message: 'Legacy product-sources cron disabled.',
  });
}
