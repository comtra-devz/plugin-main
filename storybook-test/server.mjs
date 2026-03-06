/**
 * Server per storybook-test: serve lo static build di Storybook + /api/stories.
 * Usato da Comtra Sync per verificare il flusso drift (Figma vs Storybook).
 *
 * Uso:
 *   npm run build   # builda Storybook in storybook-static/
 *   npm run serve   # avvia server su porta 6006
 *
 * Per test con Comtra: esponi con ngrok (ngrok http 6006) e usa l'URL pubblico.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 6006;
const STATIC_DIR = path.join(__dirname, 'storybook-static');

const STORIES_JSON = {
  stories: [
    { component: 'Button', title: 'Components/Button', id: 'components-button--primary' },
    { component: 'Button', title: 'Components/Button', id: 'components-button--secondary' },
    { component: 'Input', title: 'Components/Input', id: 'components-input--default' },
    { component: 'Input', title: 'Components/Input', id: 'components-input--with-value' },
    { component: 'Card', title: 'Components/Card', id: 'components-card--default' },
  ],
};

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/api/stories' || pathname === '/api/components') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(STORIES_JSON));
    return;
  }

  let filePath = path.join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!pathname.includes('.')) {
    const tryIndex = path.join(STATIC_DIR, pathname, 'index.html');
    if (fs.existsSync(tryIndex)) filePath = tryIndex;
  }

  if (!fs.existsSync(filePath) || !filePath.startsWith(STATIC_DIR)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Storybook test server: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/stories`);
  console.log(`Per Comtra: esponi con ngrok (ngrok http ${PORT}) e usa l'URL pubblico.`);
});
