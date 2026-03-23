import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsDir = path.join(__dirname, '..', 'ds_packages', 'material3');

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveJson(p, data) {
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

function sha256(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'comtra-material3-extractor/1.0',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'comtra-material3-extractor/1.0' },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchRepoTree(owner, repo) {
  for (const ref of ['main', 'master']) {
    try {
      const data = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
      if (Array.isArray(data?.tree)) return { ref, tree: data.tree };
    } catch {}
  }
  return { ref: null, tree: [] };
}

function collectHexTokenLeaves(node, prefix = '') {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return [];
  const out = [];
  for (const [k, v] of Object.entries(node)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'value')) {
      const value = v.value;
      if (typeof value === 'string' && /^#([0-9a-f]{3,8})$/i.test(value)) {
        out.push({ path: next, value });
      }
      continue;
    }
    out.push(...collectHexTokenLeaves(v, next));
  }
  return out;
}

function slugPath(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function run() {
  const startedAt = Date.now();
  const tokensPath = path.join(dsDir, 'tokens.json');
  const componentsPath = path.join(dsDir, 'components.json');
  const manifestPath = path.join(dsDir, 'manifest.json');

  const tokens = loadJson(tokensPath);
  const components = loadJson(componentsPath);
  const manifest = loadJson(manifestPath);

  const tokenRepo = await fetchRepoTree('material-foundation', 'material-tokens');
  const tokenJsonFiles = tokenRepo.tree
    .filter((x) => x.type === 'blob' && x.path.endsWith('.json'))
    .filter((x) => /(token|palette|scheme|color|typography)/i.test(x.path))
    .slice(0, 30);

  const imported = [];
  for (const f of tokenJsonFiles) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/material-foundation/material-tokens/${tokenRepo.ref}/${f.path}`;
      const text = await fetchText(rawUrl);
      const json = JSON.parse(text);
      const leaves = collectHexTokenLeaves(json).slice(0, 20);
      for (const leaf of leaves) {
        imported.push({
          source_file: f.path,
          token_path: leaf.path,
          value: leaf.value,
        });
      }
    } catch {}
  }

  const webRepo = await fetchRepoTree('material-components', 'material-web');
  const componentPkgs = [...new Set(
    webRepo.tree
      .map((x) => String(x.path || '').split('/')[0])
      .filter((x) => x && !x.startsWith('.') && !x.endsWith('.md') && !x.endsWith('.ts') && !x.includes(' '))
      .filter((x) => !['catalog', 'docs', 'labs', 'internal', 'scripts', 'test', 'tokens', 'focus', 'labs'].includes(x))
  )].sort();

  tokens.official_import = tokens.official_import || {};
  tokens.official_import.material_foundation = {
    extracted_at: new Date().toISOString(),
    source_repo: 'material-foundation/material-tokens',
    ref: tokenRepo.ref,
    files_scanned: tokenJsonFiles.length,
    token_count: imported.length,
    tokens: imported.slice(0, 400),
  };

  components.official_import = components.official_import || {};
  components.official_import.material_web = {
    extracted_at: new Date().toISOString(),
    source_repo: 'material-components/material-web',
    ref: webRepo.ref,
    package_count: componentPkgs.length,
    packages: componentPkgs,
  };

  saveJson(tokensPath, tokens);
  saveJson(componentsPath, components);

  const extractionReport = {
    ds_id: 'material3',
    extracted_at: new Date().toISOString(),
    extractor: 'material3-official-extractor',
    elapsed_ms: Date.now() - startedAt,
    token_source: {
      repo: 'material-foundation/material-tokens',
      ref: tokenRepo.ref,
      files_scanned: tokenJsonFiles.length,
      imported_tokens: imported.length,
    },
    component_source: {
      repo: 'material-components/material-web',
      ref: webRepo.ref,
      package_count: componentPkgs.length,
    },
  };
  saveJson(path.join(dsDir, 'official-extraction.json'), extractionReport);

  const concat = readFileSync(tokensPath, 'utf8') + readFileSync(path.join(dsDir, 'rules.json'), 'utf8') + readFileSync(componentsPath, 'utf8');
  manifest.version = '2026.03.5';
  manifest.hash = sha256(concat);
  manifest.official_extraction = {
    enabled: true,
    report_file: 'official-extraction.json',
    extracted_at: extractionReport.extracted_at,
    token_files_scanned: extractionReport.token_source.files_scanned,
    imported_tokens: extractionReport.token_source.imported_tokens,
    material_web_packages: extractionReport.component_source.package_count,
  };
  saveJson(manifestPath, manifest);

  console.log(JSON.stringify(extractionReport, null, 2));
}

run().catch((err) => {
  console.error('[material3-official-extractor] failed', err?.message || err);
  process.exit(1);
});
