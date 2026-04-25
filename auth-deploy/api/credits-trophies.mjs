/**
 * Single serverless function: credits (balance, estimate, consume) + trophies (list, linkedin-shared)
 * to stay under Vercel 12-function limit.
 * Rewrites: /api/credits* -> ?service=credits&sub=*, /api/trophies* -> ?service=trophies&sub=*
 */
import app from '../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
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
    if (sub === 'log-free') {
      if (req.method !== 'POST') return res.status(405).end();
      req.url = '/api/credits/log-free';
      return app(req, res);
    }
    if (sub === 'credit-gift-seen') {
      if (req.method !== 'POST') return res.status(405).end();
      req.url = '/api/credit-gift-seen';
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

  if (service === 'history') {
    if (req.method !== 'GET') return res.status(405).end();
    req.url = '/api/history' + qs;
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

  if (service === 'discounts') {
    if (req.method !== 'GET') return res.status(405).end();
    req.url = '/api/discounts/me' + qs;
    return app(req, res);
  }

  if (service === 'feedback' && sub === 'generate') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/feedback/generate';
    return app(req, res);
  }

  if (service === 'generation' && sub === 'plugin-event') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/generation/plugin-event';
    return app(req, res);
  }

  if (service === 'admin' && sub === 'generation-learning-summary') {
    if (req.method !== 'GET') return res.status(405).end();
    req.url = '/api/admin/generation-learning-summary' + qs;
    return app(req, res);
  }
  if (service === 'admin' && sub === 'generate-threads') {
    if (req.method !== 'GET') return res.status(405).end();
    req.url = '/api/admin/generate-threads' + qs;
    return app(req, res);
  }

  if (service === 'support' && sub === 'ticket') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/support/ticket';
    return app(req, res);
  }

  if (service === 'ds-catalog') {
    if (req.method !== 'GET') return res.status(405).end();
    req.url = '/api/design-systems';
    return app(req, res);
  }

  if (service === 'user-ds-imports') {
    if (sub === 'context') {
      if (req.method !== 'GET') return res.status(405).end();
      req.url = '/api/user/ds-imports/context' + qs;
      return app(req, res);
    }
    if (req.method === 'GET') {
      req.url = '/api/user/ds-imports' + qs;
      return app(req, res);
    }
    if (req.method === 'PUT') {
      req.url = '/api/user/ds-imports';
      return app(req, res);
    }
    return res.status(405).end();
  }

  /** Generate conversational UX: thread list/create + message sync */
  if (service === 'generate-chat') {
    if (sub === 'threads') {
      if (req.method === 'GET') {
        req.url = '/api/generate/threads' + qs;
        return app(req, res);
      }
      if (req.method === 'POST') {
        req.url = '/api/generate/threads' + qs;
        return app(req, res);
      }
      return res.status(405).end();
    }
    if (sub === 'thread-messages') {
      if (req.method === 'GET') {
        req.url = '/api/generate/thread-messages' + qs;
        return app(req, res);
      }
      if (req.method === 'POST') {
        req.url = '/api/generate/thread-messages' + qs;
        return app(req, res);
      }
      return res.status(405).end();
    }
    if (sub === 'conversation-hints') {
      if (req.method !== 'GET') return res.status(405).end();
      req.url = '/api/generate/conversation-hints' + qs;
      return app(req, res);
    }
    return res
      .status(400)
      .json({ error: 'Invalid sub for generate-chat (threads|thread-messages|conversation-hints)' });
  }

  return res.status(400).json({
    error:
      'Missing or invalid service=credits|trophies|history|report-throttle|throttle-discount|discounts|feedback|generation|admin|support|ds-catalog|user-ds-imports|generate-chat',
  });
}
