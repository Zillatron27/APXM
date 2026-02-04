import { useEffect } from 'react';
import { useGameState } from '../stores/gameState';
import { AppShell } from './layout';

export function App() {
  const apexVisible = useGameState((s) => s.apexVisible);

  // Control APEX's #container element visibility and offset for FloatingReturn bar
  useEffect(() => {
    const apexRoot = document.getElementById('container');
    if (!apexRoot) return;

    if (apexVisible) {
      apexRoot.style.display = '';
      apexRoot.style.marginTop = '2.75rem';
    } else {
      apexRoot.style.display = 'none';
      apexRoot.style.marginTop = '';
    }
  }, [apexVisible]);

  return <AppShell />;
}
