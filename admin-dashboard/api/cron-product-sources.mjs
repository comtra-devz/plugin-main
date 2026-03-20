/**
 * GET /api/cron-product-sources
 * Cron Vercel (pianificato una volta al giorno): esegue estrazione Notion + Apify LinkedIn solo se l’ultima run OK è ≥ 3 giorni fa.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> oppure ?key=<CRON_SECRET>
 * Opzionale: ?force=1 con stesso secret — ignora il gate 3 giorni (solo test).
 *
 * Env:
 * - CRON_SECRET
 * - NOTION_INTEGRATION_TOKEN (o NOTION_TOKEN)
 * - NOTION_PRODUCT_SOURCES_PAGE_ID o NOTION_PRODUCT_SOURCES_DATABASE_ID
 * - APIFY_TOKEN
 * - APIFY_LINKEDIN_ACTOR_ID (es. da Apify Store: formato username~actor-name)
 * - APIFY_LINKEDIN_INPUT_MODE opzionale: postUrls | urls | startUrls
 * - PRODUCT_SOURCES_MAX_LINKEDIN_PER_RUN opzionale (default 20)
 * - PRODUCT_SOURCES_CRON_WEBHOOK_URL opzionale (Discord webhook: report sintetico)
 * - POSTGRES_URL / DATABASE_URL (per gate 3 giorni + storico report)
 * - PRODUCT_SOURCES_SKIP_LINKEDIN=1 opzionale — salta Apify (utile su Vercel Hobby / test Notion)
 * - APIFY_LINKEDIN_WAIT_SECONDS opzionale — secondi max wait Apify (default 300; serve maxDuration Vercel adeguato)
 */
import { sql } from '../lib/db.mjs';
import { runNotionProductSourcesExtract, buildMarkdownReport } from '../lib/product-sources-notion.mjs';
import { enrichLinkedInPosts } from '../lib/apify-linkedin.mjs';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  try {
    return await handleCronProductSources(req, res);
  } catch (fatal) {
    const msg = fatal instanceof Error ? fatal.message : String(fatal);
    console.error('cron-product-sources fatal', fatal);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: msg || 'Errore interno' });
    }
  }
}

async function handleCronProductSources(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET || '';
  const authHeader = (req.headers.authorization || '').trim();
  const queryKey = (req.query?.key || '').trim();
  const valid =
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` || queryKey === cronSecret);

  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const force = req.query?.force === '1';

  const notionToken = process.env.NOTION_INTEGRATION_TOKEN || process.env.NOTION_TOKEN;
  if (!notionToken) {
    return res.status(500).json({ error: 'NOTION_INTEGRATION_TOKEN mancante' });
  }

  const pageEnv = process.env.NOTION_PRODUCT_SOURCES_PAGE_ID;
  const dbEnv = process.env.NOTION_PRODUCT_SOURCES_DATABASE_ID;
  if (!pageEnv && !dbEnv) {
    return res.status(500).json({
      error: 'Imposta NOTION_PRODUCT_SOURCES_PAGE_ID o NOTION_PRODUCT_SOURCES_DATABASE_ID per il cron.',
    });
  }

  let skipped = false;
  let skipReason = '';

  if (!force && sql) {
    try {
      const prev = await sql`
        SELECT ran_at FROM product_sources_cron_runs
        WHERE status = 'ok' AND skipped = false
        ORDER BY id DESC
        LIMIT 1
      `;
      const row = prev?.rows?.[0];
      if (row?.ran_at) {
        const last = new Date(row.ran_at).getTime();
        if (Number.isFinite(last) && Date.now() - last < THREE_DAYS_MS) {
          skipped = true;
          skipReason = 'last_run_within_3_days';
        }
      }
    } catch (e) {
      if (!/does not exist|relation .*product_sources_cron_runs/i.test(String(e?.message || e))) {
        console.error('cron-product-sources gate', e);
      }
    }
  }

  if (skipped) {
    await recordRun({
      skipped: true,
      status: 'ok',
      linkCount: 0,
      linkedinAttempted: 0,
      linkedinReturned: 0,
      notionMode: null,
      notionSourceId: null,
      errorMessage: null,
      reportMarkdown: null,
    }).catch(() => {});
    return res.status(200).json({ ok: true, skipped: true, reason: skipReason });
  }

  try {
    const { mode, sourceLabel, links, stats } = await runNotionProductSourcesExtract({
      notionToken,
      ignoreTokens: [],
    });

    const linkedinUrls = links.filter((l) => /linkedin\.com/i.test(l.url)).map((l) => l.url);

    const apifyToken = process.env.APIFY_TOKEN || '';
    const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || '';
    const inputMode = process.env.APIFY_LINKEDIN_INPUT_MODE;
    const skipLinkedin =
      process.env.PRODUCT_SOURCES_SKIP_LINKEDIN === '1' ||
      process.env.PRODUCT_SOURCES_SKIP_LINKEDIN === 'true';

    // linkedinEnrichments: { url, text?, outboundLinks?, error? }[]
    let linkedinEnrichments = [];
    if (linkedinUrls.length && apifyToken && actorId && !skipLinkedin) {
      linkedinEnrichments = await enrichLinkedInPosts(apifyToken, actorId, linkedinUrls, {
        inputMode: inputMode || undefined,
      });
    } else if (linkedinUrls.length && skipLinkedin) {
      linkedinEnrichments = linkedinUrls.map((url) => ({
        url,
        error: 'Arricchimento LinkedIn disattivato (PRODUCT_SOURCES_SKIP_LINKEDIN).',
      }));
    } else if (linkedinUrls.length) {
      linkedinEnrichments = linkedinUrls.map((url) => ({
        url,
        error: !apifyToken
          ? 'APIFY_TOKEN non configurato'
          : 'APIFY_LINKEDIN_ACTOR_ID non configurato',
      }));
    }

    const markdown = buildMarkdownReport({
      links,
      sourceLabel,
      mode,
      stats,
      linkedinEnrichments,
    });

    await recordRun({
      skipped: false,
      status: 'ok',
      linkCount: links.length,
      linkedinAttempted: linkedinUrls.length,
      linkedinReturned: linkedinEnrichments.filter((e) => e.text || (e.outboundLinks?.length ?? 0)).length,
      notionMode: mode,
      notionSourceId: sourceLabel,
      errorMessage: null,
      reportMarkdown: markdown,
    }).catch((e) => console.error('recordRun', e));

    await sendDiscordSummary({
      linkCount: links.length,
      linkedinCount: linkedinUrls.length,
      mode,
      sourceId: sourceLabel,
      markdown,
    }).catch((e) => console.error('discord product sources', e));

    return res.status(200).json({
      ok: true,
      skipped: false,
      linkCount: links.length,
      linkedinUrls: linkedinUrls.length,
      linkedinEnriched: linkedinEnrichments.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('cron-product-sources', err);
    await recordRun({
      skipped: false,
      status: 'error',
      linkCount: 0,
      linkedinAttempted: 0,
      linkedinReturned: 0,
      notionMode: null,
      notionSourceId: null,
      errorMessage: msg.slice(0, 2000),
      reportMarkdown: null,
    }).catch(() => {});
    return res.status(500).json({ ok: false, error: msg });
  }
}

async function recordRun(row) {
  if (!sql) return;
  await sql`
    INSERT INTO product_sources_cron_runs (
      status, skipped, link_count, linkedin_urls_attempted, linkedin_items_returned,
      notion_mode, notion_source_id, error_message, report_markdown
    ) VALUES (
      ${row.status},
      ${row.skipped},
      ${row.linkCount},
      ${row.linkedinAttempted},
      ${row.linkedinReturned},
      ${row.notionMode},
      ${row.notionSourceId},
      ${row.errorMessage},
      ${row.reportMarkdown}
    )
  `;
}

async function sendDiscordSummary({ linkCount, linkedinCount, mode, sourceId, markdown }) {
  const url =
    process.env.PRODUCT_SOURCES_CRON_WEBHOOK_URL ||
    process.env.DISCORD_PRODUCT_SOURCES_WEBHOOK_URL ||
    '';
  const isDiscordWebhook =
    /^https:\/\/discord\.com\/api\/webhooks\//i.test(url) ||
    /^https:\/\/discordapp\.com\/api\/webhooks\//i.test(url);
  if (!url || !isDiscordWebhook) return;

  // Limite Discord: descrizione embed ~4096; evitiamo field >1024 char.
  const maxDesc = 3800;
  const head =
    `**Link totali:** ${linkCount}\n**LinkedIn in elenco:** ${linkedinCount}\n` +
    `**Modalità Notion:** ${mode}\n**ID sorgente:** \`${sourceId}\`\n\n` +
    `Report completo in DB: \`product_sources_cron_runs.report_markdown\`.\n\n\`\`\`md\n`;
  const tail = '\n```';
  const room = maxDesc - head.length - tail.length;
  const preview = room > 200 ? markdown.slice(0, room) + (markdown.length > room ? '\n…(troncato)' : '') : '';

  const body = {
    username: 'Comtra — Fonti prodotto',
    embeds: [
      {
        title: 'Cron Notion + LinkedIn (Apify)',
        description: `${head}${preview}${tail}`,
        color: 0xffc900,
      },
    ],
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Discord ${r.status}: ${t}`);
  }
}
