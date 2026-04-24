/** Thrown when POST /api/agents/sync-scan returns 429 with structured rate-limit payload. */
export class SyncScanRateLimitedError extends Error {
  readonly retryAfterSec: number | null;
  readonly upgradeUrl: string | null;

  constructor(opts: { retryAfterSec: number | null; upgradeUrl: string | null }) {
    super('rate_limited');
    this.name = 'SyncScanRateLimitedError';
    this.retryAfterSec = opts.retryAfterSec;
    this.upgradeUrl = opts.upgradeUrl;
    Object.setPrototypeOf(this, SyncScanRateLimitedError.prototype);
  }
}
