/**
 * GET /api/cron-product-sources
 * Cron Vercel (pianificato una volta al giorno): esegue estrazione Notion + Apify LinkedIn solo se l’ultima run OK (non skipped) è ≥ N giorni fa.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> oppure ?key=<CRON_SECRET>
 * Opzionale: ?force=1 con stesso secret — ignora il gate temporale (solo test).
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
 * - POSTGRES_URL / DATABASE_URL (per gate temporale + storico report + dedup URL)
 * - PRODUCT_SOURCES_CRON_GATE_DAYS opzionale (default **3**) — giorni minimi tra due run **complete** (non skipped); es. `4` per allineo a “ogni 4 giorni”
 * - PRODUCT_SOURCES_SKIP_LINKEDIN=1 opzionale — salta Apify (utile su Vercel Hobby / test Notion)
 * - PRODUCT_SOURCES_LINKEDIN_REFETCH_ALL=1 opzionale — ad ogni run completa (~3 gg) Apify su **tutti** i LinkedIn in Notion (fino a PRODUCT_SOURCES_MAX_LINKEDIN_PER_RUN), non solo URL nuovi nel dedup
 * - APIFY_LINKEDIN_WAIT_SECONDS opzionale — secondi max wait Apify (default 300; serve maxDuration Vercel adeguato)
 * - PRODUCT_SOURCES_DISCORD_SUMMARY_ONLY=1 opzionale — Discord solo riepilogo (no report spezzato in più messaggi)
 * - PRODUCT_SOURCES_FETCH_WEB=1 opzionale — Fase 1+2: fetch / strategia per tipo su URL **nuovi** non-LinkedIn (allow/block list, GitHub raw, stub YouTube/X, PDF rilevato)
 * - PRODUCT_SOURCES_QUEUE_MODE=1 opzionale — Fase 3: coda job in Postgres; più hit cron (bypass gate se c’è batch con job pending). Vedi PRODUCT_SOURCES_QUEUE_MAX_JOBS, QUEUE_LINKEDIN_CHUNK.
 * - Fase 4 snapshot doc: `PRODUCT_SOURCES_DOC_FETCH_URLS` (raw URL) e/o `PRODUCT_SOURCES_DOC_REPO_ROOT` (path repo sul runner). Disabilita: `PRODUCT_SOURCES_PLUGIN_DOC_SNAPSHOT_DISABLE=1`.
 * - Fase 5 LLM: `PRODUCT_SOURCES_LLM_SYNTHESIS=1`, `PRODUCT_SOURCES_LLM_PROVIDER` (moonshot|openai|custom|**gemini**), key/model — vedi `lib/product-sources-llm.mjs`. **Gemini free tier:** `PROVIDER=gemini` + `GEMINI_API_KEY`; se quota esaurita, messaggio nel report e retry alla prossima run. **Senza API sul deploy:** `PRODUCT_SOURCES_LLM_EXECUTION=mcp` + MCP locale.
 * - Fase 6: `PRODUCT_SOURCES_SKIP_HEAVY_IF_NO_NEW_URLS` (default on: salta Apify/web se nessun URL nuovo e nessun batch; disattiva con `0`); `PRODUCT_SOURCES_SNAPSHOT_ON_NO_NEW=1` forza snapshot anche senza URL nuovi.
 */
import { sql } from '../lib/db.mjs';
import { runNotionProductSourcesExtract, buildMarkdownReport } from '../lib/product-sources-notion.mjs';
import { enrichLinkedInPosts } from '../lib/apify-linkedin.mjs';
import { isWebFetchCandidateUrl } from '../lib/fetch-generic-web.mjs';
import {
  fetchProductSourcesSequential,
  fetchProductSourceContent,
  getWebFetchLimitsFromEnv,
} from '../lib/product-source-fetch-strategy.mjs';
import {
  loadSeenUrlKeys,
  partitionLinksBySeen,
  upsertSeenUrls,
  normalizeUrlKey,
} from '../lib/product-sources-seen.mjs';
import {
  isQueueModeEnabled,
  findActiveBatchWithPendingJobs,
  createBatchWithJobs,
  chunkArray,
  getQueueMaxJobsPerInvocation,
  getLinkedInChunkSizeForQueue,
  resetStaleRunningJobs,
  claimPendingJobs,
  completeJob,
  touchBatch,
  countPendingJobs,
  aggregateJobResults,
  markBatchDone,
  markBatchFailed,
} from '../lib/product-sources-queue.mjs';
import { buildPluginDocSnapshot } from '../lib/plugin-doc-snapshot.mjs';
import { synthesizeProductImprovementsMarkdown } from '../lib/product-sources-llm.mjs';
import {
  shouldSkipHeavyWorkloadCron,
  shouldOmitDocSnapshotOnPhase6Skip,
} from '../lib/product-sources-phase6.mjs';

/** Snapshot omesso in run Fase 6 (nessun URL nuovo / nessun lavoro pesante). */
function phase6SkippedSnapshotStub() {
  return {
    text: '',
    sources: [],
    truncated: false,
    skipped: true,
    skipReason: 'phase6_no_new_urls',
  };
}

/**
 * @param {boolean} phase6SkipHeavy
 */
async function buildProductSourcesDocSnapshotForCron(phase6SkipHeavy) {
  if (phase6SkipHeavy && shouldOmitDocSnapshotOnPhase6Skip()) {
    return phase6SkippedSnapshotStub();
  }
  return buildPluginDocSnapshot();
}

function getCronGateMs() {
  const raw = process.env.PRODUCT_SOURCES_CRON_GATE_DAYS;
  const n = raw != null && String(raw).trim() !== '' ? Number(raw) : 3;
  const days = Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 3;
  return days * 24 * 60 * 60 * 1000;
}

function parseJobPayload(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

/**
 * @param {Array<{ id: number, job_type: string, payload_json: unknown }>} claimed
 * @param {object} context
 */
async function executeClaimedQueueJobs(claimed, context) {
  const webLimits = getWebFetchLimitsFromEnv();
  const fetchOpts = { timeoutMs: webLimits.timeoutMs, maxTextChars: webLimits.maxTextChars };
  const apifyToken = process.env.APIFY_TOKEN || '';
  const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || '';
  const inputMode = process.env.APIFY_LINKEDIN_INPUT_MODE;
  const skipLinkedin = !!context.skipLinkedin;

  for (const job of claimed) {
    const payload = parseJobPayload(job.payload_json);
    try {
      if (job.job_type === 'web') {
        const url = payload.url;
        const one = await fetchProductSourceContent(url, fetchOpts);
        await completeJob(job.id, 'done', { url: one.url || url, ...one }, null);
      } else if (job.job_type === 'linkedin_apify') {
        const urls = Array.isArray(payload.urls) ? payload.urls : [];
        if (skipLinkedin || !apifyToken || !actorId) {
          const enrichments = urls.map((url) => ({
            url,
            error: skipLinkedin
              ? 'Arricchimento LinkedIn disattivato (PRODUCT_SOURCES_SKIP_LINKEDIN).'
              : !apifyToken
                ? 'APIFY_TOKEN non configurato'
                : 'APIFY_LINKEDIN_ACTOR_ID non configurato',
          }));
          await completeJob(job.id, 'done', { enrichments }, null);
        } else {
          const enrichments = await enrichLinkedInPosts(apifyToken, actorId, urls, {
            inputMode: inputMode || undefined,
          });
          await completeJob(job.id, 'done', { enrichments }, null);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (job.job_type === 'linkedin_apify') {
        const urls = Array.isArray(payload.urls) ? payload.urls : [];
        await completeJob(
          job.id,
          'done',
          { enrichments: urls.map((url) => ({ url, error: msg })) },
          null,
        );
      } else {
        await completeJob(job.id, 'error', null, msg);
      }
    }
  }
}

/**
 * Un solo “chunk” di job; se la coda è vuota finalizza (MD, DB run, Discord, seen).
 * @param {{ id: number, context_json: object }} batchMeta
 */
async function processSingleQueueChunkAndFinalizeIfDone(batchMeta) {
  const batchId = batchMeta.id;
  const context =
    batchMeta.context_json && typeof batchMeta.context_json === 'object'
      ? batchMeta.context_json
      : JSON.parse(String(batchMeta.context_json || '{}'));

  await resetStaleRunningJobs(batchId);
  const claimed = await claimPendingJobs(batchId, getQueueMaxJobsPerInvocation());
  await executeClaimedQueueJobs(claimed, context);
  await touchBatch(batchId);

  const pending = await countPendingJobs(batchId);
  if (pending > 0) {
    return {
      ok: true,
      queue: true,
      batchId,
      chunkProcessed: claimed.length,
      pendingJobs: pending,
      finalized: false,
    };
  }

  const agg = await aggregateJobResults(batchId);
  const linkedinEnrichments = agg.linkedinEnrichments;
  const webEnrichments = agg.webEnrichments;

  const phase6SkipHeavy = context.phase6SkipHeavy === true;
  const pluginDocSnapshot = await buildProductSourcesDocSnapshotForCron(phase6SkipHeavy);
  const llmSynthesisSection = await synthesizeProductImprovementsMarkdown({
    mode: context.mode,
    sourceLabel: context.sourceLabel,
    newLinks: context.newLinks,
    seenLinks: context.seenLinks,
    linkedinEnrichments,
    webEnrichments,
    pluginDocSnapshot,
  });

  const markdown = buildMarkdownReport({
    links: context.links,
    newLinks: context.newLinks,
    seenLinks: context.seenLinks,
    sourceLabel: context.sourceLabel,
    mode: context.mode,
    stats: context.stats,
    linkedinEnrichments,
    linkedinApifyMode: context.linkedinApifyMode || 'new_only',
    webEnrichments,
    pluginDocSnapshot,
    llmSynthesisSection,
    phase6SkipHeavy,
  });

  const runId = await recordRun({
    skipped: false,
    status: 'ok',
    linkCount: context.links?.length ?? 0,
    linkedinAttempted: linkedinEnrichments.length,
    linkedinReturned: linkedinEnrichments.filter((e) => e.text || (e.outboundLinks?.length ?? 0)).length,
    notionMode: context.mode,
    notionSourceId: context.sourceLabel,
    errorMessage: null,
    reportMarkdown: markdown,
  });

  await upsertSeenUrls(context.links || []).catch((e) => console.error('upsertSeenUrls', e));

  const discordSummaryOnly = process.env.PRODUCT_SOURCES_DISCORD_SUMMARY_ONLY === '1';
  let discordOk = false;
  try {
    discordOk = await sendDiscordProductSources({
      linkCount: context.links?.length ?? 0,
      newLinkCount: context.newLinks?.length ?? 0,
      seenLinkCount: context.seenLinks?.length ?? 0,
      linkedinDedupNew: context.linkedinDedupNew ?? 0,
      linkedinDedupSeen: context.linkedinDedupSeen ?? 0,
      linkedinApifyBatch: linkedinEnrichments.length,
      linkedinLinkedInTotal: context.linkedinLinkedInTotal ?? 0,
      refetchAllLinkedIn: !!context.refetchAllLinkedIn,
      linkedinEnriched: linkedinEnrichments.filter((e) => e.text || (e.outboundLinks?.length ?? 0)).length,
      webFetchBatch: webEnrichments.length,
      webFetchOk: webEnrichments.filter((w) => w.text && !w.error).length,
      mode: context.mode,
      sourceId: context.sourceLabel,
      markdown,
      summaryOnly: discordSummaryOnly,
    });
  } catch (e) {
    console.error('discord product sources (queue)', e);
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
        console.error('cron-product-sources discord_notified queue', e);
      }
    }
  }

  await markBatchDone(batchId, runId);

  return {
    ok: true,
    queue: true,
    batchId,
    finalized: true,
    runId,
    linkCount: context.links?.length ?? 0,
    newLinkCount: context.newLinks?.length ?? 0,
    linkedinApifyBatch: linkedinEnrichments.length,
    webFetchBatch: webEnrichments.length,
    queuePhase3: true,
  };
}

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

  /** Fase 3: batch con job pending → elabora un chunk (nessun gate, niente Notion in questo hit). */
  if (isQueueModeEnabled()) {
    try {
      const active = await findActiveBatchWithPendingJobs();
      if (active) {
        try {
          const out = await processSingleQueueChunkAndFinalizeIfDone(active);
          return res.status(200).json(out);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('cron-product-sources queue chunk', e);
          await markBatchFailed(active.id, msg);
          return res.status(500).json({ ok: false, error: msg, batchId: active.id });
        }
      }
    } catch (e) {
      console.error('cron-product-sources queue lookup', e);
    }
  }

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
  const gateMs = getCronGateMs();

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
        if (Number.isFinite(last) && Date.now() - last < gateMs) {
          skipped = true;
          skipReason = 'last_run_within_gate';
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

    const refetchAllLinkedIn =
      process.env.PRODUCT_SOURCES_LINKEDIN_REFETCH_ALL === '1' ||
      process.env.PRODUCT_SOURCES_LINKEDIN_REFETCH_ALL === 'true';

    /** LinkedIn unici in Notion (stessa run), ordine stabile */
    const linkedinUrlsAll = [];
    const liKeyOrder = new Set();
    for (const l of links) {
      if (!/linkedin\.com/i.test(l.url)) continue;
      const k = normalizeUrlKey(l.url);
      if (liKeyOrder.has(k)) continue;
      liKeyOrder.add(k);
      linkedinUrlsAll.push(l.url);
    }

    const linkedinUrlsForApify = refetchAllLinkedIn ? linkedinUrlsAll : linkedinUrlsNew;

    const linkedinApifyMode = refetchAllLinkedIn ? 'refetch_all' : 'new_only';
    const skipLinkedin =
      process.env.PRODUCT_SOURCES_SKIP_LINKEDIN === '1' ||
      process.env.PRODUCT_SOURCES_SKIP_LINKEDIN === 'true';

    const fetchWebEnabled =
      process.env.PRODUCT_SOURCES_FETCH_WEB === '1' ||
      process.env.PRODUCT_SOURCES_FETCH_WEB === 'true';
    const webLimits = getWebFetchLimitsFromEnv();

    const webUrlsUnique = [];
    if (newLinks.length) {
      const webKeys = new Set();
      for (const l of newLinks) {
        if (!isWebFetchCandidateUrl(l.url)) continue;
        const k = normalizeUrlKey(l.url);
        if (webKeys.has(k)) continue;
        webKeys.add(k);
        webUrlsUnique.push(l.url);
      }
    }

    const skipHeavy = shouldSkipHeavyWorkloadCron({
      newLinks,
      linkedinUrlsForApify,
      fetchWebEnabled,
      webUrlsUnique,
    });

    const context = {
      links,
      newLinks,
      seenLinks,
      stats,
      mode,
      sourceLabel,
      linkedinApifyMode,
      fetchWebEnabled,
      skipLinkedin,
      refetchAllLinkedIn,
      linkedinDedupNew: linkedinUrlsNew.length,
      linkedinDedupSeen: linkedinSeenCount,
      linkedinLinkedInTotal: linkedinUrlsAll.length,
      phase6SkipHeavy: skipHeavy,
    };

    const linkedinChunks = linkedinUrlsForApify.length
      ? chunkArray(linkedinUrlsForApify, getLinkedInChunkSizeForQueue())
      : [];
    const webUrlsForQueue = fetchWebEnabled && webLimits.max > 0 ? webUrlsUnique : [];

    if (isQueueModeEnabled()) {
      const batchId = await createBatchWithJobs(context, linkedinChunks, webUrlsForQueue);
      if (batchId != null) {
        try {
          const out = await processSingleQueueChunkAndFinalizeIfDone({ id: batchId, context_json: context });
          return res.status(200).json(out);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await markBatchFailed(batchId, msg);
          throw e;
        }
      }
    }

    const apifyToken = process.env.APIFY_TOKEN || '';
    const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || '';
    const inputMode = process.env.APIFY_LINKEDIN_INPUT_MODE;

    // Apify: default solo URL LinkedIn **nuovi** nel dedup; con REFETCH_ALL tutti (fino al cap in enrichLinkedInPosts)
    let linkedinEnrichments = [];
    if (linkedinUrlsForApify.length && apifyToken && actorId && !skipLinkedin) {
      linkedinEnrichments = await enrichLinkedInPosts(apifyToken, actorId, linkedinUrlsForApify, {
        inputMode: inputMode || undefined,
      });
    } else if (linkedinUrlsForApify.length && skipLinkedin) {
      linkedinEnrichments = linkedinUrlsForApify.map((url) => ({
        url,
        error: 'Arricchimento LinkedIn disattivato (PRODUCT_SOURCES_SKIP_LINKEDIN).',
      }));
    } else if (linkedinUrlsForApify.length) {
      linkedinEnrichments = linkedinUrlsForApify.map((url) => ({
        url,
        error: !apifyToken
          ? 'APIFY_TOKEN non configurato'
          : 'APIFY_LINKEDIN_ACTOR_ID non configurato',
      }));
    }

    /** @type {Array<{ url: string, text?: string, error?: string, contentType?: string, kind?: string, strategyNote?: string }>} */
    let webEnrichments = [];
    if (fetchWebEnabled && webLimits.max > 0 && webUrlsUnique.length) {
      webEnrichments = await fetchProductSourcesSequential(webUrlsUnique, {
        max: webLimits.max,
        fetchOpts: { timeoutMs: webLimits.timeoutMs, maxTextChars: webLimits.maxTextChars },
      });
    }

    const phase6SkipHeavy = skipHeavy;
    const pluginDocSnapshot = await buildProductSourcesDocSnapshotForCron(phase6SkipHeavy);
    const llmSynthesisSection = await synthesizeProductImprovementsMarkdown({
      mode,
      sourceLabel,
      newLinks,
      seenLinks,
      linkedinEnrichments,
      webEnrichments,
      pluginDocSnapshot,
    });

    const markdown = buildMarkdownReport({
      links,
      newLinks,
      seenLinks,
      sourceLabel,
      mode,
      stats,
      linkedinEnrichments,
      linkedinApifyMode,
      webEnrichments,
      pluginDocSnapshot,
      llmSynthesisSection,
      phase6SkipHeavy,
    });

    const runId = await recordRun({
      skipped: false,
      status: 'ok',
      linkCount: links.length,
      linkedinAttempted: linkedinEnrichments.length,
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
        linkedinDedupNew: linkedinUrlsNew.length,
        linkedinDedupSeen: linkedinSeenCount,
        linkedinApifyBatch: linkedinEnrichments.length,
        linkedinLinkedInTotal: linkedinUrlsAll.length,
        refetchAllLinkedIn,
        linkedinEnriched: linkedinEnrichments.filter((e) => e.text || (e.outboundLinks?.length ?? 0)).length,
        webFetchBatch: webEnrichments.length,
        webFetchOk: webEnrichments.filter((w) => w.text && !w.error).length,
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
      linkedinApifyMode: linkedinApifyMode,
      linkedinApifyBatch: linkedinEnrichments.length,
      linkedinLinkedInTotal: linkedinUrlsAll.length,
      linkedinEnriched: linkedinEnrichments.filter((e) => e.text || (e.outboundLinks?.length ?? 0)).length,
      webFetchEnabled: fetchWebEnabled,
      webFetchBatch: webEnrichments.length,
      webFetchWithText: webEnrichments.filter((w) => w.text && !w.error).length,
      phase6SkipHeavy,
      llmSynthesisChars: llmSynthesisSection.length,
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
  linkedinDedupNew,
  linkedinDedupSeen,
  linkedinApifyBatch,
  linkedinLinkedInTotal,
  refetchAllLinkedIn,
  linkedinEnriched,
  webFetchBatch,
  webFetchOk,
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

  const liLine = refetchAllLinkedIn
    ? `**LinkedIn in Notion (unici):** ${linkedinLinkedInTotal} · **Apify — URL nel batch questa run (rispetta cap max/run):** ${linkedinApifyBatch}\n` +
      `**Dedup DB — LinkedIn nuovi:** ${linkedinDedupNew} · **già in seen:** ${linkedinDedupSeen} _(Apify rieseguito anche su già noti, fino al cap)_\n`
    : `**LinkedIn → batch Apify (questa run, max N/run):** ${linkedinApifyBatch} · **LinkedIn già noti (skip Apify):** ${linkedinDedupSeen}\n`;

  const summary =
    `**Link totali (Notion):** ${linkCount}\n` +
    `**Nuovi URL:** ${newLinkCount} · **Già visti:** ${seenLinkCount}\n` +
    liLine +
    `**LinkedIn con contenuto utile (batch):** ${linkedinEnriched}\n` +
    `**Web — fetch HTTP (Fase 1):** ${webFetchBatch} URL in batch · **con testo estratto:** ${webFetchOk}\n` +
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
