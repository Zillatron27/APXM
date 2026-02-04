import { useEffect } from 'react';
import { useGameState } from '../stores/gameState';
import { useMaintenanceDetection } from '../hooks/useMaintenanceDetection';
import { AppShell } from './layout';
import { MaintenanceOverlay } from './MaintenanceOverlay';

export function App() {
  const apexVisible = useGameState((s) => s.apexVisible);
  const unavailable = useMaintenanceDetection();

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

  if (unavailable) {
    return <MaintenanceOverlay />;
  }

  return <AppShell />;
}
