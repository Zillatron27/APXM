import { useGameState } from '../stores/gameState';

export function StatusPanel() {
  const { connected, overlayVisible, setOverlayVisible, messageCount } = useGameState();

  if (!overlayVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[999999] flex flex-col gap-2 rounded-lg bg-apxm-bg p-4 text-apxm-text shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">APXM v0.1.0</span>
        <button
          onClick={() => setOverlayVisible(false)}
          className="flex h-[44px] w-[44px] items-center justify-center rounded bg-apxm-surface text-xl hover:bg-apxm-accent"
          aria-label="Close APXM overlay"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {messageCount > 0 && (
        <div className="text-xs text-apxm-text/70">
          Messages: {messageCount}
        </div>
      )}
    </div>
  );
}
