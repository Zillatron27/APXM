import { formatAlert, UNRESOLVED_MATERIAL, type AlertTone } from '../../lib/format-alert';
import { formatRelativeTime } from '../../lib/format-time';
import { resolveAlertTarget } from '../../lib/alert-target';
import { useGameState, type DetailView } from '../../stores/gameState';
import { useShipsStore, useContractsStore, useSitesStore } from '../../stores/entities';
import { MaterialTile } from '../shared/MaterialTile';
import { keycapClasses } from '../shared/keycap';
import type { PrunApi } from '../../types/prun-api';

// Label colour per severity, through the theme's status tokens so every
// preset (Colorblind included) renders it. Critical rows also carry a "!"
// glyph — colour is never the only signal.
const TONE_CLASS: Record<AlertTone, string> = {
  critical: 'text-status-critical',
  warning: 'text-status-warning',
  ok: 'text-status-ok',
  info: 'text-status-info',
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

// Keycap text naming the detail sheet a tap opens — the destination, not
// the tab it lives under, so PRODUCED reads PROD and a workforce alert
// reads BURN (the same way a ship alert reads SHIP).
const TARGET_CODE: Record<DetailView['type'], string> = {
  ship: 'SHIP',
  contract: 'CONT',
  burn: 'BURN',
  production: 'PROD',
  repair: 'REPAIR',
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
  // The resolver reads these stores directly; subscribing here makes the row
  // re-render when a target entity arrives after the alert list did
  // (FIO/WS data landing late, reconnect refill), so the chevron appears as
  // soon as the tap would actually work.
  useShipsStore((s) => s.entities);
  useContractsStore((s) => s.entities);
  useSitesStore((s) => s.entities);
  const target = resolveAlertTarget(alert);
  const { text, label, tone, material } = formatAlert(alert, {
    shipName: target?.type === 'ship' ? target.shipName : undefined,
  });
  const content = (
    <>
      {/* Type label over the timestamp: one fixed column, freeing the right
          edge for the target keycap at 320pt. */}
      <span className="flex flex-col gap-0.5 w-16 shrink-0 font-mono text-[10px] leading-none text-left">
        <span className={TONE_CLASS[tone]}>
          {tone === 'critical' ? '! ' : ''}
          {label}
        </span>
        <span className="text-apxm-text/50">{formatRelativeTime(alert.time.timestamp)}</span>
      </span>
      {material &&
        (material.ticker ? (
          <MaterialTile ticker={material.ticker} size="sm" />
        ) : (
          // Unresolved material: placeholder chip; the wire identifier is
          // exposed to assistive tech and hover only (#103).
          <span
            title={material.name}
            aria-label={`Unknown material ${material.name}`}
            className="shrink-0 w-8 h-5 flex items-center justify-center font-mono text-[10px] rounded border border-apxm-text/30 text-apxm-text/50"
          >
            {UNRESOLVED_MATERIAL}
          </span>
        ))}
      <span className="flex-1 min-w-0 text-left text-apxm-text">{text}</span>
      {/* The tappable affordance is the app's keycap, naming the destination
          (device feedback: a chevron and text-weight cues were both missed).
          Visual only — the whole row is the button. Plain rows render
          nothing here; the row stays a plain div. */}
      {target && (
        <span
          aria-hidden
          className={`shrink-0 min-h-touch w-14 flex items-center justify-center font-mono text-[10px] text-prun-yellow ${keycapClasses}`}
        >
          {TARGET_CODE[target.type]} ›
        </span>
      )}
    </>
  );

  return target ? (
    <button
      type="button"
      onClick={() => setDetailView(target)}
      aria-label={`${text}. Open ${DETAIL_NOUN[target.type] ?? target.type} detail.`}
      className="w-full min-h-touch flex items-center gap-2 text-xs hover:bg-apxm-accent/30 active:bg-apxm-accent/50 transition-colors motion-reduce:transition-none"
    >
      {content}
    </button>
  ) : (
    <div className="w-full min-h-touch flex items-center gap-2 text-xs">{content}</div>
  );
}
