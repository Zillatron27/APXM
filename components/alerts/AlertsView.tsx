import { useAlertCounts } from '../../hooks/useAlertCounts';
import { Panel } from '../shared';
import { AlertsList } from './AlertsList';

/**
 * The full Notifications surface (#94), reached from the header bell on
 * every tab. Replaces the active tab's content while open — the header and
 * tab bar stay, and the DetailSheet still overlays it so a row's tap-through
 * opens its target sheet above the list. Closed by the bell again or any
 * tab tap (gameState.setActiveTab clears alertsViewOpen).
 */
export function AlertsView() {
  const { ownUnread } = useAlertCounts();

  return (
    <Panel title="Notifications" code="NOTS" summary={`${ownUnread} unread`}>
      <AlertsList />
    </Panel>
  );
}
