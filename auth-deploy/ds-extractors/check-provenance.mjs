import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DS_ROOT = path.join(__dirname, '..', 'ds_packages');
const DS_IDS = ['material3', 'ant', 'carbon', 'bootstrap5', 'baseweb', 'sls', 'ios-hig'];

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

let failures = 0;

for (const ds of DS_IDS) {
  const dsDir = path.join(DS_ROOT, ds);
  const sourcesPath = path.join(dsDir, 'sources.manifest.json');
  const provenancePath = path.join(dsDir, 'provenance.json');
  const snapshotPath = path.join(dsDir, 'snapshots', 'latest.json');

  if (!existsSync(sourcesPath)) {
    console.error(`[provenance] ${ds}: missing sources.manifest.json`);
    failures += 1;
    continue;
  }
  if (!existsSync(provenancePath)) {
    console.error(`[provenance] ${ds}: missing provenance.json`);
    failures += 1;
    continue;
  }
  if (!existsSync(snapshotPath)) {
    console.error(`[provenance] ${ds}: missing snapshots/latest.json`);
    failures += 1;
    continue;
  }

  const provenance = readJson(provenancePath);
  const snapshot = readJson(snapshotPath);
  if (provenance.ds_id !== ds) {
    console.error(`[provenance] ${ds}: provenance ds_id mismatch`);
    failures += 1;
  }
  if (snapshot.ds_id !== ds) {
    console.error(`[provenance] ${ds}: snapshot ds_id mismatch`);
    failures += 1;
  }
  if (provenance.official_only !== true) {
    console.error(`[provenance] ${ds}: official_only must be true`);
    failures += 1;
  }
  if (provenance.confidence !== 'verified') {
    console.error(`[provenance] ${ds}: confidence must be verified (found ${provenance.confidence})`);
    failures += 1;
  }
  const failed = Number(snapshot?.summary?.failed ?? 0);
  if (failed > 0) {
    console.error(`[provenance] ${ds}: snapshot has ${failed} failed source checks`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`[provenance] failed with ${failures} issue(s)`);
  process.exit(2);
}
console.log('[provenance] all DS packages have official provenance snapshots');
