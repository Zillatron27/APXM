import { useEffect, useState } from 'react';
import { useConnectionStore } from '../stores/connection';

/**
 * Why the overlay is (or isn't) showing:
 * - 'ok'          — data is flowing, or we're still within the startup grace
 * - 'maintenance' — APEX's own error banner confirms the server is unavailable
 * - 'starved'     — no data is arriving and we don't know the server is down;
 *                   the likely cause is a competing extension intercepting the
 *                   connection (or a broken injection), not maintenance
 */
export type AvailabilityReason = 'ok' | 'maintenance' | 'starved';

const TIMEOUT_MS = 20_000;
/** Shorter grace once a competing interceptor is confirmed — no point making
 *  the user wait the full timeout when we already know the likely cause. */
const CONFLICT_GRACE_MS = 5_000;
const POLL_INTERVAL_MS = 1_000;

/**
 * Check for APEX's error banner indicating connection failure.
 * This appears when the game itself can't connect to the APEX network.
 */
function detectApexErrorBanner(): boolean {
  try {
    return document.body?.innerText?.includes('Failed to connect to APEX network') ?? false;
  } catch {
    return false;
  }
}

/**
 * Pure availability classification (extracted for testing). The starvation
 * timeout shortens when a competing interceptor is confirmed.
 */
export function deriveAvailability(params: {
  messageCount: number;
  apexErrorBanner: boolean;
  elapsedMs: number;
  interceptorConflict: boolean;
}): AvailabilityReason {
  if (params.messageCount > 0) return 'ok';
  if (params.apexErrorBanner) return 'maintenance';
  const timeoutMs = params.interceptorConflict ? CONFLICT_GRACE_MS : TIMEOUT_MS;
  return params.elapsedMs >= timeoutMs ? 'starved' : 'ok';
}

/**
 * Detects whether APXM can show data, and if not, why. Distinguishes genuine
 * server maintenance (APEX error banner) from data starvation (no messages),
 * so the overlay can tell the truth instead of always blaming maintenance.
 */
export function useAvailabilityStatus(): AvailabilityReason {
  const [reason, setReason] = useState<AvailabilityReason>('ok');
  const messageCount = useConnectionStore((s) => s.messageCount);
  const interceptorConflict = useConnectionStore((s) => s.interceptorConflict);

  useEffect(() => {
    // Messages received — data is flowing
    if (messageCount > 0) {
      setReason('ok');
      return;
    }

    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const next = deriveAvailability({
        messageCount: useConnectionStore.getState().messageCount,
        apexErrorBanner: detectApexErrorBanner(),
        elapsedMs: Date.now() - startTime,
        interceptorConflict,
      });
      if (next !== 'ok') {
        setReason(next);
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [messageCount, interceptorConflict]);

  return reason;
}
