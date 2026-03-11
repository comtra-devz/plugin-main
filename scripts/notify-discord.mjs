#!/usr/bin/env node
/**
 * Analizza gli ultimi commit (diff + file), genera un riassunto chiaro per area
 * e lo invia al canale Discord. Nessuna AI: solo euristiche su path e contenuto.
 *
 * Uso: node scripts/notify-discord.mjs [N]
 * N = numero di commit (default 1; con hook post-commit si usa 1).
 * Richiede DISCORD_WEBHOOK_URL in env o nel .env nella root del repo.
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

function loadEnv() {
  const envPath = resolve(repoRoot, '.env');
  if (!process.env.DISCORD_WEBHOOK_URL && existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*DISCORD_WEBHOOK_URL\s*=\s*(.+?)\s*$/);
      if (m) process.env.DISCORD_WEBHOOK_URL = m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
}

loadEnv();

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith('https://discord.com/api/webhooks/')) {
  console.error('Imposta DISCORD_WEBHOOK_URL (in env o nel .env nella root del repo).');
  process.exit(1);
}

const count = Math.min(10, Math.max(1, parseInt(process.argv[2], 10) || 1));

function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: repoRoot, ...opts });
}

function getCommitHashes(n) {
  const out = exec(`git log -${n} --pretty=format:"%H"`);
  return out.trim().split(/\n/).filter(Boolean);
}

function getCommitSubject(hash) {
  return exec(`git log -1 --pretty=format:"%s" ${hash}`);
}

function getFilesAndPatch(hash) {
  let nameStatus = '';
  let patch = '';
  try {
    nameStatus = exec(`git show ${hash} --name-status --pretty=format:`);
    patch = exec(`git show ${hash} -p --no-color`, { maxBuffer: 2 * 1024 * 1024 });
  } catch {
    return { files: [], patch: '' };
  }
  const files = [];
  for (const line of nameStatus.split('\n').filter(Boolean)) {
    const m = line.match(/^([AMD])\s+(.+)$/);
    if (m) files.push({ status: m[1], path: m[2].trim() });
  }
  return { files, patch };
}

const AREAS = [
  { key: 'plugin', label: 'Plugin', paths: ['src/', 'code/', 'ui.html'], roots: ['.ts', '.tsx'] },
  { key: 'dashboard', label: 'Dashboard', paths: ['admin-dashboard/'] },
  { key: 'backend', label: 'Backend', paths: ['auth-deploy/'] },
  { key: 'docs', label: 'Documentazione', paths: ['docs/'] },
  { key: 'config', label: 'Config', paths: ['package.json', 'vite.config', '.cursor'] },
];

function areaFor(filePath) {
  for (const a of AREAS) {
    if (a.roots) {
      if (a.roots.some(ext => filePath.endsWith(ext)) && !a.paths.some(p => filePath.startsWith(p))) {
        const inKnown = AREAS.some(a2 => a2.paths.some(p => filePath.startsWith(p)));
        if (!inKnown) return a;
      }
    }
    if (a.paths.some(p => filePath.startsWith(p) || filePath === p)) return a;
  }
  return { key: 'other', label: 'Altro' };
}

function describeMigration(path, patch) {
  const name = path.replace(/.*\//, '').replace(/\.sql$/, '');
  const createMatch = patch.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w.]+\s+)?\(/gi);
  const alterMatch = patch.match(/ALTER\s+TABLE/gi);
  const parts = [];
  if (createMatch?.length) parts.push(`${createMatch.length} tabella/e`);
  if (alterMatch?.length) parts.push(`ALTER TABLE x${alterMatch.length}`);
  return parts.length ? `Migration **${name}**: ${parts.join(', ')}.` : `Migration **${name}** aggiornata.`;
}

function describeApiFile(path, patch) {
  const methods = [];
  for (const m of patch.matchAll(/(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi)) {
    methods.push(`${m[1].toUpperCase()} ${m[2]}`);
  }
  const file = path.replace(/.*\//, '');
  if (methods.length) return `**${file}**: ${methods.slice(0, 5).join(', ')}.`;
  return `**${file}** modificato.`;
}

function describeTsx(path, patch) {
  const name = path.replace(/.*\//, '').replace(/\.(tsx|ts)$/, '');
  const defaultExport = patch.match(/export\s+default\s+function\s+(\w+)/);
  const comp = defaultExport ? defaultExport[1] : name;
  return `**${comp}** (${name}).`;
}

function describeDoc(path) {
  const name = path.replace(/.*\//, '');
  return `**${name}** aggiornato.`;
}

function summarizeFile(entry, patch) {
  const { path, status } = entry;
  const ext = path.includes('.') ? path.split('.').pop() : '';
  const added = status === 'A' ? ' (nuovo)' : '';

  if (path.includes('migrations/') && path.endsWith('.sql')) {
    return describeMigration(path, patch) + added;
  }
  if ((path.includes('api/') || path.includes('oauth-server/')) && (path.endsWith('.mjs') || path.endsWith('.js'))) {
    return describeApiFile(path, patch) + added;
  }
  if (path.endsWith('.tsx') || (path.endsWith('.ts') && path.includes('admin-dashboard'))) {
    return describeTsx(path, patch) + added;
  }
  if (path.startsWith('docs/')) return describeDoc(path) + added;
  return `**${path.replace(/.*\//, '')}** modificato${added}.`;
}

function buildMessage(commits) {
  const sections = {};
  for (const a of AREAS) sections[a.key] = [];
  sections.other = [];

  for (const { hash, subject, files, patch } of commits) {
    for (const f of files) {
      const a = areaFor(f.path);
      const desc = summarizeFile(f, patch);
      if (!sections[a.key]) sections[a.key] = [];
      sections[a.key].push(desc);
    }
  }

  const lines = ['📦 **Comtra — aggiornamento**', ''];
  for (const a of AREAS) {
    const list = [...new Set(sections[a.key])];
    if (list.length) {
      lines.push(`**${a.label}**`);
      list.slice(0, 8).forEach(d => lines.push(`• ${d}`));
      lines.push('');
    }
  }
  if (sections.other?.length) {
    lines.push('**Altro**');
    sections.other.slice(0, 5).forEach(d => lines.push(`• ${d}`));
    lines.push('');
  }

  const commitLine = commits.length === 1
    ? `_Commit:_ ${commits[0].subject}`
    : `_Ultimi ${commits.length} commit._`;
  lines.push(commitLine);

  return lines.join('\n').trim();
}

const hashes = getCommitHashes(count);
const commits = [];
for (const hash of hashes) {
  const subject = getCommitSubject(hash);
  const { files, patch } = getFilesAndPatch(hash);
  commits.push({ hash, subject, files, patch });
}

const content = buildMessage(commits);
const toSend = content.length > 2000 ? content.slice(0, 1990) + '\n… (troncato)' : content;

async function send(text) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });
  if (!res.ok) {
    console.error('Discord webhook errore:', res.status, await res.text());
    process.exit(1);
  }
  console.log('Inviato a Discord.');
}

await send(toSend);
