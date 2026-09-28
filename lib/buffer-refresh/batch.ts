/**
 * Sequential batch executor for buffer refreshes.
 *
 * Iterates site IDs one at a time — DOM manipulation can't parallelize.
 * Continues on individual failures so one broken site doesn't block the rest.
 */

import type { BatchRefreshOptions } from './types';
import { useRefreshState } from '../../stores/refreshState';
import { runBufferRefresh, buildBufferCommand } from './engine';
import { acquireActionLock, releaseActionLock, isActionInFlight } from '../act/action-lock';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Refresh all sites sequentially. Returns a map of siteId → success.
 *
 * Holds the shared action lock for the whole batch, gaps included, so no
 * other action can slip in between two sites. If another action already
 * holds it, returns an empty map without starting the refresh.
 */
export async function executeBatchRefresh(
  options: BatchRefreshOptions
): Promise<Map<string, boolean>> {
  const { siteIds, delayBetweenMs = 300, stepTimeoutMs, onProgress } = options;
  const results = new Map<string, boolean>();

  if (!acquireActionLock()) {
    console.warn('[APXM BatchRefresh] another action is running; batch skipped');
    return results;
  }

  try {
    useRefreshState.getState().startRefresh(siteIds);

    for (let i = 0; i < siteIds.length; i++) {
      const siteId = siteIds[i];

      let success = false;
      try {
        success = await runBufferRefresh({
          siteId,
          command: buildBufferCommand(siteId),
          stepTimeoutMs,
        });
      } catch (error) {
        console.error(`[APXM BatchRefresh] Unexpected error for ${siteId}:`, error);
      }

      results.set(siteId, success);
      onProgress?.(i + 1, siteIds.length, siteId, success);

      // Delay between sites (skip after the last one)
      if (i < siteIds.length - 1) {
        await delay(delayBetweenMs);
      }
    }
  } finally {
    useRefreshState.getState().completeRefresh();
    releaseActionLock();
  }
  return results;
}

/**
 * Startup auto-refresh. Fires once after login, when the user may already
 * have started their first action — so a busy lock means "try again
 * shortly", not "skip". Bounded: after maxAttempts it gives up with a
 * warning rather than retrying forever behind a long-running action.
 * Site IDs are read at each attempt so a retry sees the current site list.
 */
export function startAutoRefresh(
  getSiteIds: () => string[],
  { maxAttempts = 3, retryDelayMs = 3000 } = {}
): void {
  const attempt = (n: number): void => {
    if (isActionInFlight()) {
      if (n < maxAttempts) {
        setTimeout(() => attempt(n + 1), retryDelayMs);
      } else {
        console.warn(
          `[APXM BatchRefresh] auto-refresh skipped: another action was running on all ${maxAttempts} attempts`
        );
      }
      return;
    }
    void executeBatchRefresh({ siteIds: getSiteIds() });
  };
  attempt(1);
}
