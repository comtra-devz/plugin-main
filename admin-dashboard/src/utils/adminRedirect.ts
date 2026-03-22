/**
 * Path interni ammessi dopo login (Discord / magic link / ?redirect=).
 * Blocca open redirect e URL esterni.
 */
export function isSafeAdminRedirectPath(path: string | null | undefined): path is string {
  if (path == null || typeof path !== 'string') return false;
  const t = path.trim();
  if (!t.startsWith('/')) return false;
  if (t.includes('..') || t.includes('//')) return false;
  if (t.length > 200) return false;
  // Solo path della SPA dashboard
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(t)) return false;
  return true;
}
