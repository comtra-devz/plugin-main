import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsDir = path.join(__dirname, '..', 'ds_packages', 'ant');

function loadJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function saveJson(p, data) { writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`); }
function sha256(text) { return `sha256:${createHash('sha256').update(text).digest('hex')}`; }

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'comtra-ant-extractor/1.0', Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function fetchRepoTree(owner, repo) {
  for (const ref of ['master', 'main']) {
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
  const componentsPath = path.join(dsDir, 'components.json');
  const rulesPath = path.join(dsDir, 'rules.json');
  const manifestPath = path.join(dsDir, 'manifest.json');

  const tokens = loadJson(tokensPath);
  const components = loadJson(componentsPath);
  const manifest = loadJson(manifestPath);

  const antd = await fetchRepoTree('ant-design', 'ant-design');
  const tokenPaths = antd.tree
    .filter((x) => x.type === 'blob' && /\.(t|j)sx?$/.test(x.path))
    .filter((x) => /(theme|token|seed|alias|palette|color)/i.test(x.path))
    .map((x) => x.path)
    .slice(0, 150);

  const componentDirs = [...new Set(
    antd.tree
      .filter((x) => x.type === 'tree' && x.path.startsWith('components/'))
      .map((x) => x.path.split('/')[1])
      .filter(Boolean)
  )].sort();

  tokens.official_import = tokens.official_import || {};
  tokens.official_import.ant_design = {
    extracted_at: new Date().toISOString(),
    source_repo: 'ant-design/ant-design',
    ref: antd.ref,
    token_source_files: tokenPaths,
    token_source_count: tokenPaths.length,
  };

  components.official_import = components.official_import || {};
  components.official_import.ant_design = {
    extracted_at: new Date().toISOString(),
    source_repo: 'ant-design/ant-design',
    ref: antd.ref,
    component_dirs: componentDirs,
    component_dir_count: componentDirs.length,
  };

  saveJson(tokensPath, tokens);
  saveJson(componentsPath, components);

  const report = {
    ds_id: 'ant',
    extracted_at: new Date().toISOString(),
    extractor: 'ant-official-extractor',
    elapsed_ms: Date.now() - start,
    source: {
      repo: 'ant-design/ant-design',
      ref: antd.ref,
      token_source_count: tokenPaths.length,
      component_dir_count: componentDirs.length,
    },
  };
  saveJson(path.join(dsDir, 'official-extraction.json'), report);

  const concat = readFileSync(tokensPath, 'utf8') + readFileSync(rulesPath, 'utf8') + readFileSync(componentsPath, 'utf8');
  manifest.version = '2026.03.4';
  manifest.hash = sha256(concat);
  manifest.official_extraction = {
    enabled: true,
    report_file: 'official-extraction.json',
    extracted_at: report.extracted_at,
    token_source_count: tokenPaths.length,
    component_dir_count: componentDirs.length,
  };
  saveJson(manifestPath, manifest);
  console.log(JSON.stringify(report, null, 2));
}

run().catch((err) => {
  console.error('[ant-official-extractor] failed', err?.message || err);
  process.exit(1);
});
