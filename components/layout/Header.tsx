import { useConnectionStore } from '../../stores/connection';
import { useSettingsStore } from '../../stores/settings';
import { useGameState } from '../../stores/gameState';
import { StatusDot, type ConnectionStatus } from '../shared';

function useConnectionStatus(): ConnectionStatus {
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

export function Header() {
  const status = useConnectionStatus();
  const { setApexVisible } = useGameState();

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-apxm-bg border-b border-apxm-surface">
      <span className="text-base font-bold text-prun-yellow">APXM</span>
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <button
          onClick={() => setApexVisible(true)}
          className="px-3 min-h-touch flex items-center text-xs text-apxm-muted hover:text-apxm-text border border-apxm-surface hover:border-prun-yellow/40"
        >
          Show APEX
        </button>
      </div>
    </header>
  );
}
