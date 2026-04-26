/**
 * Figma plugin UI runs in an isolated context: fetch failures from CORS,
 * missing manifest `networkAccess`, or offline often surface as TypeError
 * or short English messages that differ by browser.
 */
export function isLikelyNetworkOrCorsFetchFailure(err: unknown): boolean {
  if (err == null) return false;
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg.trim() && err instanceof TypeError) return true;
  return /failed to fetch|load failed|networkerror|network request failed|fetch is aborted|aborted|err_connection|internet connection appears to be offline/i.test(
    msg,
  );
}
