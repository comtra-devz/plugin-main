/**
 * Admin API: check ADMIN_SECRET from header. Use in api/admin/* handlers.
 * Returns true if valid; otherwise sends 401 and returns false.
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
