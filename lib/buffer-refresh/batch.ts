/**
 * Sequential batch executor for buffer refreshes.
 *
 * Iterates site IDs one at a time — DOM manipulation can't parallelize.
 * Continues on individual failures so one broken site doesn't block the rest.
 */

import type { BatchRefreshOptions } from './types';
import { useRefreshState } from '../../stores/refreshState';
import { executeBufferRefresh, buildBufferCommand } from './engine';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Refresh all sites sequentially. Returns a map of siteId → success.
 */
export async function executeBatchRefresh(
  options: BatchRefreshOptions
): Promise<Map<string, boolean>> {
  const { siteIds, delayBetweenMs = 300, stepTimeoutMs, onProgress } = options;
  const results = new Map<string, boolean>();
  const store = useRefreshState.getState();

  store.startRefresh(siteIds);

  for (let i = 0; i < siteIds.length; i++) {
    const siteId = siteIds[i];

    let success = false;
    try {
      success = await executeBufferRefresh({
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

  useRefreshState.getState().completeRefresh();
  return results;
}
