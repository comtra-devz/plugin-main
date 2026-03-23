import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DS_ROOT = path.join(__dirname, '..', 'ds_packages');

function usage() {
  console.log('Usage: node ds-extractors/sync-official-sources.mjs --ds <ds_id> [--strict]');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { ds: '', strict: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--ds') out.ds = String(args[i + 1] || '').trim();
    if (args[i] === '--strict') out.strict = true;
  }
  return out;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

async function fetchSource(url) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'comtra-ds-extractor/1.0',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });
    const body = await res.text();
    return {
      url,
      ok: res.ok,
      status: res.status,
      content_type: res.headers.get('content-type') || null,
      etag: res.headers.get('etag') || null,
      last_modified: res.headers.get('last-modified') || null,
      body_sha256: `sha256:${sha256(body)}`,
      body_size: body.length,
      elapsed_ms: Date.now() - startedAt,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      url,
      ok: false,
      status: null,
      error: err?.message || String(err),
      elapsed_ms: Date.now() - startedAt,
      fetched_at: new Date().toISOString(),
    };
  }
}

function flattenOfficialUrls(officialSources) {
  const out = [];
  for (const group of ['docs', 'tokens', 'components', 'storybook']) {
    const urls = Array.isArray(officialSources?.[group]) ? officialSources[group] : [];
    for (const url of urls) out.push({ group, url });
  }
  return out;
}

async function run() {
  const { ds, strict } = parseArgs();
  if (!ds) {
    usage();
    process.exit(1);
  }
  const dsDir = path.join(DS_ROOT, ds);
  const sourcesPath = path.join(dsDir, 'sources.manifest.json');
  const manifestPath = path.join(dsDir, 'manifest.json');
  const snapshotsDir = path.join(dsDir, 'snapshots');
  mkdirSync(snapshotsDir, { recursive: true });

  const sources = loadJson(sourcesPath);
  const manifest = loadJson(manifestPath);
  const urls = flattenOfficialUrls(sources.official_sources);
  const results = [];

  for (const item of urls) {
    const res = await fetchSource(item.url);
    results.push({ ...res, group: item.group });
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  if (strict && failCount > 0) {
    console.error(`[sync-official-sources] strict mode failed for ${ds}: ${failCount} sources unreachable`);
    process.exit(2);
  }

  const extraction = {
    ds_id: ds,
    extracted_at: new Date().toISOString(),
    extractor_version: '1.0.0',
    source_manifest_sha256: `sha256:${sha256(JSON.stringify(sources))}`,
    package_manifest_version: manifest.version || 'unknown',
    summary: { total: results.length, ok: okCount, failed: failCount },
    sources: results,
  };

  const latestPath = path.join(snapshotsDir, 'latest.json');
  const tsPath = path.join(snapshotsDir, `${Date.now()}.json`);
  writeFileSync(latestPath, `${JSON.stringify(extraction, null, 2)}\n`);
  writeFileSync(tsPath, `${JSON.stringify(extraction, null, 2)}\n`);

  const provenance = {
    ds_id: ds,
    official_only: true,
    extracted_at: extraction.extracted_at,
    extractor_version: extraction.extractor_version,
    source_manifest_file: 'sources.manifest.json',
    snapshot_file: 'snapshots/latest.json',
    snapshot_summary: extraction.summary,
    confidence: failCount === 0 ? 'verified' : 'partial',
  };
  writeFileSync(path.join(dsDir, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(JSON.stringify(provenance, null, 2));
}

run().catch((err) => {
  console.error('[sync-official-sources] fatal', err?.message || err);
  process.exit(1);
});
