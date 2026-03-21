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
 * - POSTGRES_URL / DATABASE_URL (per gate 3 giorni + storico report + dedup URL)
 * - PRODUCT_SOURCES_SKIP_LINKEDIN=1 opzionale — salta Apify (utile su Vercel Hobby / test Notion)
 * - APIFY_LINKEDIN_WAIT_SECONDS opzionale — secondi max wait Apify (default 300; serve maxDuration Vercel adeguato)
 * - PRODUCT_SOURCES_DISCORD_SUMMARY_ONLY=1 opzionale — Discord solo riepilogo (no report spezzato in più messaggi)
 */
import { sql } from '../lib/db.mjs';
import { runNotionProductSourcesExtract, buildMarkdownReport } from '../lib/product-sources-notion.mjs';
import { enrichLinkedInPosts } from '../lib/apify-linkedin.mjs';
import { loadSeenUrlKeys, partitionLinksBySeen, upsertSeenUrls } from '../lib/product-sources-seen.mjs';

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

    const seenKeys = await loadSeenUrlKeys();
    const { newLinks, seenLinks } = partitionLinksBySeen(links, seenKeys);

    const linkedinUrlsNew = newLinks.filter((l) => /linkedin\.com/i.test(l.url)).map((l) => l.url);
    const linkedinSeenCount = seenLinks.filter((l) => /linkedin\.com/i.test(l.url)).length;

    const apifyToken = process.env.APIFY_TOKEN || '';
    const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || '';
    const inputMode = process.env.APIFY_LINKEDIN_INPUT_MODE;
    const skipLinkedin =
      process.env.PRODUCT_SOURCES_SKIP_LINKEDIN === '1' ||
      process.env.PRODUCT_SOURCES_SKIP_LINKEDIN === 'true';

    // Apify solo su URL LinkedIn **nuovi** (mai registrati in product_sources_seen_urls)
    let linkedinEnrichments = [];
    if (linkedinUrlsNew.length && apifyToken && actorId && !skipLinkedin) {
      linkedinEnrichments = await enrichLinkedInPosts(apifyToken, actorId, linkedinUrlsNew, {
        inputMode: inputMode || undefined,
      });
    } else if (linkedinUrlsNew.length && skipLinkedin) {
      linkedinEnrichments = linkedinUrlsNew.map((url) => ({
        url,
        error: 'Arricchimento LinkedIn disattivato (PRODUCT_SOURCES_SKIP_LINKEDIN).',
      }));
    } else if (linkedinUrlsNew.length) {
      linkedinEnrichments = linkedinUrlsNew.map((url) => ({
        url,
        error: !apifyToken
          ? 'APIFY_TOKEN non configurato'
          : 'APIFY_LINKEDIN_ACTOR_ID non configurato',
      }));
    }

    const markdown = buildMarkdownReport({
      links,
      newLinks,
      seenLinks,
      sourceLabel,
      mode,
      stats,
      linkedinEnrichments,
    });

    const runId = await recordRun({
      skipped: false,
      status: 'ok',
      linkCount: links.length,
      linkedinAttempted: linkedinUrlsNew.length,
      linkedinReturned: linkedinEnrichments.filter((e) => e.text || (e.outboundLinks?.length ?? 0)).length,
      notionMode: mode,
      notionSourceId: sourceLabel,
      errorMessage: null,
      reportMarkdown: markdown,
    });

    await upsertSeenUrls(links).catch((e) => console.error('upsertSeenUrls', e));

    const discordSummaryOnly = process.env.PRODUCT_SOURCES_DISCORD_SUMMARY_ONLY === '1';
    let discordOk = false;
    try {
      discordOk = await sendDiscordProductSources({
        linkCount: links.length,
        newLinkCount: newLinks.length,
        seenLinkCount: seenLinks.length,
        linkedinNew: linkedinUrlsNew.length,
        linkedinSeen: linkedinSeenCount,
        linkedinEnriched: linkedinEnrichments.filter((e) => e.text || (e.outboundLinks?.length ?? 0)).length,
        mode,
        sourceId: sourceLabel,
        markdown,
        summaryOnly: discordSummaryOnly,
      });
    } catch (e) {
      console.error('discord product sources', e);
    }

    if (runId != null && discordOk && sql) {
      try {
        await sql`
          UPDATE product_sources_cron_runs
          SET discord_notified = true
          WHERE id = ${runId}
        `;
      } catch (e) {
        if (!/discord_notified|column/i.test(String(e?.message || e))) {
          console.error('cron-product-sources discord_notified', e);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      skipped: false,
      linkCount: links.length,
      newLinkCount: newLinks.length,
      seenLinkCount: seenLinks.length,
      linkedinUrlsNew: linkedinUrlsNew.length,
      linkedinUrlsSeenSkipped: linkedinSeenCount,
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

/** @returns {Promise<number|string|null>} id riga inserita, o null */
async function recordRun(row) {
  if (!sql) return null;
  const result = await sql`
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
    RETURNING id
  `;
  const id = result.rows?.[0]?.id;
  return id != null ? id : null;
}

/** Spezza testo per embed Discord (descrizione max ~4096, incluso fence md). */
function chunkMarkdownForDiscord(markdown, maxInner = 3900) {
  const t = String(markdown || '');
  if (!t) return [];
  const chunks = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + maxInner, t.length);
    let cut = end;
    if (end < t.length) {
      const nl = t.lastIndexOf('\n', end);
      if (nl > i + maxInner * 0.45) cut = nl;
    }
    chunks.push(t.slice(i, cut));
    i = cut;
    while (i < t.length && t[i] === '\n') i++;
  }
  return chunks;
}

async function postDiscordWebhook(webhookUrl, payload) {
  const r = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Discord ${r.status}: ${text}`);
  }
}

/**
 * 1) Embed riepilogo. 2) Report in più messaggi (max 10 embed ciascuno) se non summaryOnly.
 */
async function sendDiscordProductSources({
  linkCount,
  newLinkCount,
  seenLinkCount,
  linkedinNew,
  linkedinSeen,
  linkedinEnriched,
  mode,
  sourceId,
  markdown,
  summaryOnly,
}) {
  const url =
    process.env.PRODUCT_SOURCES_CRON_WEBHOOK_URL ||
    process.env.DISCORD_PRODUCT_SOURCES_WEBHOOK_URL ||
    '';
  const isDiscordWebhook =
    /^https:\/\/discord\.com\/api\/webhooks\//i.test(url) ||
    /^https:\/\/discordapp\.com\/api\/webhooks\//i.test(url);
  if (!url || !isDiscordWebhook) return false;

  const summary =
    `**Link totali (Notion):** ${linkCount}\n` +
    `**Nuovi URL:** ${newLinkCount} · **Già visti:** ${seenLinkCount}\n` +
    `**LinkedIn nuovi (Apify questa run):** ${linkedinNew} · **LinkedIn già noti (skip Apify):** ${linkedinSeen}\n` +
    `**LinkedIn con contenuto utile:** ${linkedinEnriched}\n` +
    `**Modalità Notion:** ${mode}\n` +
    `**Sorgente:** \`${sourceId}\`\n\n` +
    `Report completo anche in DB: \`product_sources_cron_runs.report_markdown\`.` +
    (summaryOnly ? '\n\n_(Report Markdown non allegato: PRODUCT_SOURCES_DISCORD_SUMMARY_ONLY)_' : '');

  await postDiscordWebhook(url, {
    username: 'Comtra — Fonti prodotto',
    embeds: [
      {
        title: 'Fonti prodotto — riepilogo cron',
        description: summary.slice(0, 4096),
        color: 0xffc900,
      },
    ],
  });

  if (summaryOnly || !markdown?.trim()) return true;

  const innerMax = 3850;
  const chunks = chunkMarkdownForDiscord(markdown, innerMax);
  const MAX_EMBEDS = 10;
  const fence = (c) => `\`\`\`md\n${c}\n\`\`\``;

  for (let i = 0; i < chunks.length; i += MAX_EMBEDS) {
    const slice = chunks.slice(i, i + MAX_EMBEDS);
    const embeds = slice.map((chunk, j) => {
      const n = i + j + 1;
      const desc = fence(chunk);
      return {
        title: `Report Markdown ${n}/${chunks.length}`,
        description: desc.length <= 4096 ? desc : desc.slice(0, 4093) + '…',
        color: 0xffc900,
      };
    });
    await postDiscordWebhook(url, {
      username: 'Comtra — Fonti prodotto',
      embeds,
    });
  }
  return true;
}
