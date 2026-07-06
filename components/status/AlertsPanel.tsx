import { useMemo, useState, type ReactNode } from 'react';
import { Panel } from '../shared';
import { useAlertsStore } from '../../stores/entities';
import { formatAlert } from '../../lib/format-alert';
import { formatRelativeTime } from '../../lib/format-time';

// The NOTS list can run long; cap the panel and say so rather than scroll
// forever — the full history lives in APEX.
const MAX_ROWS = 50;

/**
 * APEX notifications surfaced into APXM (the NOTS passthrough, #30): the
 * ALERTS_* WebSocket data rendered as a collapsible Status panel, so alerts
 * are visible without switching to APEX. Read state is server-driven and
 * display-only — marking read would require sending a message, which APXM
 * never does.
 */
export function AlertsPanel({ handle }: { handle?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const fetched = useAlertsStore((s) => s.fetched);
  const entities = useAlertsStore((s) => s.entities);

  const alerts = useMemo(
    () =>
      Array.from(entities.values()).sort((a, b) => b.time.timestamp - a.time.timestamp),
    [entities]
  );
  const unread = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);
  const rows = alerts.slice(0, MAX_ROWS);

  return (
    <Panel
      title="Alerts"
      code="NOTS"
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      summary={unread > 0 ? `${unread} unread` : `${alerts.length}`}
      handle={handle}
    >
      {!fetched ? (
        <p className="text-xs text-apxm-muted">Waiting for game data...</p>
      ) : alerts.length === 0 ? (
        <p className="text-xs text-apxm-muted">No notifications</p>
      ) : (
        <div className="space-y-1">
          {rows.map((alert) => {
            const { text, category } = formatAlert(alert);
            return (
              <div key={alert.id} className="flex items-baseline gap-2 text-xs">
                <span className="font-mono text-[10px] uppercase text-apxm-text/50 w-16 shrink-0">
                  {category}
                </span>
                <span
                  className={`flex-1 min-w-0 ${
                    alert.read ? 'text-apxm-muted' : 'text-apxm-text'
                  }`}
                >
                  {/* Unread also gets a marker — colour alone can't carry state */}
                  {!alert.read && <span className="text-prun-yellow mr-1">●</span>}
                  {text}
                </span>
                <span className="font-mono text-[10px] text-apxm-text/50 shrink-0">
                  {formatRelativeTime(alert.time.timestamp)}
                </span>
              </div>
            );
          })}
          {alerts.length > MAX_ROWS && (
            <p className="text-[10px] text-apxm-muted pt-1">
              +{alerts.length - MAX_ROWS} older — see NOTS in APEX
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
