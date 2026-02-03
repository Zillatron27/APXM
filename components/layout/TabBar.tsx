import { useGameState, type TabId } from '../../stores/gameState';

const tabs: { id: TabId; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'bases', label: 'Bases' },
  { id: 'contracts', label: 'Contracts' },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useGameState();

  return (
    <nav className="flex bg-apxm-bg border-t border-apxm-surface">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 min-h-touch flex items-center justify-center text-sm relative ${
            activeTab === tab.id ? 'text-prun-yellow' : 'text-apxm-muted hover:text-apxm-text'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-prun-yellow" />
          )}
        </button>
      ))}
    </nav>
  );
}
