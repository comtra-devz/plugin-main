import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsDir = path.join(__dirname, '..', 'ds_packages', 'bootstrap5');

const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const saveJson = (p, d) => writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
const sha256 = (t) => `sha256:${createHash('sha256').update(t).digest('hex')}`;

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'comtra-bootstrap5-extractor/1.0', Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
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

async function run() {
  const start = Date.now();
  const tokensPath = path.join(dsDir, 'tokens.json');
  const rulesPath = path.join(dsDir, 'rules.json');
  const componentsPath = path.join(dsDir, 'components.json');
  const manifestPath = path.join(dsDir, 'manifest.json');

  const tokens = loadJson(tokensPath);
  const components = loadJson(componentsPath);
  const manifest = loadJson(manifestPath);
  const repo = await fetchRepoTree('twbs', 'bootstrap');

  const tokenFiles = repo.tree
    .filter((x) => x.type === 'blob' && x.path.startsWith('scss/'))
    .filter((x) => /(_variables|_maps|_root|_utilities|_reboot|mixins)/i.test(x.path))
    .map((x) => x.path)
    .slice(0, 200);

  const componentFiles = repo.tree
    .filter((x) => x.type === 'blob' && x.path.startsWith('js/src/'))
    .map((x) => x.path)
    .slice(0, 200);

  tokens.official_import = tokens.official_import || {};
  tokens.official_import.bootstrap5 = {
    extracted_at: new Date().toISOString(),
    source_repo: 'twbs/bootstrap',
    ref: repo.ref,
    token_source_files: tokenFiles,
    token_source_count: tokenFiles.length,
  };

  components.official_import = components.official_import || {};
  components.official_import.bootstrap5 = {
    extracted_at: new Date().toISOString(),
    source_repo: 'twbs/bootstrap',
    ref: repo.ref,
    component_source_files: componentFiles,
    component_source_count: componentFiles.length,
  };

  saveJson(tokensPath, tokens);
  saveJson(componentsPath, components);

  const report = {
    ds_id: 'bootstrap5',
    extracted_at: new Date().toISOString(),
    extractor: 'bootstrap5-official-extractor',
    elapsed_ms: Date.now() - start,
    source: { repo: 'twbs/bootstrap', ref: repo.ref, token_source_count: tokenFiles.length, component_source_count: componentFiles.length },
  };
  saveJson(path.join(dsDir, 'official-extraction.json'), report);

  const concat = readFileSync(tokensPath, 'utf8') + readFileSync(rulesPath, 'utf8') + readFileSync(componentsPath, 'utf8');
  manifest.version = '2026.03.3';
  manifest.hash = sha256(concat);
  manifest.official_extraction = {
    enabled: true,
    report_file: 'official-extraction.json',
    extracted_at: report.extracted_at,
    token_source_count: tokenFiles.length,
    component_source_count: componentFiles.length,
  };
  saveJson(manifestPath, manifest);
  console.log(JSON.stringify(report, null, 2));
}

run().catch((err) => {
  console.error('[bootstrap5-official-extractor] failed', err?.message || err);
  process.exit(1);
});
