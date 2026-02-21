/**
 * Vercel serverless function: gestisce /auth/figma/* (init, start, callback, poll).
 * vercel.json reindirizza /auth/figma/* qui.
 */
import app from '../oauth-server/app.mjs';

export default function handler(req, res) {
  return app(req, res);
}
