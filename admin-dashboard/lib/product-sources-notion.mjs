/**
 * Estrazione link da Notion + report Markdown (condiviso tra API admin e cron).
 */
import {
  listAllBlocksDepthFirst,
  queryAllDatabasePages,
  extractFromBlock,
  extractUrlsFromDatabaseProperties,
  normalizeUrlKey,
  buildIgnorePatterns,
} from './notion-extract.mjs';

/** Notion accetta UUID con o senza trattini */
export function formatUuid(id) {
  const s = String(id).replace(/-/g, '');
  if (!/^[a-f0-9]{32}$/i.test(s)) return String(id).trim();
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function normalizeNotionId(raw) {
  if (raw == null || raw === '') return '';
  return formatUuid(String(raw).trim());
}

/**
 * @param {string} token
 * @param {string} pageId
 * @param {RegExp[]} ignorePatterns
 */
export async function extractFromPage(token, pageId, ignorePatterns) {
  const blocks = await listAllBlocksDepthFirst(token, pageId);
  /** @type {Map<string, { url: string, contexts: Set<string> }>} */
  const byKey = new Map();
  let ignoredBlocks = 0;

  for (const block of blocks) {
    const { urls, contextLabel, ignored } = extractFromBlock(block, { ignorePatterns });
    if (ignored) {
      ignoredBlocks++;
      continue;
    }
    for (const url of urls) {
      const key = normalizeUrlKey(url);
      if (!byKey.has(key)) byKey.set(key, { url, contexts: new Set() });
      byKey.get(key).contexts.add(contextLabel);
    }
  }

  return {
    links: [...byKey.values()].map((v) => ({
      url: v.url,
      contexts: [...v.contexts],
    })),
    ignoredBlocks,
    blockCount: blocks.length,
  };
}

/**
 * @param {string} token
 * @param {string} databaseId
 * @param {RegExp[]} ignorePatterns
 */
export async function extractFromDatabase(token, databaseId, ignorePatterns) {
  const pages = await queryAllDatabasePages(token, databaseId);
  /** @type {Map<string, { url: string, contexts: Set<string> }>} */
  const byKey = new Map();
  let ignoredProps = 0;
  let pageCount = 0;

  for (const page of pages) {
    pageCount++;
    const pageId = page.id;
    const title =
      page.properties?.Name?.title?.[0]?.plain_text ||
      page.properties?.name?.title?.[0]?.plain_text ||
      pageId.slice(0, 8);

    const fromProps = extractUrlsFromDatabaseProperties(page.properties || {}, { ignorePatterns });
    for (const { url, context } of fromProps) {
      const key = normalizeUrlKey(url);
      if (!byKey.has(key)) byKey.set(key, { url, contexts: new Set() });
      byKey.get(key).contexts.add(`${title} · ${context}`);
    }

    const pageBody = await extractFromPage(token, pageId, ignorePatterns);
    for (const { url, contexts } of pageBody.links) {
      const key = normalizeUrlKey(url);
      if (!byKey.has(key)) byKey.set(key, { url, contexts: new Set() });
      const entry = byKey.get(key);
      for (const c of contexts) entry.contexts.add(`${title} · ${c}`);
    }
    ignoredProps += pageBody.ignoredBlocks;
  }

  return {
    links: [...byKey.values()].map((v) => ({
      url: v.url,
      contexts: [...v.contexts],
    })),
    ignoredBlocks: ignoredProps,
    pageCount,
  };
}

/**
 * Euristica leggera: aree ruleset / doc da valutare (sempre da confermare a mano).
 * @param {string} url
 */
export function hintRulesetArea(url) {
  try {
    const u = String(url);
    const hints = [];
    if (/linkedin\.com/i.test(u)) hints.push('Contesto esterno (social); incrocio manuale con roadmap/ruleset');
    if (/a11y|accessibility|wcag|wai-aria/i.test(u)) hints.push('**Accessibility** (audit / rules)');
    if (/ux|usability|heuristic|nn(g)?\b|baymard/i.test(u)) hints.push('**UX / usabilità**');
    if (/figma|design[\s_-]?system|component/i.test(u)) hints.push('**Design system / prototipo**');
    if (/openapi|swagger|graphql|rest\s*api|webhook/i.test(u)) hints.push('**Documentazione tecnica / API**');
    if (/privacy|gdpr|legal|terms|cookie/i.test(u)) hints.push('**Policy / copy legale**');
    if (/escalat|support|ticket|csat/i.test(u)) hints.push('**Support / escalation**');
    if (!hints.length) hints.push('_Nessun match automatico — classificare manualmente_');
    return [...new Set(hints)].join(' · ');
  } catch {
    return '_Classificare manualmente_';
  }
}

/**
 * @param {object} opts
 * @param {Array<{ url: string, contexts?: string[] }>} opts.links — tutti i link (conta totale)
 * @param {Array<{ url: string, contexts?: string[] }>} [opts.newLinks] — se presente con `seenLinks`, layout cron dedup
 * @param {Array<{ url: string, contexts?: string[] }>} [opts.seenLinks]
 * @param {Array<{ url: string, text?: string, outboundLinks?: string[], error?: string }>} [opts.linkedinEnrichments]
 */
export function buildMarkdownReport({
  links,
  newLinks,
  seenLinks,
  sourceLabel,
  mode,
  stats,
  linkedinEnrichments = [],
}) {
  const when = new Date().toISOString();
  const useDedup = Array.isArray(newLinks) && Array.isArray(seenLinks);
  const novel = useDedup ? newLinks : links;
  const already = useDedup ? seenLinks : [];

  const lines = [
    `# Report fonti prodotto (Notion)`,
    ``,
    `- **Generato:** ${when}`,
    `- **Sorgente:** ${sourceLabel} (${mode})`,
    `- **Link unici (totale Notion):** ${links.length}`,
    `- **Blocchi ignorati (filtro testo):** ${stats.ignoredBlocks}`,
    ``,
    `## Archiviazione`,
    ``,
    `Ogni run cron salva **l’intero** Markdown in Postgres: tabella \`product_sources_cron_runs\`, colonna \`report_markdown\` (storico per data run). ` +
      `La prima passata è di solito la più corposa; le successive contengono soprattutto **link nuovi** + sezioni compatte per i già visti.`,
    ``,
    `## Principi e guardrail`,
    ``,
    `- Migliorie **sì**, se supportate da fonti linkate.`,
    `- **No** a cambiamenti che peggiorano o confondono comportamenti esistenti; **no** breaking non voluti; delta minimo e PR piccole.`,
    `- Solo **URL** da Notion (niente codice “sparato” senza link); blocchi con **Antigravity** esclusi.`,
    `- **LinkedIn:** post + testo + link nel payload Apify; **niente commenti** ai post.`,
    ``,
  ];

  if (useDedup) {
    lines.push(`## Riepilogo run`);
    lines.push(``);
    lines.push(`| Voce | Conteggio |`);
    lines.push(`|------|-----------|`);
    lines.push(`| Nuovi URL (mai visti in cron prima di questa run) | ${novel.length} |`);
    lines.push(`| Già esaminati in run precedenti | ${already.length} |`);
    lines.push(`| LinkedIn arricchiti con Apify (solo nuovi URL) | ${linkedinEnrichments.length} |`);
    lines.push(``);
  }

  lines.push(`## Link da valutare`);
  lines.push(``);
  lines.push(
    `Solo URL estratti dal contenuto Notion. Argomenti fuori scope, suggerimenti codice non linkati e riferimenti filtrati non compaiono qui.`,
  );
  lines.push(``);

  function pushLinkSection(title, list, withHints) {
    if (!list.length) return;
    lines.push(`### ${title}`);
    lines.push(``);
    for (const l of list) {
      lines.push(`- ${l.url}`);
      if (l.contexts?.length) {
        lines.push(
          `  - _contesto:_ ${l.contexts.slice(0, 3).join('; ')}${l.contexts.length > 3 ? '…' : ''}`,
        );
      }
      if (withHints) {
        lines.push(`  - _area ruleset (euristica):_ ${hintRulesetArea(l.url)}`);
      }
    }
    lines.push(``);
  }

  if (useDedup) {
    pushLinkSection('Nuovi URL', novel, true);
    if (already.length) {
      lines.push(`### Già visti (nessun nuovo fetch Apify / nessuna ri-analisi automatica)`);
      lines.push(``);
      lines.push(`Lista compatta (${already.length} URL). Dettagli nelle run passate in DB.`);
      lines.push(``);
      for (const l of already) {
        lines.push(`- ${l.url}`);
      }
      lines.push(``);
    }
  } else {
    const linkedin = links.filter((l) => /linkedin\.com/i.test(l.url));
    const other = links.filter((l) => !/linkedin\.com/i.test(l.url));
    pushLinkSection('Web / documentazione', other, true);
    pushLinkSection('LinkedIn (URL in Notion)', linkedin, true);
  }

  if (linkedinEnrichments.length) {
    lines.push(`## LinkedIn — contenuto (Apify, solo URL nuovi in questa run)`);
    lines.push(``);
    lines.push(
      `Testo e link estratti dall’actor (senza commenti). Verifica sempre prima di aggiornare i ruleset.`,
    );
    lines.push(``);
    for (const e of linkedinEnrichments) {
      lines.push(`### ${e.url}`);
      lines.push(``);
      if (e.error) {
        lines.push(`- **Errore Apify / fetch:** ${e.error}`);
        lines.push(``);
        continue;
      }
      if (e.text) {
        lines.push(`**Testo (estratto)**`);
        lines.push(``);
        lines.push(e.text.slice(0, 8000) + (e.text.length > 8000 ? '\n\n…(troncato)' : ''));
        lines.push(``);
      } else {
        lines.push(`_Nessun testo estratto (controlla formato output dell’actor)._`);
        lines.push(``);
      }
      if (e.outboundLinks?.length) {
        lines.push(`**Link nel post**`);
        lines.push(``);
        for (const u of [...new Set(e.outboundLinks)].slice(0, 40)) {
          lines.push(`- ${u}`);
        }
        if (e.outboundLinks.length > 40) lines.push(`- …`);
        lines.push(``);
      }
    }
  }

  lines.push(`## Cosa potrebbe toccare (linguaggio semplice)`);
  lines.push(``);
  lines.push(
    `Le etichette sopra (“area ruleset”) sono **solo suggerimenti automatici**. Prima di modificare documentazione o ruleset:`,
  );
  lines.push(`1. Incrocia con le sezioni reali del repo (es. Accessibility, UX, Escalation, Generate, …).`,
  );
  lines.push(`2. Se un link non mappa a una sezione chiara, **non** forzare un cambiamento ampio.`,
  );
  lines.push(`3. Preferisci aggiunte chiare e retrocompatibili.`);
  lines.push(``);

  lines.push(`## Prossimi passi`);
  lines.push(``);
  lines.push(`1. Revisione umana del Markdown + eventuale copia in PR.`);
  lines.push(`2. Evitare modifiche che peggiorino comportamenti esistenti; preferire PR piccole.`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Risolve pageId/databaseId da parametri + env.
 * @returns {{ pageId: string, databaseId: string }}
 */
export function resolveNotionSourceIds({ pageId: rawPage, databaseId: rawDb }) {
  let pageId = normalizeNotionId(rawPage);
  let databaseId = normalizeNotionId(rawDb);
  if (!pageId && !databaseId) {
    const envPage = process.env.NOTION_PRODUCT_SOURCES_PAGE_ID;
    const envDb = process.env.NOTION_PRODUCT_SOURCES_DATABASE_ID;
    if (envPage) pageId = formatUuid(envPage);
    else if (envDb) databaseId = formatUuid(envDb);
  }
  return { pageId, databaseId };
}

/**
 * @param {{ notionToken: string, pageId?: string, databaseId?: string, ignoreTokens?: string[] }} opts
 */
export async function runNotionProductSourcesExtract(opts) {
  const { notionToken, ignoreTokens = [] } = opts;
  let pageId = opts.pageId || '';
  let databaseId = opts.databaseId || '';
  if (!pageId && !databaseId) {
    const r = resolveNotionSourceIds({});
    pageId = r.pageId;
    databaseId = r.databaseId;
  }

  if (!pageId && !databaseId) {
    throw new Error(
      'Specifica pageId/databaseId o NOTION_PRODUCT_SOURCES_PAGE_ID / NOTION_PRODUCT_SOURCES_DATABASE_ID.',
    );
  }

  const defaultIgnore = ['Antigravity'];
  const ignorePatterns = buildIgnorePatterns([...defaultIgnore, ...ignoreTokens]);

  let result;
  let mode;
  let sourceLabel;

  if (databaseId) {
    mode = 'database';
    sourceLabel = databaseId;
    result = await extractFromDatabase(notionToken, databaseId, ignorePatterns);
  } else {
    mode = 'page';
    sourceLabel = pageId;
    result = await extractFromPage(notionToken, pageId, ignorePatterns);
  }

  const stats = {
    ignoredBlocks: result.ignoredBlocks,
    blockOrPageCount: result.blockCount ?? result.pageCount,
  };

  return {
    mode,
    sourceLabel,
    links: result.links,
    stats,
  };
}
