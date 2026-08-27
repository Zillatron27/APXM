import { useState, type ReactNode } from 'react';
import { Panel } from '../shared';
import { useGameState } from '../../stores/gameState';
import { useAlertCounts } from '../../hooks/useAlertCounts';
import { AlertsList } from '../alerts';

// Top-N mirror, the same cap as the Bases/Contracts mini-lists: the Status
// tab is the glance, the Notifications view (header bell) is the full list.
const MAX_ROWS = 5;

/**
 * APEX notifications on the Status tab (the NOTS passthrough, #30): the
 * newest unread alerts as a collapsible, reorderable panel, mirroring the
 * top of the full Notifications view. Overflow links into that view.
 */
export function AlertsPanel({ handle }: { handle?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const setAlertsViewOpen = useGameState((s) => s.setAlertsViewOpen);
  const { ownUnread, otherUnread } = useAlertCounts();

  const summary = `${ownUnread} unread${otherUnread > 0 ? ` · ${otherUnread} corp` : ''}`;

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
      <AlertsList
        limit={MAX_ROWS}
        overflow={(hidden) => (
          <button
            type="button"
            onClick={() => setAlertsViewOpen(true)}
            className="min-h-touch w-full text-left text-[10px] text-apxm-muted hover:text-apxm-text"
          >
            +{hidden} more unread — open Notifications ›
          </button>
        )}
      />
    </Panel>
  );
}
