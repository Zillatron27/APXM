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
    <div className="w-full h-screen flex flex-col bg-apxm-bg text-apxm-text overflow-hidden pointer-events-auto">
      <Header />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
        <ViewContent />
      </main>
      <TabBar />
    </div>
  );
}
