import { useEffect } from 'react';
import { useGameState } from '../stores/gameState';
import { AppShell } from './layout';

export function App() {
  const apexVisible = useGameState((s) => s.apexVisible);

  // Control APEX's #app element visibility
  useEffect(() => {
    const apexRoot = document.getElementById('app');
    if (apexRoot) {
      apexRoot.style.display = apexVisible ? '' : 'none';
    }
  }, [apexVisible]);

  return <AppShell />;
}
