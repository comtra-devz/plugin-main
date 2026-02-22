export default function handler(_req, res) {
  res.status(404).send('Use /auth/figma/init, /auth/figma/plugin, etc.');
}
