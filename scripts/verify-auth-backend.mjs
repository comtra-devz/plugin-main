#!/usr/bin/env node
/**
 * Smoke test produzione: CORS + route agents + credits su auth.comtra.dev
 * (stesso dominio del plugin; webview Figma usa Origin null → serve ACAO).
 *
 * Uso: npm run verify:backend
 * Override: COMTRA_AUTH_URL=https://auth.comtra.dev npm run verify:backend
 */
const BASE = (process.env.COMTRA_AUTH_URL || 'https://auth.comtra.dev').replace(/\/$/, '');

const out = { ok: [], fail: [] };
function pass(msg) {
  out.ok.push(msg);
  console.log('  ✓', msg);
}
function err(msg) {
  out.fail.push(msg);
  console.error('  ✗', msg);
}

function hasCors(h) {
  const v = h.get('access-control-allow-origin');
  return v === '*' || (v && v.length > 0);
}

async function main() {
  console.log(`\nAuth backend smoke test → ${BASE}\n`);

  // 1) Preflight come il browser (POST + JSON + Authorization)
  try {
    const r = await fetch(`${BASE}/api/agents/generate`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'null',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, authorization',
      },
    });
    if (r.status !== 204 && r.status !== 200) err(`OPTIONS /api/agents/generate → HTTP ${r.status} (atteso 204)`);
    else pass(`OPTIONS /api/agents/generate → ${r.status}`);
    if (!hasCors(r.headers)) err('OPTIONS: manca Access-Control-Allow-Origin');
    else pass('OPTIONS: Access-Control-Allow-Origin presente');
  } catch (e) {
    err(`OPTIONS /api/agents/generate: ${e.message}`);
  }

  // 2) POST senza body valido: deve rispondere (tipicamente 401), con CORS sulla risposta
  try {
    const r = await fetch(`${BASE}/api/agents/generate`, {
      method: 'POST',
      headers: { Origin: 'null', 'Content-Type': 'application/json', Authorization: 'Bearer x' },
      body: JSON.stringify({}),
    });
    if (r.status < 400) err(`POST /api/agents/generate → HTTP ${r.status} (atteso 4xx per token invalido)`);
    else pass(`POST /api/agents/generate → ${r.status} (atteso: Unauthorized / validation)`);
    if (!hasCors(r.headers)) err('POST: manca Access-Control-Allow-Origin');
    else pass('POST: Access-Control-Allow-Origin presente');
  } catch (e) {
    err(`POST /api/agents/generate: ${e.message}`);
  }

  // 3) Credits (stesso host usato dal plugin)
  try {
    const r = await fetch(`${BASE}/api/credits`, { headers: { Origin: 'null' } });
    if (r.status !== 401) err(`GET /api/credits (no auth) → HTTP ${r.status} (atteso 401)`);
    else pass('GET /api/credits (no auth) → 401');
    if (!hasCors(r.headers)) err('GET /api/credits: manca Access-Control-Allow-Origin');
    else pass('GET /api/credits: Access-Control-Allow-Origin presente');
  } catch (e) {
    err(`GET /api/credits: ${e.message}`);
  }

  console.log('');
  if (out.fail.length) {
    console.error(`Fallite: ${out.fail.length}  |  Ok: ${out.ok.length}\n`);
    process.exit(1);
  }
  console.log(`Tutte le verifiche superate (${out.ok.length}).\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
