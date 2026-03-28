/**
 * Fase 5 — Sintesi migliorie via LLM (OpenAI-compatible **o** Google Gemini).
 *
 * Scelta del modello (env):
 * - `PRODUCT_SOURCES_LLM_PROVIDER` = `moonshot` (default) | `openai` | `custom` | **`gemini`** | **`groq`**
 * - **moonshot** (Kimi): base `https://api.moonshot.ai/v1`, key `PRODUCT_SOURCES_LLM_API_KEY` o fallback **`KIMI_API_KEY`**, modello `PRODUCT_SOURCES_LLM_MODEL` o **`KIMI_MODEL`** o `kimi-k2-0905-preview`
 * - **openai**: base `https://api.openai.com/v1`, key `OPENAI_API_KEY` o `PRODUCT_SOURCES_LLM_API_KEY`, modello `PRODUCT_SOURCES_LLM_MODEL` o `gpt-4o-mini`
 * - **custom**: `PRODUCT_SOURCES_LLM_BASE_URL` (es. `https://api.example.com/v1`), `PRODUCT_SOURCES_LLM_API_KEY`, `PRODUCT_SOURCES_LLM_MODEL`
 * - **groq** (OpenAI-compatible, free tier veloce): base `https://api.groq.com/openai/v1`, key **`GROQ_API_KEY`** (o `PRODUCT_SOURCES_LLM_API_KEY`), modello default `llama-3.3-70b-versatile`
 * - **gemini** (Google AI Studio): key **`GEMINI_API_KEY`** o **`GOOGLE_AI_API_KEY`**, modello default **`gemini-2.5-flash`** (Gemini 2.0 Flash è deprecato). Path API: `PRODUCT_SOURCES_GEMINI_API_VERSION` = `v1` (default, stabile) o `v1beta`. Se quota/rate limit: messaggio nel report e **retry automatico** alla run successiva.
 *
 * Abilitazione costi: `PRODUCT_SOURCES_LLM_SYNTHESIS=1`
 *
 * Esecuzione **senza token su Vercel** (delega a Cursor/MCP):
 * - `PRODUCT_SOURCES_LLM_EXECUTION=mcp` (alias: `client`) oppure `PRODUCT_SOURCES_LLM_MCP=1`
 * - Il report include un fence `product-sources-llm-bundle`; il server MCP locale chiama Kimi solo quando invochi il tool.
 * - Vedi `mcp/product-sources-synthesis/README.md`.
 */

/**
 * @returns {boolean}
 */
export function isLlmSynthesisEnabled() {
  return (
    process.env.PRODUCT_SOURCES_LLM_SYNTHESIS === '1' ||
    process.env.PRODUCT_SOURCES_LLM_SYNTHESIS === 'true'
  );
}

/**
 * @returns {{ provider: string, baseUrl: string, apiKey: string, model: string }}
 */
export function getProductSourcesLlmConfig() {
  const provider = (process.env.PRODUCT_SOURCES_LLM_PROVIDER || 'moonshot').toLowerCase().trim();

  if (provider === 'gemini') {
    const model = (process.env.PRODUCT_SOURCES_LLM_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');
    return {
      provider: 'gemini',
      baseUrl: '',
      apiKey:
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        '',
      model,
    };
  }

  if (provider === 'groq') {
    return {
      provider: 'groq',
      baseUrl: (process.env.PRODUCT_SOURCES_LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
      apiKey: process.env.GROQ_API_KEY || process.env.PRODUCT_SOURCES_LLM_API_KEY || '',
      model: process.env.PRODUCT_SOURCES_LLM_MODEL || 'llama-3.3-70b-versatile',
    };
  }

  if (provider === 'openai') {
    return {
      provider: 'openai',
      baseUrl: (process.env.PRODUCT_SOURCES_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      apiKey: process.env.OPENAI_API_KEY || process.env.PRODUCT_SOURCES_LLM_API_KEY || '',
      model: process.env.PRODUCT_SOURCES_LLM_MODEL || 'gpt-4o-mini',
    };
  }

  if (provider === 'custom') {
    return {
      provider: 'custom',
      baseUrl: (process.env.PRODUCT_SOURCES_LLM_BASE_URL || '').replace(/\/$/, ''),
      apiKey: process.env.PRODUCT_SOURCES_LLM_API_KEY || '',
      model: process.env.PRODUCT_SOURCES_LLM_MODEL || '',
    };
  }

  // moonshot / kimi (allineato a auth-deploy/oauth-server)
  return {
    provider: 'moonshot',
    baseUrl: (process.env.PRODUCT_SOURCES_LLM_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/$/, ''),
    apiKey: process.env.PRODUCT_SOURCES_LLM_API_KEY || process.env.KIMI_API_KEY || '',
    model:
      process.env.PRODUCT_SOURCES_LLM_MODEL ||
      process.env.KIMI_MODEL ||
      'kimi-k2-0905-preview',
  };
}

function getMaxBundleChars() {
  const n = Number(process.env.PRODUCT_SOURCES_LLM_MAX_BUNDLE_CHARS || 100_000);
  return Number.isFinite(n) && n >= 5000 ? Math.min(n, 500_000) : 100_000;
}

function getMaxOutTokens() {
  const n = Number(process.env.PRODUCT_SOURCES_LLM_MAX_TOKENS || 4096);
  return Number.isFinite(n) && n >= 256 ? Math.min(n, 16_000) : 4096;
}

function getTemperature() {
  const n = Number(process.env.PRODUCT_SOURCES_LLM_TEMPERATURE ?? 0.35);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.35;
}

function clip(s, max) {
  const t = String(s || '');
  if (t.length <= max) return t;
  return t.slice(0, max) + '\n…(troncato per limite contesto LLM)';
}

/**
 * Errori Gemini da trattare come “quota / rate limit”: niente throw, report con messaggio e retry alla prossima run.
 *
 * @param {number} status
 * @param {object} data — body JSON parsato
 */
export function isGeminiQuotaOrRateLimitError(status, data) {
  if (status === 429) return true;
  const err = data?.error;
  if (!err || typeof err !== 'object') return false;
  const st = String(err.status || '').toUpperCase();
  if (st === 'RESOURCE_EXHAUSTED') return true;
  if (Number(err.code) === 429) return true;
  if (st === 'UNAVAILABLE' && /quota|rate|limit|exhausted|throttl/i.test(String(err.message || ''))) {
    return true;
  }
  return false;
}

/**
 * @param {object} [data]
 * @returns {string}
 */
export function buildGeminiQuotaSkippedMarkdown(data) {
  const hint = data?.error?.message ? clip(String(data.error.message), 400) : '';
  const lines = [
    `_(Fase 5 — **Google Gemini**: in questa run non è stata generata la sintesi: **quota free tier**, **rate limit** o servizio temporaneamente non disponibile.)_`,
    ``,
    `_**Ripristino automatico:** alla **prossima** esecuzione (cron o scansione manuale) la pipeline **riproverà** la chiamata senza cambiare configurazione: quando il limite Google si rigenera, l’analisi tornerà da sola._`,
  ];
  if (hint) {
    lines.push(``);
    lines.push(`_Dettaglio API:_ ${hint}`);
  }
  return lines.join('\n');
}

/**
 * @param {object} ctx
 * @returns {boolean}
 */
export function hasProductSourcesSynthesisMaterial(ctx) {
  const { newLinks, linkedinEnrichments, webEnrichments, pluginDocSnapshot } = ctx;
  if (newLinks?.length) return true;
  const snap = pluginDocSnapshot;
  if (snap?.text?.trim() && !snap.skipped) return true;
  for (const e of linkedinEnrichments || []) {
    if (e.text?.trim() || (e.outboundLinks || []).length) return true;
  }
  for (const w of webEnrichments || []) {
    if (w.text?.trim() && !w.error) return true;
  }
  return false;
}

/**
 * @returns {boolean}
 */
export function isProductSourcesLlmMcpExecution() {
  const v = (process.env.PRODUCT_SOURCES_LLM_EXECUTION || 'server').toLowerCase().trim();
  if (v === 'mcp' || v === 'client') return true;
  return (
    process.env.PRODUCT_SOURCES_LLM_MCP === '1' || process.env.PRODUCT_SOURCES_LLM_MCP === 'true'
  );
}

const SYSTEM_PROMPT = `Sei un assistente senior per un prodotto SaaS (plugin Figma: audit, generazione, crediti, dashboard).
Ti vengono fornite: (1) fonti esterne raccolte da Notion (URL nuovi, estratti LinkedIn/web), (2) uno snapshot della documentazione interna del plugin.

Compito: produrre una **sintesi in Markdown** (italiano) utile al team prodotto/engineering.

Regole obbligatorie:
- Proponi solo **migliorie** plausibili; **niente** suggerimenti che peggiorano UX, sicurezza, accessibilità o che introducono breaking change non richiesti.
- Ogni idea deve essere **collegata** a una fonte (URL o sezione doc) quando possibile.
- Se le informazioni non bastano, dillo esplicitamente invece di inventare.
- Non scrivere codice di produzione; solo idee, priorità e riferimenti.
- Struttura obbligatoria dell'output (usa proprio questi titoli ##):
  ## Priorità suggerite
  ## Idee tecniche (plugin / backend / dashboard)
  ## Idee strategiche (prodotto, go-to-market, positioning)
  ## Rischi e guardrail
  ## Fonti usate (elenco URL o path doc)

Tono: chiaro, operativo, rispettoso del contesto Comtra.`;

/**
 * @returns {string}
 */
export function getProductSourcesSynthesisSystemPrompt() {
  return SYSTEM_PROMPT;
}

/**
 * @param {string} userBundle
 * @returns {string}
 */
export function buildProductSourcesSynthesisUserMessage(userBundle) {
  return `Analizza il seguente pacchetto e produci SOLO il Markdown richiesto (nessun preambolo fuori struttura).\n\n---\n\n${userBundle}`;
}

/**
 * @param {object} data
 * @returns {string}
 */
function extractGeminiResponseText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
}

/**
 * API stabile consigliata (`v1`); `v1beta` solo se serve un modello preview non ancora su v1.
 * @returns {string}
 */
function getGeminiApiVersionPath() {
  const raw = (process.env.PRODUCT_SOURCES_GEMINI_API_VERSION || 'v1').toLowerCase().trim();
  if (raw === 'v1beta' || raw === 'beta') return 'v1beta';
  return 'v1';
}

/** Soglie meno aggressive: il testo prodotto/notizie spesso scatta su MEDIUM con i default Google. */
function geminiSafetySettingsPayload() {
  const categories = [
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
  ];
  return categories.map((category) => ({
    category,
    threshold: 'BLOCK_ONLY_HIGH',
  }));
}

/**
 * @param {object} data — body JSON 200 OK ma senza testo utile
 * @returns {string}
 */
function buildGeminiDiagnosticMarkdown(data) {
  const pf = data?.promptFeedback;
  const cand = data?.candidates;
  const candLen = Array.isArray(cand) ? cand.length : 0;
  const c0 = cand?.[0];
  const finish = c0?.finishReason != null ? String(c0.finishReason) : '';
  const promptBlock = pf?.blockReason != null ? String(pf.blockReason) : '';
  const safetyRatings = Array.isArray(c0?.safetyRatings)
    ? c0.safetyRatings
        .map((x) => `${x.category || '?'}:${x.probability || '?'}`)
        .slice(0, 6)
        .join('; ')
    : '';
  const lines = [
    `_(Fase 5 — **Gemini**: risposta senza testo generato.)_`,
    ``,
    `- **candidates.length:** ${candLen}`,
    `- **promptFeedback.blockReason:** ${promptBlock || '—'}`,
    `- **candidates[0].finishReason:** ${finish || '—'}`,
  ];
  if (safetyRatings) lines.push(`- **safetyRatings:** ${safetyRatings}`);
  lines.push(
    ``,
    `_Suggerimenti: usa un modello stabile (\`PRODUCT_SOURCES_LLM_MODEL=gemini-2.5-flash\`), verifica \`PRODUCT_SOURCES_GEMINI_API_VERSION=v1\`, riduci \`PRODUCT_SOURCES_LLM_MAX_BUNDLE_CHARS\` se il prompt è enorme, oppure passa a **\`PRODUCT_SOURCES_LLM_PROVIDER=groq\`** + \`GROQ_API_KEY\`._`,
  );
  return lines.join('\n');
}

/**
 * @param {{ apiKey: string, model: string }} cfg
 * @param {string} userBundle
 * @returns {Promise<string>}
 */
async function runGeminiGenerateContent(cfg, userBundle) {
  const modelId = String(cfg.model || '').replace(/^models\//, '').trim();
  if (!modelId) throw new Error('model Gemini mancante');
  if (!cfg.apiKey) throw new Error('API key Gemini mancante');

  const ver = getGeminiApiVersionPath();
  const url = `https://generativelanguage.googleapis.com/${ver}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  const body = {
    systemInstruction: {
      parts: [{ text: getProductSourcesSynthesisSystemPrompt() }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: buildProductSourcesSynthesisUserMessage(userBundle) }],
      },
    ],
    generationConfig: {
      temperature: getTemperature(),
      maxOutputTokens: getMaxOutTokens(),
    },
    safetySettings: geminiSafetySettingsPayload(),
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini: risposta non JSON (${r.status}): ${clip(raw, 500)}`);
  }

  if (!r.ok) {
    if (isGeminiQuotaOrRateLimitError(r.status, data)) {
      return buildGeminiQuotaSkippedMarkdown(data);
    }
    const msg = data?.error?.message ? String(data.error.message) : clip(raw, 800);
    const hint404 =
      r.status === 404
        ? ' Modello sconosciuto o non disponibile per questa API: prova gemini-2.5-flash e PRODUCT_SOURCES_GEMINI_API_VERSION=v1.'
        : '';
    throw new Error(`Gemini API ${r.status}: ${msg}${hint404}`);
  }

  const promptBlockReason = data?.promptFeedback?.blockReason;
  if (promptBlockReason && String(promptBlockReason).trim() && promptBlockReason !== 'BLOCK_REASON_UNSPECIFIED') {
    return `_(Fase 5 — Gemini: **prompt bloccato** (\`${promptBlockReason}\`). Contenuti delle fonti o istruzioni di sistema in conflitto con le safety policy; riduci il bundle o cambia provider es. Groq.)_`;
  }

  const blockReason = data?.candidates?.[0]?.finishReason;
  if (blockReason === 'SAFETY' || blockReason === 'BLOCKLIST') {
    return `_(Fase 5 — Gemini: output bloccato per policy (\`${blockReason}\`). Riprovare riducendo il bundle o rivedendo i contenuti; oppure \`PRODUCT_SOURCES_LLM_PROVIDER=groq\`.)_`;
  }

  const text = extractGeminiResponseText(data);
  if (!String(text).trim()) {
    return buildGeminiDiagnosticMarkdown(data);
  }
  return text.trim();
}

/**
 * @param {object} ctx
 * @returns {string}
 */
export function buildProductSourcesSynthesisBundle(ctx) {
  const maxTotal = getMaxBundleChars();
  const parts = [];

  parts.push(
    `### Contesto run\n\n- Modalità Notion: ${ctx.mode || 'n/d'}\n- Sorgente: ${ctx.sourceLabel || 'n/d'}\n- URL nuovi (dedup): ${ctx.newLinks?.length ?? 0}\n- URL già visti: ${ctx.seenLinks?.length ?? 0}`,
  );

  const novel = ctx.newLinks || [];
  if (novel.length) {
    const lines = novel.map((l) => `- ${l.url}${l.contexts?.length ? ` — ${l.contexts.slice(0, 2).join('; ')}` : ''}`);
    parts.push(`### URL nuovi da Notion\n\n${lines.join('\n')}`);
  }

  const li = ctx.linkedinEnrichments || [];
  if (li.length) {
    const chunks = [];
    for (const e of li) {
      let s = `#### ${e.url}\n`;
      if (e.error) s += `_Errore:_ ${e.error}\n`;
      else {
        s += clip(e.text, 6000);
        if (e.outboundLinks?.length) {
          s += `\n_Link nel post:_ ${e.outboundLinks.slice(0, 15).join(', ')}`;
        }
      }
      chunks.push(s);
    }
    parts.push(`### LinkedIn (estratto)\n\n${chunks.join('\n\n')}`);
  }

  const web = ctx.webEnrichments || [];
  if (web.length) {
    const chunks = [];
    for (const w of web) {
      let s = `#### ${w.url}\n`;
      if (w.kind) s += `_Tipo:_ ${w.kind}\n`;
      if (w.error) s += `_Errore:_ ${w.error}\n`;
      else s += clip(w.text, 4000);
      chunks.push(s);
    }
    parts.push(`### Web (estratto)\n\n${chunks.join('\n\n')}`);
  }

  const snap = ctx.pluginDocSnapshot;
  if (snap?.text && !snap.skipped) {
    parts.push(`### Snapshot documentazione plugin (Fase 4)\n\n${clip(snap.text, 120_000)}`);
  } else if (snap?.skipped) {
    parts.push(`### Snapshot documentazione\n\n_Non incluso o disattivato (${snap.skipReason || 'n/d'})._`);
  }

  const full = parts.join('\n\n---\n\n');
  return clip(full, maxTotal);
}

/**
 * Chiama Gemini `generateContent` oppure `/chat/completions` (OpenAI-compatible). Usato dal cron e dal MCP locale.
 *
 * @param {{ provider?: string, baseUrl: string, apiKey: string, model: string }} cfg
 * @param {string} userBundle — corpo “bundle” (stesso di {@link buildProductSourcesSynthesisBundle})
 * @returns {Promise<string>} Markdown prodotto dal modello
 */
export async function runProductSourcesSynthesisWithConfig(cfg, userBundle) {
  if (cfg.provider === 'gemini') {
    return runGeminiGenerateContent(cfg, userBundle);
  }

  if (!cfg.baseUrl || !cfg.model) {
    throw new Error('baseUrl o model mancanti nella config LLM');
  }
  if (!String(userBundle || '').trim()) {
    throw new Error('bundle vuoto');
  }

  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildProductSourcesSynthesisUserMessage(userBundle) },
    ],
    temperature: getTemperature(),
    max_tokens: getMaxOutTokens(),
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await r.text();
  if (!r.ok) {
    throw new Error(`API ${r.status}: ${clip(raw, 800)}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Risposta API non JSON');
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Contenuto vuoto dalla API');
  }
  return content.trim();
}

/**
 * JSON da incollare nel tool MCP / Kimi locale (zero chiamate dal server deploy).
 * @param {object} ctx
 * @returns {string}
 */
export function buildProductSourcesMcpBundlePayloadJson(ctx) {
  const userBundle = buildProductSourcesSynthesisBundle(ctx);
  const providerHint = (process.env.PRODUCT_SOURCES_LLM_PROVIDER || 'moonshot').toLowerCase().trim();
  return JSON.stringify(
    {
      v: 1,
      kind: 'product-sources-llm-bundle',
      generatedAt: new Date().toISOString(),
      userBundle,
      providerHint,
      note: 'Passa l’intera stringa JSON al tool MCP synthesize_product_sources (o kimi_synthesize_product_sources), oppure solo userBundle.',
    },
    null,
    0,
  );
}

/**
 * Sezione Markdown: istruzioni + fence per MCP.
 * @param {object} ctx
 */
export function buildProductSourcesMcpDelegationMarkdown(ctx) {
  const payload = buildProductSourcesMcpBundlePayloadJson(ctx);
  return [
    `## Sintesi proposte (LLM, Fase 5) — completamento via MCP / Kimi (locale)`,
    ``,
    `_Su questo deploy **non** è stata eseguita alcuna chiamata LLM (risparmio token). Completare così:_`,
    ``,
    `1. **Cursor** → MCP \`comtra-product-sources\` → tool **\`synthesize_product_sources\`** (\`bundle\` = JSON sotto o solo \`userBundle\`).`,
    `2. Env MCP: \`PRODUCT_SOURCES_LLM_PROVIDER=gemini\` + \`GEMINI_API_KEY\`, oppure \`groq\` + \`GROQ_API_KEY\`, oppure Moonshot/OpenAI come in \`lib/product-sources-llm.mjs\`.`,
    `3. Incolla l’output Markdown del tool nella PR / nello storico report se serve.`,
    ``,
    `\`\`\`product-sources-llm-bundle`,
    payload,
    `\`\`\``,
    ``,
  ].join('\n');
}

/**
 * @param {{
 *   mode?: string,
 *   sourceLabel?: string,
 *   newLinks?: Array<{ url: string, contexts?: string[] }>,
 *   seenLinks?: Array<{ url: string }>,
 *   linkedinEnrichments?: Array<{ url: string, text?: string, outboundLinks?: string[], error?: string }>,
 *   webEnrichments?: Array<{ url: string, text?: string, error?: string, kind?: string }>,
 *   pluginDocSnapshot?: { text?: string, skipped?: boolean, skipReason?: string } | null,
 * }} ctx
 */
export async function synthesizeProductImprovementsMarkdown(ctx) {
  if (!isLlmSynthesisEnabled()) {
    return '';
  }
  if (!hasProductSourcesSynthesisMaterial(ctx)) {
    return '';
  }

  if (isProductSourcesLlmMcpExecution()) {
    return buildProductSourcesMcpDelegationMarkdown(ctx);
  }

  const cfg = getProductSourcesLlmConfig();
  if (!cfg.apiKey) {
    return `\n\n_(Fase 5 LLM: nessuna API key — **Gemini** \`GEMINI_API_KEY\`; **Groq** \`GROQ_API_KEY\`; Moonshot \`KIMI_API_KEY\`; OpenAI \`OPENAI_API_KEY\`; oppure \`PRODUCT_SOURCES_LLM_EXECUTION=mcp\`.)_\n`;
  }
  if (cfg.provider !== 'gemini' && (!cfg.baseUrl || !cfg.model)) {
    return '\n\n_(Fase 5 LLM: \`PRODUCT_SOURCES_LLM_BASE_URL\` o \`PRODUCT_SOURCES_LLM_MODEL\` mancanti per provider custom.)_\n';
  }
  if (cfg.provider === 'gemini' && !cfg.model) {
    return '\n\n_(Fase 5 LLM: modello Gemini mancante — imposta \`PRODUCT_SOURCES_LLM_MODEL\`.)_\n';
  }

  const userContent = buildProductSourcesSynthesisBundle(ctx);

  try {
    return await runProductSourcesSynthesisWithConfig(cfg, userContent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `\n\n_(Fase 5 LLM: ${msg})_\n`;
  }
}
