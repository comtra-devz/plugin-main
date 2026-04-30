/**
 * Global Moonshot/Kimi throughput gate (Redis).
 * TPM/RPM limits are org-wide on one API key — bursty parallel requests from many users exhaust TPM quickly.
 * This caps simultaneous in-flight chat/completions across all routes/instances sharing REDIS_URL.
 *
 * Env:
 * - KIMI_GLOBAL_MAX_CONCURRENT (default 16): max parallel Kimi HTTP calls cluster-wide.
 * - KIMI_LEASE_MS (default 180000): stale leases purged after this (crash-safe slot recovery).
 * - KIMI_QUEUE_MAX_WAIT_MS (default 90000): wait in queue before 503 KIMI_QUEUE_TIMEOUT.
 *
 * Without REDIS_URL the gate is a no-op (single-instance dev); production multi-tenant should use Redis.
 */
import { randomBytes } from 'crypto';

let redisPromise;

async function getRedisForKimiGate() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!redisPromise) {
    redisPromise = (async () => {
      const { createClient } = await import('redis');
      const client = createClient({ url });
      client.on('error', () => {});
      await client.connect();
      return client;
    })();
  }
  return redisPromise;
}

const ZSET_KEY = 'comtra:kimi:leases';

/** Atomically purge stale leases, then add one slot if under cap. Returns 1 if acquired. */
const ACQUIRE_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local n = redis.call('ZCARD', KEYS[1])
if n < tonumber(ARGV[2]) then
  redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
  return 1
end
return 0
`;

function maxConcurrent() {
  const n = Number(process.env.KIMI_GLOBAL_MAX_CONCURRENT);
  return Number.isFinite(n) && n >= 1 && n <= 800 ? Math.floor(n) : 16;
}

function leaseMs() {
  const n = Number(process.env.KIMI_LEASE_MS);
  return Number.isFinite(n) && n >= 30000 && n <= 600000 ? Math.floor(n) : 180000;
}

function maxWaitMs() {
  const n = Number(process.env.KIMI_QUEUE_MAX_WAIT_MS);
  return Number.isFinite(n) && n >= 5000 && n <= 600000 ? Math.floor(n) : 90000;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Runs fn while holding one Kimi concurrency slot (released in finally).
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withKimiConcurrencySlot(fn) {
  const redis = await getRedisForKimiGate();
  if (!redis) {
    return fn();
  }

  const id = randomBytes(16).toString('hex');
  const maxc = maxConcurrent();
  const lease = leaseMs();
  const waitBudget = maxWaitMs();
  const start = Date.now();

  while (Date.now() - start < waitBudget) {
    const now = Date.now();
    const purgeBefore = now - lease;
    const acquired = Number(
      await redis.eval(ACQUIRE_LUA, {
        keys: [ZSET_KEY],
        arguments: [String(purgeBefore), String(maxc), String(now), id],
      }),
    );

    if (acquired === 1) {
      try {
        return await fn();
      } finally {
        await redis.zRem(ZSET_KEY, id).catch(() => {});
      }
    }

    await sleep(45 + Math.floor(Math.random() * 155));
  }

  const err = new Error(
    'Too many simultaneous AI requests right now. Please retry in a few seconds.',
  );
  err.status = 503;
  err.code = 'KIMI_QUEUE_TIMEOUT';
  throw err;
}
