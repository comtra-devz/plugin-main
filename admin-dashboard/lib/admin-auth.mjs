/**
 * Verifica auth admin: JWT sessione (dopo login con 2FA) oppure ADMIN_SECRET (backward compat).
 * Se JWT valido, imposta req.adminUser = { id, email }.
 */
import { verifySessionToken } from './admin-session.mjs';

export async function requireAdmin(req, res) {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_API_KEY;
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const keyHeader = req.headers['x-admin-key'] || '';

  if (bearer) {
    const session = await verifySessionToken(bearer);
    if (session && session.sub && session.email) {
      req.adminUser = { id: session.sub, email: session.email };
      return true;
    }
  }

  if (!secret) {
    res.status(503).json({ error: 'Admin API not configured' });
    return false;
  }
  const token = bearer || keyHeader;
  if (token && token === secret) return true;

  res.status(401).json({ error: 'Unauthorized' });
  return false;
}
