/**
 * Fase 6 — Salta Apify, fetch web e (opz.) snapshot doc quando non c’è lavoro su URL nuovi,
 * salvo LinkedIn in modalità REFETCH_ALL o web da processare.
 */

/**
 * @param {{
 *   newLinks: Array<{ url: string }>,
 *   linkedinUrlsForApify: string[],
 *   fetchWebEnabled: boolean,
 *   webUrlsUnique: string[],
 * }} p
 * @returns {boolean}
 */
export function shouldSkipHeavyWorkloadCron(p) {
  const disabled =
    process.env.PRODUCT_SOURCES_SKIP_HEAVY_IF_NO_NEW_URLS === '0' ||
    process.env.PRODUCT_SOURCES_SKIP_HEAVY_IF_NO_NEW_URLS === 'false';
  if (disabled) return false;

  const noNew = !p.newLinks?.length;
  const linkedinWork = (p.linkedinUrlsForApify || []).length > 0;
  const webWork = !!p.fetchWebEnabled && (p.webUrlsUnique || []).length > 0;

  return noNew && !linkedinWork && !webWork;
}

/**
 * In run “solo Fase 6” omettere lo snapshot file/URL salvo env.
 */
export function shouldOmitDocSnapshotOnPhase6Skip() {
  return (
    process.env.PRODUCT_SOURCES_SNAPSHOT_ON_NO_NEW !== '1' &&
    process.env.PRODUCT_SOURCES_SNAPSHOT_ON_NO_NEW !== 'true'
  );
}
