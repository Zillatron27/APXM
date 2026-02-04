import { useEffect, useState } from 'react';
import { useConnectionStore } from '../stores/connection';

const TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 1_000;

/**
 * Check for APEX's error banner indicating connection failure.
 * This appears when the game can't connect to the APEX network.
 */
function detectApexErrorBanner(): boolean {
  try {
    return document.body?.innerText?.includes('Failed to connect to APEX network') ?? false;
  } catch {
    return false;
  }
}

/**
 * Detects when Prosperous Universe server is unavailable.
 *
 * Logic:
 * - If messageCount > 0, server is available (clear unavailable state)
 * - If messageCount === 0:
 *   - Poll DOM for APEX error banner every 1s
 *   - Timeout fallback: if still 0 after 20s, set unavailable
 * - Recovery: when messages start arriving, clear unavailable immediately
 */
export function useMaintenanceDetection(): boolean {
  const [unavailable, setUnavailable] = useState(false);
  const messageCount = useConnectionStore((s) => s.messageCount);

  useEffect(() => {
    // Messages received — server is available
    if (messageCount > 0) {
      setUnavailable(false);
      return;
    }

    // No messages yet — start detection
    const startTime = Date.now();

    const intervalId = setInterval(() => {
      // Check for APEX error banner
      if (detectApexErrorBanner()) {
        setUnavailable(true);
        clearInterval(intervalId);
        return;
      }

      // Timeout fallback
      if (Date.now() - startTime >= TIMEOUT_MS) {
        setUnavailable(true);
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [messageCount]);

  return unavailable;
}
