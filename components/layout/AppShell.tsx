import { useGameState } from '../../stores/gameState';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { FloatingReturn } from './FloatingReturn';
import { StatusView } from '../views/StatusView';
import { FleetView } from '../views/FleetView';
import { BasesView } from '../views/BasesView';
import { ContractsView } from '../views/ContractsView';

function ViewContent() {
  const activeTab = useGameState((s) => s.activeTab);

  switch (activeTab) {
    case 'status':
      return <StatusView />;
    case 'fleet':
      return <FleetView />;
    case 'bases':
      return <BasesView />;
    case 'contracts':
      return <ContractsView />;
  }
}

export function AppShell() {
  const apexVisible = useGameState((s) => s.apexVisible);

  if (apexVisible) {
    return <FloatingReturn />;
  }

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col bg-apxm-bg text-apxm-text" style={{ height: '100dvh' }}>
      <Header />
      <main className="flex-1 overflow-y-auto p-4">
        <ViewContent />
      </main>
      <TabBar />
    </div>
  );
}
