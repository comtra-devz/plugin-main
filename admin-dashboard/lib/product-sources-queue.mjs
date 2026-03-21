/**
 * Fase 3 — Coda Postgres: più invocazioni cron consumano job (web + chunk LinkedIn Apify).
 */
import { sql } from './db.mjs';
import { sqlRaw } from './db.mjs';

export function isQueueModeEnabled() {
  return (
    (process.env.PRODUCT_SOURCES_QUEUE_MODE === '1' ||
      process.env.PRODUCT_SOURCES_QUEUE_MODE === 'true') &&
    !!sql &&
    !!sqlRaw
  );
}

export function getQueueMaxJobsPerInvocation() {
  return Math.min(
    80,
    Math.max(1, Number(process.env.PRODUCT_SOURCES_QUEUE_MAX_JOBS || 15) || 15),
  );
}

/** Dimensione ogni job LinkedIn (URL per singola chiamata Apify). */
export function getLinkedInChunkSizeForQueue() {
  return Math.min(
    50,
    Math.max(1, Number(process.env.PRODUCT_SOURCES_QUEUE_LINKEDIN_CHUNK || 10) || 10),
  );
}

/**
 * @param {string[]} urls
 * @param {number} chunkSize
 * @returns {string[][]}
 */
export function chunkArray(urls, chunkSize) {
  const out = [];
  for (let i = 0; i < urls.length; i += chunkSize) {
    out.push(urls.slice(i, i + chunkSize));
  }
  return out;
}

export async function findActiveBatchWithPendingJobs() {
  if (!sql) return null;
  try {
    const r = await sql`
      SELECT b.id, b.created_at, b.updated_at, b.status, b.total_jobs, b.completed_jobs, b.context_json
      FROM product_sources_queue_batches b
      WHERE b.status = 'pending_work'
      AND EXISTS (
        SELECT 1 FROM product_sources_queue_jobs j
        WHERE j.batch_id = b.id AND j.status = 'pending'
      )
      ORDER BY b.id ASC
      LIMIT 1
    `;
    return r.rows?.[0] || null;
  } catch (e) {
    if (/does not exist|relation .*product_sources_queue/i.test(String(e?.message || e))) {
      return null;
    }
    throw e;
  }
}

/**
 * Riprendi job lasciati `running` (crash timeout precedente).
 */
export async function resetStaleRunningJobs(batchId) {
  if (!sqlRaw) return;
  await sqlRaw`
    UPDATE product_sources_queue_jobs
    SET status = 'pending'
    WHERE batch_id = ${batchId} AND status = 'running'
  `;
}

/**
 * @param {number} batchId
 * @param {number} limit
 * @returns {Promise<Array<{ id: number, job_type: string, payload_json: object, sort_order: number }>>}
 */
export async function claimPendingJobs(batchId, limit) {
  if (!sqlRaw) return [];
  return sqlRaw.begin(async (tx) => {
    const rows = await tx`
      UPDATE product_sources_queue_jobs j
      SET status = 'running'
      FROM (
        SELECT id FROM product_sources_queue_jobs
        WHERE batch_id = ${batchId} AND status = 'pending'
        ORDER BY sort_order, id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) sub
      WHERE j.id = sub.id
      RETURNING j.id, j.job_type, j.payload_json, j.sort_order
    `;
    return Array.isArray(rows) ? rows : [];
  });
}

/**
 * @param {number} jobId
 * @param {'done'|'error'} status
 * @param {object|null} resultJson
 * @param {string|null} errorMessage
 */
export async function completeJob(jobId, status, resultJson, errorMessage) {
  if (!sqlRaw) return;
  await sqlRaw`
    UPDATE product_sources_queue_jobs
    SET status = ${status},
        result_json = ${resultJson != null ? sqlRaw.json(resultJson) : null},
        error_message = ${errorMessage},
        processed_at = NOW()
    WHERE id = ${jobId}
  `;
}

export async function touchBatch(batchId) {
  if (!sqlRaw) return;
  await sqlRaw`
    UPDATE product_sources_queue_batches
    SET updated_at = NOW(),
        completed_jobs = (
          SELECT COUNT(*)::int FROM product_sources_queue_jobs
          WHERE batch_id = ${batchId} AND status IN ('done', 'error')
        )
    WHERE id = ${batchId}
  `;
}

export async function countPendingJobs(batchId) {
  if (!sql) return 0;
  const r = await sql`
    SELECT COUNT(*)::int AS c FROM product_sources_queue_jobs
    WHERE batch_id = ${batchId} AND status = 'pending'
  `;
  return r.rows?.[0]?.c ?? 0;
}

/**
 * @param {object} context — serializzabile (links, newLinks, seenLinks, stats, mode, sourceLabel, flags…)
 * @param {string[][]} linkedinChunks
 * @param {string[]} webUrls
 * @returns {Promise<number|null>} batch id o null se zero job
 */
export async function createBatchWithJobs(context, linkedinChunks, webUrls) {
  if (!sqlRaw) return null;

  const jobs = [];
  let order = 0;
  for (const urls of linkedinChunks) {
    if (!urls?.length) continue;
    jobs.push({
      job_type: 'linkedin_apify',
      sort_order: order++,
      payload_json: { urls },
    });
  }
  for (const url of webUrls) {
    jobs.push({
      job_type: 'web',
      sort_order: order++,
      payload_json: { url },
    });
  }

  if (!jobs.length) return null;

  const inserted = await sqlRaw`
    INSERT INTO product_sources_queue_batches (status, context_json, total_jobs, completed_jobs)
    VALUES (
      'pending_work',
      ${sqlRaw.json(context)},
      ${jobs.length},
      0
    )
    RETURNING id
  `;
  const batchId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
  if (batchId == null) return null;

  for (const j of jobs) {
    await sqlRaw`
      INSERT INTO product_sources_queue_jobs (batch_id, job_type, sort_order, status, payload_json)
      VALUES (
        ${batchId},
        ${j.job_type},
        ${j.sort_order},
        'pending',
        ${sqlRaw.json(j.payload_json)}
      )
    `;
  }

  return batchId;
}

/**
 * @param {number} batchId
 * @returns {Promise<{ linkedinEnrichments: object[], webEnrichments: object[] }>}
 */
export async function aggregateJobResults(batchId) {
  if (!sql) {
    return { linkedinEnrichments: [], webEnrichments: [] };
  }
  const r = await sql`
    SELECT job_type, result_json, status, error_message, payload_json
    FROM product_sources_queue_jobs
    WHERE batch_id = ${batchId}
    ORDER BY sort_order, id
  `;
  const linkedinEnrichments = [];
  const webEnrichments = [];
  for (const row of r.rows || []) {
    if (row.job_type === 'linkedin_apify') {
      if (row.status === 'error') {
        const p = row.payload_json || {};
        const urls = Array.isArray(p.urls) ? p.urls : [];
        const err = row.error_message || 'Errore job LinkedIn';
        for (const url of urls) linkedinEnrichments.push({ url, error: err });
        continue;
      }
      const data = row.result_json;
      const arr = data?.enrichments;
      if (Array.isArray(arr)) {
        linkedinEnrichments.push(...arr);
      }
    } else if (row.job_type === 'web') {
      const payload = row.payload_json || {};
      const base = { url: payload.url || '' };
      if (row.result_json && typeof row.result_json === 'object') {
        webEnrichments.push({ ...base, ...row.result_json });
      } else if (row.status === 'error' && row.error_message) {
        webEnrichments.push({ ...base, error: row.error_message });
      }
    }
  }
  return { linkedinEnrichments, webEnrichments };
}

export async function markBatchDone(batchId, finalRunId) {
  if (!sqlRaw) return;
  await sqlRaw`
    UPDATE product_sources_queue_batches
    SET status = 'done',
        updated_at = NOW(),
        final_run_id = ${finalRunId}
    WHERE id = ${batchId}
  `;
}

export async function markBatchFailed(batchId, errMsg) {
  if (!sqlRaw) return;
  await sqlRaw`
    UPDATE product_sources_queue_batches
    SET status = 'failed',
        updated_at = NOW(),
        last_error = ${String(errMsg || '').slice(0, 2000)}
    WHERE id = ${batchId}
  `;
}

/**
 * Elenco batch recenti + conteggi job (dashboard).
 */
export async function listQueueBatches({ limit = 30 } = {}) {
  if (!sql) return { batches: [] };
  try {
    const lim = Math.min(100, Math.max(1, limit));
    const r = await sql`
      SELECT
        b.id,
        b.created_at,
        b.updated_at,
        b.status,
        b.total_jobs,
        b.completed_jobs,
        b.last_error,
        b.final_run_id,
        (SELECT COUNT(*)::int FROM product_sources_queue_jobs j WHERE j.batch_id = b.id AND j.status = 'pending') AS pending_jobs,
        (SELECT COUNT(*)::int FROM product_sources_queue_jobs j WHERE j.batch_id = b.id AND j.status = 'running') AS running_jobs
      FROM product_sources_queue_batches b
      ORDER BY b.id DESC
      LIMIT ${lim}
    `;
    return { batches: r.rows || [], migrationNeeded: false };
  } catch (e) {
    if (/does not exist|relation .*product_sources_queue/i.test(String(e?.message || e))) {
      return { batches: [], migrationNeeded: true };
    }
    throw e;
  }
}
