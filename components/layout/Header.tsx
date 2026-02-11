import { useGameState } from '../../stores/gameState';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { StatusDot } from '../shared';

// Increment this on each build for easy verification
const BUILD_VERSION = 'v0.1.2-b2';

export function Header() {
  const status = useConnectionStatus();
  const { setApexVisible } = useGameState();

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-apxm-bg border-b border-apxm-surface">
      <div className="flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="28" height="28">
          <rect x="6" y="6" width="116" height="116" rx="8" fill="#0a0a0a"/>
          <rect x="6" y="6" width="116" height="116" rx="8" fill="none" stroke="#f7a600" strokeWidth="5"/>
          <text x="64" y="42" textAnchor="middle" dominantBaseline="central" fill="#f7a600" fontFamily="'Courier New', monospace" fontWeight="bold" fontSize="54" letterSpacing="2">AP</text>
          <text x="64" y="94" textAnchor="middle" dominantBaseline="central" fill="#f7a600" fontFamily="'Courier New', monospace" fontWeight="bold" fontSize="54" letterSpacing="2">XM</text>
        </svg>
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
