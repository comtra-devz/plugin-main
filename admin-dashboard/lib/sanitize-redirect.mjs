/** Path interni ammessi nel magic link (?redirect=) — stessa logica lato client. */
export function sanitizeAdminRedirectPath(s) {
  if (s == null || typeof s !== 'string') return '';
  const t = s.trim();
  if (!t.startsWith('/')) return '';
  if (t.includes('..') || t.includes('//')) return '';
  if (t.length > 200) return '';
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(t)) return '';
  return t;
}
