import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsDir = path.join(__dirname, '..', 'ds_packages', 'ios-hig');

const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const saveJson = (p, d) => writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
const sha256 = (t) => `sha256:${createHash('sha256').update(t).digest('hex')}`;

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'comtra-ios-hig-extractor/1.0', Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

function collectHeadings(html) {
  const out = [];
  const re = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gims;
  let m;
  while ((m = re.exec(html)) && out.length < 300) {
    const txt = String(m[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (txt) out.push(txt);
  }
  return out;
}

function collectKeywordSignals(html, keywords) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const found = [];
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) found.push(kw);
  }
  return found;
}

async function run() {
  const start = Date.now();
  const tokensPath = path.join(dsDir, 'tokens.json');
  const rulesPath = path.join(dsDir, 'rules.json');
  const componentsPath = path.join(dsDir, 'components.json');
  const manifestPath = path.join(dsDir, 'manifest.json');
  const sourcesPath = path.join(dsDir, 'sources.manifest.json');

  const tokens = loadJson(tokensPath);
  const components = loadJson(componentsPath);
  const manifest = loadJson(manifestPath);
  const sources = loadJson(sourcesPath);

  const docsUrls = [
    ...(sources?.official_sources?.docs || []),
    ...(sources?.official_sources?.tokens || []),
    ...(sources?.official_sources?.components || []),
  ];

  const pages = [];
  for (const url of docsUrls) {
    try {
      const html = await fetchText(url);
      pages.push({
        url,
        headings: collectHeadings(html),
        keyword_signals: collectKeywordSignals(html, [
          'color',
          'typography',
          'font',
          'layout',
          'spacing',
          'navigation',
          'tab bar',
          'toolbar',
          'button',
          'sheet',
          'dialog',
          'alert',
          'picker',
          'menu',
          'badge',
          'tooltip',
          'progress',
          'accessibility',
        ]),
        html_size: html.length,
      });
    } catch (err) {
      pages.push({ url, error: err?.message || String(err), headings: [], keyword_signals: [], html_size: 0 });
    }
  }

  const tokenSignals = pages
    .flatMap((p) => p.headings || [])
    .filter((h) => /(color|typography|icon|layout|spacing|accessibility|motion)/i.test(h))
    .slice(0, 200);

  const componentSignals = pages
    .flatMap((p) => p.headings || [])
    .filter((h) => /(button|tab|sheet|navigation|dialog|picker|menu|progress|badge|tooltip|text field)/i.test(h))
    .slice(0, 250);

  const keywordSignals = [...new Set(pages.flatMap((p) => p.keyword_signals || []))];

  tokens.official_import = tokens.official_import || {};
  tokens.official_import.ios_hig = {
    extracted_at: new Date().toISOString(),
    source_docs: docsUrls,
    heading_signals: tokenSignals,
    heading_signal_count: tokenSignals.length,
  };

  components.official_import = components.official_import || {};
  components.official_import.ios_hig = {
    extracted_at: new Date().toISOString(),
    source_docs: docsUrls,
    component_heading_signals: componentSignals,
    component_heading_count: componentSignals.length,
  };

  saveJson(tokensPath, tokens);
  saveJson(componentsPath, components);

  const report = {
    ds_id: 'ios-hig',
    extracted_at: new Date().toISOString(),
    extractor: 'ios-hig-official-extractor',
    elapsed_ms: Date.now() - start,
    source: {
      docs_count: docsUrls.length,
      pages_fetched: pages.filter((p) => !p.error).length,
      pages_failed: pages.filter((p) => !!p.error).length,
      token_heading_signals: tokenSignals.length,
      component_heading_signals: componentSignals.length,
      keyword_signals: keywordSignals.length,
    },
  };
  saveJson(path.join(dsDir, 'official-extraction.json'), report);

  const concat = readFileSync(tokensPath, 'utf8') + readFileSync(rulesPath, 'utf8') + readFileSync(componentsPath, 'utf8');
  manifest.version = '2026.03.3';
  manifest.hash = sha256(concat);
  manifest.official_extraction = {
    enabled: true,
    report_file: 'official-extraction.json',
    extracted_at: report.extracted_at,
    pages_fetched: report.source.pages_fetched,
    pages_failed: report.source.pages_failed,
    token_heading_signals: report.source.token_heading_signals,
    component_heading_signals: report.source.component_heading_signals,
    keyword_signals: report.source.keyword_signals,
  };
  saveJson(manifestPath, manifest);
  console.log(JSON.stringify(report, null, 2));
}

run().catch((err) => {
  console.error('[ios-hig-official-extractor] failed', err?.message || err);
  process.exit(1);
});
