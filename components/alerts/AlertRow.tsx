import { formatAlert, type AlertTone } from '../../lib/format-alert';
import { formatRelativeTime } from '../../lib/format-time';
import { resolveAlertTarget } from '../../lib/alert-target';
import { useGameState, type DetailView } from '../../stores/gameState';
import { useShipsStore, useContractsStore, useSitesStore } from '../../stores/entities';
import { MaterialTile } from '../shared/MaterialTile';
import type { PrunApi } from '../../types/prun-api';

// Label colour per severity, through the theme's status tokens so every
// preset (Colorblind included) renders it. Critical rows also carry a "!"
// glyph — colour is never the only signal.
const TONE_CLASS: Record<AlertTone, string> = {
  critical: 'text-apxm-status-critical',
  warning: 'text-apxm-status-warning',
  ok: 'text-apxm-status-ok',
  info: 'text-apxm-status-info',
  neutral: 'text-apxm-text/50',
};

// 'repair' is a valid DetailView variant elsewhere in the app, but no alert
// type resolves to it — kept optional so the lookup stays exhaustive without
// forcing a placeholder label no alert will ever use.
const DETAIL_NOUN: Partial<Record<DetailView['type'], string>> = {
  ship: 'ship',
  contract: 'contract',
  burn: 'burn',
  production: 'production',
};

/**
 * One row in the Alerts panel. Tap-through navigation (#91): an alert whose
 * target entity still exists renders as a button that opens the same detail
 * sheet the fleet/bases rows use; one that doesn't renders as a plain row.
 * All rows share the same height and layout — including a reserved chevron
 * slot on non-interactive rows — so the list doesn't jump between the two.
 */
export function AlertRow({ alert }: { alert: PrunApi.Alert }) {
  const setDetailView = useGameState((s) => s.setDetailView);
  const { text, label, tone, material } = formatAlert(alert);
  // The resolver reads these stores directly; subscribing here makes the row
  // re-render when a target entity arrives after the alert list did
  // (FIO/WS data landing late, reconnect refill), so the chevron appears as
  // soon as the tap would actually work.
  useShipsStore((s) => s.entities);
  useContractsStore((s) => s.entities);
  useSitesStore((s) => s.entities);
  const target = resolveAlertTarget(alert);

  const content = (
    <>
      <span className={`font-mono text-[10px] w-16 shrink-0 ${TONE_CLASS[tone]}`}>
        {tone === 'critical' ? '! ' : ''}
        {label}
      </span>
      {material?.ticker && <MaterialTile ticker={material.ticker} size="sm" />}
      <span className="flex-1 min-w-0 text-apxm-text text-left">{text}</span>
      <span className="font-mono text-[10px] text-apxm-text/50 shrink-0">
        {formatRelativeTime(alert.time.timestamp)}
      </span>
      {/* Reserved width so interactive and plain rows align in the same column. */}
      <span aria-hidden className="w-3 shrink-0 text-center text-apxm-text/40">
        {target ? '›' : ''}
      </span>
    </>
  );

  if (target) {
    return (
      <button
        type="button"
        onClick={() => setDetailView(target)}
        aria-label={`${text}. Open ${DETAIL_NOUN[target.type] ?? target.type} detail.`}
        className="w-full min-h-touch flex items-center gap-2 text-xs hover:bg-apxm-accent/30 active:bg-apxm-accent/50 transition-colors motion-reduce:transition-none"
      >
        {content}
      </button>
    );
  }

  return <div className="min-h-touch flex items-center gap-2 text-xs">{content}</div>;
}
