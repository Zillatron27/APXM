import { useMemo, useState, type ReactNode } from 'react';
import { Panel } from '../shared';
import { useAlertsStore } from '../../stores/entities';
import { useUserStore } from '../../stores/user';
import { scopeAlerts } from '../../lib/alert-scope';
import { AlertRow } from '../alerts';

// Unread can still run long (the login snapshot arrives before APEX marks
// anything read); cap the panel and say so rather than scroll forever.
const MAX_ROWS = 50;

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
  const contexts = useUserStore((s) => s.contexts);
  const companyContextId = useUserStore((s) => s.companyContextId);

  const { own, otherUnread, dropped } = useMemo(
    () => scopeAlerts(Array.from(entities.values()), contexts, companyContextId),
    [entities, contexts, companyContextId]
  );
  const rows = own.slice(0, MAX_ROWS);

  const summary = `${own.length} unread${otherUnread > 0 ? ` · ${otherUnread} corp` : ''}`;

  return (
    <Panel
      title="Alerts"
      code="NOTS"
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      summary={summary}
      handle={handle}
    >
      {!fetched ? (
        <p className="text-xs text-apxm-muted">Waiting for game data...</p>
      ) : own.length === 0 ? (
        <p className="text-xs text-apxm-muted">No unread notifications</p>
      ) : (
        <div className="space-y-1">
          {rows.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
          {own.length > MAX_ROWS && (
            <p className="text-[10px] text-apxm-muted pt-1">
              +{own.length - MAX_ROWS} more unread — see NOTS in APEX
            </p>
          )}
        </div>
      )}
      {/* Dev-only visibility into the unreachable-context filter — outside
          the list branch so it still shows when the filter removed
          everything, which is the case worth seeing. Never shown to users:
          there is nothing they can act on for these alerts. */}
      {__DEV__ && fetched && dropped > 0 && (
        <p className="text-[10px] text-apxm-muted pt-1">
          {dropped} from unreachable contexts hidden
        </p>
      )}
    </Panel>
  );
}
