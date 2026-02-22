#!/usr/bin/env node
/**
 * Verifica completa OAuth: DNS, endpoint init, CORS, manifest.
 * Esegui dalla root del plugin: node check-auth.mjs   oppure   npm run check-auth
 */
import dns from 'dns';
import { promisify } from 'util';
import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const resolve4 = promisify(dns.resolve4);
const BASE = 'https://auth.comtra.dev';
const INIT_URL = `${BASE}/api/figma-oauth/init`;

const out = { ok: [], fail: [] };
function ok(msg) { out.ok.push(msg); }
function fail(msg) { out.fail.push(msg); }

function log(prefix, msg) {
  console.log(prefix, msg);
}

async function checkDns() {
  try {
    const hostname = new URL(BASE).hostname;
    await resolve4(hostname);
    ok(`DNS: ${hostname} risolve correttamente`);
  } catch (e) {
    fail(`DNS: ${BASE} non risolve (${e.message}). Controlla il record DNS per "auth".`);
  }
}

function fetchJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: method === 'OPTIONS' ? { 'Origin': 'null' } : {},
      },
      (res) => {
        let body = '';
        res.on('data', (ch) => (body += ch));
        res.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : null;
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data,
              raw: body,
            });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, data: null, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function checkInit() {
  try {
    const r = await fetchJson(INIT_URL);
    if (r.status !== 200) {
      let hint = '';
      if (r.status === 404) {
        hint = ' Il deploy Vercel non espone questa route: verifica di fare deploy da QUESTO repo (con cartella api/figma-oauth/) e che la root del progetto Vercel sia la root del plugin.';
      }
      fail(`Init: ${INIT_URL} ha restituito ${r.status} (atteso 200).${hint} Body: ${(r.raw || '').slice(0, 200)}`);
      return;
    }
    if (!r.data || typeof r.data.authUrl !== 'string' || typeof r.data.readKey !== 'string') {
      fail(`Init: risposta non valida (mancano authUrl o readKey). Body: ${(r.raw || '').slice(0, 300)}`);
      return;
    }
    ok(`Init: ${INIT_URL} risponde 200 con authUrl e readKey`);
    const cors = r.headers['access-control-allow-origin'];
    if (cors === '*' || cors === 'null') {
      ok(`CORS: header Access-Control-Allow-Origin presente (${cors})`);
    } else {
      fail(`CORS: Access-Control-Allow-Origin assente o non permissive (valore: ${cors || 'mancante'}). Il plugin (origin null) verrà bloccato.`);
    }
  } catch (e) {
    fail(`Init: impossibile contattare il server (${e.message}). Verifica che auth.comtra.dev sia online e che il deploy Vercel sia completato.`);
  }
}

async function checkPreflight() {
  try {
    const r = await fetchJson(INIT_URL, 'OPTIONS');
    if (r.status === 204 || r.status === 200) {
      ok(`Preflight OPTIONS: risponde ${r.status}`);
    } else {
      fail(`Preflight OPTIONS: risponde ${r.status} (atteso 204 o 200). Il browser potrebbe bloccare la fetch.`);
    }
  } catch (e) {
    fail(`Preflight OPTIONS: ${e.message}`);
  }
}

function checkManifest() {
  try {
    const root = dirname(fileURLToPath(import.meta.url));
    const path = join(root, 'manifest.json');
    const raw = readFileSync(path, 'utf8');
    const m = JSON.parse(raw);
    const domains = m.networkAccess?.allowedDomains || [];
    if (domains.includes('https://auth.comtra.dev')) {
      ok('Manifest: https://auth.comtra.dev è in allowedDomains');
    } else {
      fail(`Manifest: https://auth.comtra.dev NON è in networkAccess.allowedDomains (attuali: ${domains.join(', ')})`);
    }
  } catch (e) {
    fail(`Manifest: ${e.message}`);
  }
}

function checkBuildUrl() {
  try {
    const root = dirname(fileURLToPath(import.meta.url));
    const path = join(root, 'dist', 'ui.html');
    const content = readFileSync(path, 'utf8');
    if (content.includes('auth.comtra.dev')) {
      ok('Build: dist/ui.html contiene auth.comtra.dev (URL backend corretto)');
    } else if (content.includes('localhost')) {
      fail('Build: dist/ui.html contiene localhost invece di auth.comtra.dev. Esegui: npm run build (e assicurati che constants.ts abbia default https://auth.comtra.dev)');
    } else {
      fail('Build: dist/ui.html non trovato o non contiene auth.comtra.dev. Esegui: npm run build');
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      fail('Build: dist/ui.html non esiste. Esegui: npm run build');
    } else {
      fail(`Build: ${e.message}`);
    }
  }
}

async function main() {
  console.log('\n--- Verifica OAuth Comtra / auth.comtra.dev ---\n');
  await checkDns();
  await checkInit();
  await checkPreflight();
  checkManifest();
  checkBuildUrl();

  console.log('\nRisultati:\n');
  out.ok.forEach((m) => log('  OK   ', m));
  out.fail.forEach((m) => log('  FAIL ', m));

  if (out.fail.length > 0) {
    console.log('\n--- Cosa fare ---');
    if (out.fail.some((m) => m.startsWith('DNS'))) {
      console.log('1. DNS: aggiungi record CNAME "auth" che punta al progetto Vercel (vedi Vercel → Domains).');
    }
    if (out.fail.some((m) => m.startsWith('Init') || m.startsWith('Preflight'))) {
      console.log('2. Server: redeploy su Vercel; verifica variabili FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, BASE_URL, REDIS_URL.');
      console.log('3. CORS: in api/figma-oauth/init.mjs devono essere impostate le header Access-Control-Allow-Origin prima di chiamare Express.');
    }
    if (out.fail.some((m) => m.startsWith('Manifest'))) {
      console.log('4. Manifest: aggiungi "https://auth.comtra.dev" in manifest.json → networkAccess.allowedDomains.');
    }
    if (out.fail.some((m) => m.startsWith('Build'))) {
      console.log('5. Build: dalla root esegui npm run build; in Figma ricarica il plugin (Development → Remove → Import again).');
    }
    console.log('');
    process.exit(1);
  }

  console.log('\nTutto ok. Puoi provare il login dal plugin.\n');
  process.exit(0);
}

main();
