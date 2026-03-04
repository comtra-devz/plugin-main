/**
 * Verifica ADMIN_SECRET dall'header. Usato dalle API admin del progetto dashboard.
 */
export function requireAdmin(req, res) {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_API_KEY;
  if (!secret) {
    res.status(503).json({ error: 'Admin API not configured' });
    return false;
  }
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const keyHeader = req.headers['x-admin-key'] || '';
  const token = bearer || keyHeader;
  if (!token || token !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
