import { WS_SILENCE_THRESHOLD_MS } from './constants';
import { useConnectionStore } from '../stores/connection';
import { detectApexErrorBanner } from '../hooks/useAvailabilityStatus';

/**
 * Pure heartbeat classification (#7): the session is stale when the
 * connection is nominally open but no WS message has been handled within
 * the silence threshold. Maintenance suppresses the signal — silence is
 * expected while APEX itself is down. No message yet means startup, which
 * the availability/starvation gates own, not this heartbeat.
 */
export function deriveSessionStale(params: {
  connected: boolean;
  lastMessageAt: number | null;
  now: number;
  maintenance: boolean;
}): boolean {
  if (!params.connected) return false;
  if (params.maintenance) return false;
  if (params.lastMessageAt === null) return false;
  return params.now - params.lastMessageAt >= WS_SILENCE_THRESHOLD_MS;
}

/**
 * Evaluates the heartbeat against the connection store and writes the
 * sessionStale flag. Never fires while the document is hidden — a
 * backgrounded phone must not accumulate state; the visibility-resume
 * listener re-evaluates the moment the user returns.
 */
export function evaluateSessionStaleness(now: number = Date.now()): void {
  if (document.hidden) return;
  const { connected, lastMessageTimestamp, sessionStale, setSessionStale } =
    useConnectionStore.getState();
  const stale = deriveSessionStale({
    connected,
    lastMessageAt: lastMessageTimestamp,
    now,
    maintenance: detectApexErrorBanner(),
  });
  if (stale !== sessionStale) setSessionStale(stale);
}

/** Foreground re-check cadence. Coarse on purpose — visibility-resume is the
 *  primary trigger; this only catches silence during a continuously
 *  foregrounded session. */
const FOREGROUND_CHECK_INTERVAL_MS = 60_000;

/**
 * Starts the in-session staleness heartbeat: evaluate when the document
 * becomes visible (the common mobile path: backgrounded tab → no messages →
 * user returns) plus a low-frequency check while foregrounded. Recovery is
 * automatic — any handled message moves lastMessageTimestamp, which clears
 * the flag here without waiting for the next evaluation. Returns a stop
 * function (used by tests; the extension runs it for the page's lifetime).
 */
export function startSessionStalenessMonitor(): () => void {
  const onVisibilityChange = () => {
    if (!document.hidden) evaluateSessionStaleness();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const intervalId = setInterval(() => evaluateSessionStaleness(), FOREGROUND_CHECK_INTERVAL_MS);

  // Any handled message clears the stale flag immediately (indicator returns
  // to live). CLIENT_CONNECTION_OPENED's clear-stores path is untouched —
  // reset() reinitialises sessionStale to false along with everything else.
  const unsubscribe = useConnectionStore.subscribe((state, prev) => {
    if (
      state.sessionStale &&
      state.lastMessageTimestamp !== null &&
      state.lastMessageTimestamp !== prev.lastMessageTimestamp
    ) {
      state.setSessionStale(false);
    }
  });

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearInterval(intervalId);
    unsubscribe();
  };
}
