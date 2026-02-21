import app from '../../oauth-server/app.mjs';

export default function handler(req, res) {
  const qs = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
  req.url = '/auth/figma/init' + qs;
  return app(req, res);
}
