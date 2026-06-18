import { useGameState, type TabId } from '../../stores/gameState';

interface TabConfig {
  id: TabId;
  label?: string;
  icon?: string;
}

const tabs: TabConfig[] = [
  { id: 'status', label: 'STATUS' },
  { id: 'bases', label: 'BASE' },
  { id: 'fleet', label: 'FLEET' },
  { id: 'contracts', label: 'CONTS' },
  { id: 'settings', label: 'SET' },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useGameState();

  return (
    <nav className="flex bg-apxm-bg border-t border-apxm-surface">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 min-h-touch flex items-center justify-center relative font-mono text-sm font-semibold tracking-wide uppercase border-l border-apxm-surface first:border-l-0 ${
            activeTab === tab.id ? 'text-prun-yellow' : 'text-apxm-muted hover:text-apxm-text'
          }`}
        >
          {tab.label ?? tab.icon}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-prun-yellow" />
          )}
        </button>
      ))}
    </nav>
  );
}
