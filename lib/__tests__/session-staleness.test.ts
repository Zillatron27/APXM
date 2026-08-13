import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  deriveSessionStale,
  evaluateSessionStaleness,
  startSessionStalenessMonitor,
} from '../session-staleness';
import { WS_SILENCE_THRESHOLD_MS } from '../constants';
import { useConnectionStore } from '../../stores/connection';

const NOW = 1_700_000_000_000;

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', {
    value: hidden,
    configurable: true,
  });
}

beforeEach(() => {
  useConnectionStore.getState().reset();
  setDocumentHidden(false);
});

afterEach(() => {
  setDocumentHidden(false);
});

describe('deriveSessionStale (#7 heartbeat classification)', () => {
  const base = {
    connected: true,
    lastMessageAt: NOW - WS_SILENCE_THRESHOLD_MS - 1,
    now: NOW,
    maintenance: false,
  };

  it('flags stale once silence reaches the threshold, not before', () => {
    expect(
      deriveSessionStale({ ...base, lastMessageAt: NOW - WS_SILENCE_THRESHOLD_MS + 1 })
    ).toBe(false);
    expect(
      deriveSessionStale({ ...base, lastMessageAt: NOW - WS_SILENCE_THRESHOLD_MS })
    ).toBe(true);
    expect(deriveSessionStale(base)).toBe(true);
  });

  it('never flags while the connection is not nominally open', () => {
    // A closed connection is the reconnect path's problem, not the heartbeat's.
    expect(deriveSessionStale({ ...base, connected: false })).toBe(false);
  });

  it('maintenance suppresses the signal — silence is expected', () => {
    expect(deriveSessionStale({ ...base, maintenance: true })).toBe(false);
  });

  it('no message yet means startup, owned by the availability gates', () => {
    expect(deriveSessionStale({ ...base, lastMessageAt: null })).toBe(false);
  });
});

describe('evaluateSessionStaleness', () => {
  it('writes the stale flag when silence exceeds the threshold', () => {
    const store = useConnectionStore.getState();
    store.setConnected(true);
    store.setLastMessageTimestamp(NOW - WS_SILENCE_THRESHOLD_MS - 1);

    evaluateSessionStaleness(NOW);
    expect(useConnectionStore.getState().sessionStale).toBe(true);
  });

  it('does not fire while the document is hidden — no state accumulates in the background', () => {
    const store = useConnectionStore.getState();
    store.setConnected(true);
    store.setLastMessageTimestamp(NOW - WS_SILENCE_THRESHOLD_MS - 1);
    setDocumentHidden(true);

    evaluateSessionStaleness(NOW);
    expect(useConnectionStore.getState().sessionStale).toBe(false);
  });
});

describe('startSessionStalenessMonitor', () => {
  let stop: (() => void) | null = null;

  afterEach(() => {
    stop?.();
    stop = null;
  });

  it('a handled message while stale clears the flag immediately', () => {
    stop = startSessionStalenessMonitor();
    const store = useConnectionStore.getState();
    store.setConnected(true);
    store.setLastMessageTimestamp(NOW - WS_SILENCE_THRESHOLD_MS - 1);
    store.setSessionStale(true);

    store.setLastMessageTimestamp(NOW);
    expect(useConnectionStore.getState().sessionStale).toBe(false);
  });

  it('evaluates on visibility-resume — the common mobile backgrounding path', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    stop = startSessionStalenessMonitor();

    const store = useConnectionStore.getState();
    store.setConnected(true);
    store.setLastMessageTimestamp(NOW - WS_SILENCE_THRESHOLD_MS - 1);

    setDocumentHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(useConnectionStore.getState().sessionStale).toBe(true);
    vi.useRealTimers();
  });

  it('becoming hidden does not evaluate', () => {
    stop = startSessionStalenessMonitor();
    const store = useConnectionStore.getState();
    store.setConnected(true);
    store.setLastMessageTimestamp(NOW - WS_SILENCE_THRESHOLD_MS - 1);

    setDocumentHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(useConnectionStore.getState().sessionStale).toBe(false);
  });
});

describe('reconnect interaction', () => {
  it('reset() (the CLIENT_CONNECTION_OPENED clear-stores path) also resets the stale flag', () => {
    const store = useConnectionStore.getState();
    store.setConnected(true);
    store.setSessionStale(true);

    store.reset();
    expect(useConnectionStore.getState().sessionStale).toBe(false);
  });
});
