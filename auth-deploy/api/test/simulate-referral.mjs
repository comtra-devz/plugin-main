/**
 * Endpoint di test: simula un referral affiliato (incrementa total_referrals)
 * senza passare dal webhook Lemon Squeezy.
 * Richiede header X-Test-Secret = TEST_AFFILIATE_SECRET (variabile in Vercel).
 * In produzione: non impostare TEST_AFFILIATE_SECRET per disattivare l'endpoint.
 */
import app from '../../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Test-Secret');
}

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();
  req.url = '/api/test/simulate-referral';
  return app(req, res);
}
