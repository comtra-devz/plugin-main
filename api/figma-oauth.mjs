/**
 * Root non usato dalle rewrite: ogni path ha il suo file (init, plugin, start, callback, poll).
 * Se qualcuno chiama /api/figma-oauth senza path, rispondiamo 404.
 */
export default function handler(_req, res) {
  res.status(404).send('Use /auth/figma/init, /auth/figma/plugin, etc.');
}
