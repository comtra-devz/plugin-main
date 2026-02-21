/**
 * Vercel serverless function: gestisce /auth/figma/* (init, start, callback, poll, plugin).
 * vercel.json reindirizza /auth/figma/* qui passando il segmento in x_path.
 */
import app from '../oauth-server/app.mjs';

export default function handler(req, res) {
  const url = req.url || '';
  const pathSegment = (url.match(/[?&]x_path=([^&]*)/) || [])[1] || '';
  const qs = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  const qsWithoutXPath = qs.replace(/[?&]x_path=[^&]*/g, '').replace(/^&/, '?') || '';
  req.url = '/auth/figma/' + (pathSegment ? decodeURIComponent(pathSegment) : '') + qsWithoutXPath;
  return app(req, res);
}
