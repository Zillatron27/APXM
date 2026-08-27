import { useMemo, useState, type ReactNode } from 'react';
import { Panel } from '../shared';
import { useAlertsStore } from '../../stores/entities';
import { formatAlert, type AlertTone } from '../../lib/format-alert';
import { formatRelativeTime } from '../../lib/format-time';
import { MaterialTile } from '../shared/MaterialTile';

// Unread can still run long (the login snapshot arrives before APEX marks
// anything read); cap the panel and say so rather than scroll forever.
const MAX_ROWS = 50;

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

/**
 * APEX notifications surfaced into APXM (the NOTS passthrough, #30): the
 * ALERTS_* WebSocket data rendered as a collapsible Status panel, so alerts
 * are visible without switching to APEX. Read state is server-driven and
 * display-only — marking read would require sending a message, which APXM
 * never does.
 *
 * Unread only (for now): the login snapshot carries the full NOTS history,
 * which is several screens of already-read noise on first load. Read alerts
 * live in APEX's NOTS buffer; this panel is the "what needs my attention"
 * view. Revisit if a history view is ever wanted here.
 */
export function AlertsPanel({ handle }: { handle?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const fetched = useAlertsStore((s) => s.fetched);
  const entities = useAlertsStore((s) => s.entities);

  const unreadAlerts = useMemo(
    () =>
      Array.from(entities.values())
        .filter((a) => !a.read)
        .sort((a, b) => b.time.timestamp - a.time.timestamp),
    [entities]
  );
  const rows = unreadAlerts.slice(0, MAX_ROWS);

  return (
    <Panel
      title="Alerts"
      code="NOTS"
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      summary={`${unreadAlerts.length} unread`}
      handle={handle}
    >
      {!fetched ? (
        <p className="text-xs text-apxm-muted">Waiting for game data...</p>
      ) : unreadAlerts.length === 0 ? (
        <p className="text-xs text-apxm-muted">No unread notifications</p>
      ) : (
        <div className="space-y-1">
          {rows.map((alert) => {
            const { text, label, tone, material } = formatAlert(alert);
            return (
              <div key={alert.id} className="flex items-baseline gap-2 text-xs">
                <span className={`font-mono text-[10px] w-16 shrink-0 ${TONE_CLASS[tone]}`}>
                  {tone === 'critical' ? '! ' : ''}
                  {label}
                </span>
                {material?.ticker && <MaterialTile ticker={material.ticker} size="sm" />}
                <span className="flex-1 min-w-0 text-apxm-text">{text}</span>
                <span className="font-mono text-[10px] text-apxm-text/50 shrink-0">
                  {formatRelativeTime(alert.time.timestamp)}
                </span>
              </div>
            );
          })}
          {unreadAlerts.length > MAX_ROWS && (
            <p className="text-[10px] text-apxm-muted pt-1">
              +{unreadAlerts.length - MAX_ROWS} more unread — see NOTS in APEX
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
