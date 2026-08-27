import { useGameState } from '../../stores/gameState';
import { ConnectionStatusBadge, btnSecondary } from '../shared';
import { BUILD_VERSION } from '../../lib/constants';
import { useAlertCounts } from '../../hooks/useAlertCounts';

/** Badge text: a real count up to 9, "9+" beyond — two glyphs max so the
 *  badge never outgrows the bell on a 320pt header. */
export function formatUnreadBadge(count: number): string {
  return count > 9 ? '9+' : String(count);
}

/**
 * Header notifications bell (#94) — APEX mobile's own top-bar pattern. Own
 * unread only; corp unread is reported inside the view, not on the badge,
 * so the number always means "things addressed to me".
 */
function AlertsBell() {
  const alertsViewOpen = useGameState((s) => s.alertsViewOpen);
  const setAlertsViewOpen = useGameState((s) => s.setAlertsViewOpen);
  const { ownUnread } = useAlertCounts();

  return (
    <button
      type="button"
      onClick={() => setAlertsViewOpen(!alertsViewOpen)}
      aria-label={
        alertsViewOpen ? 'Close notifications' : `Open notifications, ${ownUnread} unread`
      }
      aria-pressed={alertsViewOpen}
      className={`relative min-h-touch min-w-touch flex items-center justify-center ${
        alertsViewOpen ? 'text-prun-yellow' : 'text-apxm-muted hover:text-apxm-text'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      {ownUnread > 0 && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center font-mono text-[10px] font-semibold leading-none bg-prun-yellow text-black"
        >
          {formatUnreadBadge(ownUnread)}
        </span>
      )}
    </button>
  );
}

export function Header() {
  const { setApexVisible, setActiveTab } = useGameState();

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-apxm-bg border-b border-apxm-surface">
      <div className="flex items-center gap-1.5">
        {/* Logo doubles as a home link back to the Status view. Padding
            expands the tap target to 44pt without enlarging the 28px glyph. */}
        <button
          onClick={() => setActiveTab('status')}
          aria-label="Go to Status"
          className="flex items-center justify-center min-h-touch px-2 -ml-2"
        >
          {/* Fixed brand mark — deliberately keeps the AMO/CWS icon's gold on
              black in every theme preset rather than following --apxm-highlight. */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="28" height="28">
            <rect x="6" y="6" width="116" height="116" rx="8" fill="#0a0a0a"/>
            <rect x="6" y="6" width="116" height="116" rx="8" fill="none" stroke="#f7a600" strokeWidth="5"/>
            <text x="64" y="42" textAnchor="middle" dominantBaseline="central" fill="#f7a600" fontFamily="'Courier New', monospace" fontWeight="bold" fontSize="54" letterSpacing="2">AP</text>
            <text x="64" y="94" textAnchor="middle" dominantBaseline="central" fill="#f7a600" fontFamily="'Courier New', monospace" fontWeight="bold" fontSize="54" letterSpacing="2">XM</text>
          </svg>
        </button>
        <span className="text-xs text-apxm-muted">{BUILD_VERSION}</span>
      </div>
      {/* gap-2 (not 3) and px-2 on SHOW APEX: with the bell added, the
          320pt header only fits at these tighter spacings. */}
      <div className="flex items-center gap-2">
        <ConnectionStatusBadge />
        <AlertsBell />
        <button
          onClick={() => setApexVisible(true)}
          className={`px-2 min-h-touch flex items-center ${btnSecondary}`}
        >
          SHOW APEX
        </button>
      </div>
    </header>
  );
}
