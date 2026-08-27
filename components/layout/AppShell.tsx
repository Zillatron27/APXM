import { useGameState } from '../../stores/gameState';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { FloatingReturn } from './FloatingReturn';
import { ConfirmBar } from './ConfirmBar';
import { DetailSheet } from './DetailSheet';
import { StatusView } from '../views/StatusView';
import { FleetView } from '../views/FleetView';
import { BasesView } from '../views/BasesView';
import { ContractsView } from '../views/ContractsView';
import { SettingsView } from '../views/SettingsView';
import { AlertsView } from '../alerts';

function ViewContent() {
  const activeTab = useGameState((s) => s.activeTab);
  const alertsViewOpen = useGameState((s) => s.alertsViewOpen);

  // The Notifications view sits in the tab content slot rather than as a
  // sheet, keeping detailView free for an alert's tap-through target.
  if (alertsViewOpen) return <AlertsView />;

  switch (activeTab) {
    case 'status':
      return <StatusView />;
    case 'fleet':
      return <FleetView />;
    case 'bases':
      return <BasesView />;
    case 'contracts':
      return <ContractsView />;
    case 'settings':
      return <SettingsView />;
  }
}

export function AppShell() {
  const apexVisible = useGameState((s) => s.apexVisible);
  const actConfirmPending = useGameState((s) => s.actConfirmPending);

  if (apexVisible) {
    return <FloatingReturn />;
  }

  // During a manual-confirm window the shell hides via CSS (it must stay
  // MOUNTED — unmounting would drop the in-flight action's React owner) and
  // the ConfirmBar is the only chrome; the host background drops via
  // :host(.act-confirm) so APEX's dialog underneath is visible and tappable.
  return (
    <>
      {actConfirmPending && <ConfirmBar />}
      <div
        className={`relative w-full h-dvh flex-col bg-apxm-bg text-apxm-text overflow-hidden pointer-events-auto ${
          actConfirmPending ? 'hidden' : 'flex'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
          <ViewContent />
        </main>
        <TabBar />
        {/* Drill-down sheet — overlays the whole shell when a detailView is set */}
        <DetailSheet />
      </div>
    </>
  );
}
