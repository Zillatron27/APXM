import { useConnectionStore } from '../stores/connection';
import { useSettingsStore } from '../stores/settings';

export type ConnectionStatus = 'live' | 'fio' | 'connecting';

/**
 * Derives connection status from WebSocket state and FIO config.
 * Single source of truth — used by Header, DataGate, and mini-lists.
 */
export function useConnectionStatus(): ConnectionStatus {
  const connected = useConnectionStore((s) => s.connected);
  const lastMessageTimestamp = useConnectionStore((s) => s.lastMessageTimestamp);
  const fioLastFetch = useSettingsStore((s) => s.fio.lastFetch);

  if (connected && lastMessageTimestamp && Date.now() - lastMessageTimestamp < 60000) {
    return 'live';
  }
  if (fioLastFetch) {
    return 'fio';
  }
  return 'connecting';
}
