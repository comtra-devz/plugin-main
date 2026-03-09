/**
 * Single serverless function: credits (balance, estimate, consume) + trophies (list, linkedin-shared)
 * to stay under Vercel 12-function limit.
 * Rewrites: /api/credits* -> ?service=credits&sub=*, /api/trophies* -> ?service=trophies&sub=*
 */
import app from '../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const service = req.query?.service;
  const sub = req.query?.sub;
  const qs = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';

  if (service === 'credits') {
    if (sub === 'estimate') {
      if (req.method !== 'POST') return res.status(405).end();
      req.url = '/api/credits/estimate';
      return app(req, res);
    }
    if (sub === 'consume') {
      if (req.method !== 'POST') return res.status(405).end();
      req.url = '/api/credits/consume';
      return app(req, res);
    }
    if (req.method !== 'GET') return res.status(405).end();
    req.url = '/api/credits' + qs;
    return app(req, res);
  }

  if (service === 'trophies') {
    if (sub === 'linkedin-shared') {
      if (req.method !== 'POST') return res.status(405).end();
      req.url = '/api/trophies/linkedin-shared';
      return app(req, res);
    }
    if (req.method !== 'GET') return res.status(405).end();
    req.url = '/api/trophies' + qs;
    return app(req, res);
  }

  if (service === 'report-throttle') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/report-throttle';
    return app(req, res);
  }

  if (service === 'throttle-discount') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/throttle-discount';
    return app(req, res);
  }

  if (service === 'feedback' && sub === 'generate') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/feedback/generate';
    return app(req, res);
  }

  return res.status(400).json({ error: 'Missing or invalid service=credits|trophies|report-throttle|throttle-discount|feedback' });
}
