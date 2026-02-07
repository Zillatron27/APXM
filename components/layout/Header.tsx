import { useConnectionStore } from '../../stores/connection';
import { useSettingsStore } from '../../stores/settings';
import { useGameState } from '../../stores/gameState';
import { StatusDot, type ConnectionStatus } from '../shared';

// Increment this on each build for easy verification
const BUILD_VERSION = 'v0.1.1-b5';

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
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold text-prun-yellow">APXM</span>
        <span className="text-xs text-apxm-muted">{BUILD_VERSION}</span>
      </div>
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <button
          onClick={() => setApexVisible(true)}
          className="px-3 min-h-touch flex items-center text-xs font-medium text-apxm-text border border-apxm-surface hover:border-prun-yellow hover:text-prun-yellow"
        >
          SHOW APEX
        </button>
      </div>
    </header>
  );
}
