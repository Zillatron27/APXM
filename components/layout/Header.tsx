import { useConnectionStore } from '../../stores/connection';
import { useSettingsStore } from '../../stores/settings';
import { useGameState } from '../../stores/gameState';
import { useRefreshState } from '../../stores/refreshState';
import { StatusDot, type ConnectionStatus } from '../shared';

// Increment this on each build for easy verification
const BUILD_VERSION = 'v0.1.1-act1';

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

  const mode = useRefreshState((s) => s.mode);
  const isRefreshing = useRefreshState((s) => s.isRefreshing);
  const completedCount = useRefreshState((s) => s.completedCount);
  const totalCount = useRefreshState((s) => s.totalCount);

  const showProgressBar = mode === 'auto' && isRefreshing;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <>
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
      {showProgressBar && (
        <div className="px-4 py-1 bg-apxm-bg border-b border-apxm-surface">
          <div className="flex items-center gap-2">
            <span className="text-xs text-apxm-text/70">
              Loading bases... {completedCount}/{totalCount}
            </span>
            <div className="flex-1 h-1 bg-apxm-bg rounded-sm overflow-hidden">
              <div
                className="h-full bg-prun-yellow transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
