import { useEffect } from 'react';
import { useGameState } from '../stores/gameState';
import { useMaintenanceDetection } from '../hooks/useMaintenanceDetection';
import { AppShell } from './layout';
import { MaintenanceOverlay } from './MaintenanceOverlay';

export function App() {
  const apexVisible = useGameState((s) => s.apexVisible);
  const unavailable = useMaintenanceDetection();

  // Toggle shadow host between opaque fullscreen (APXM) and collapsed transparent
  // (APEX). The :host(.apex-visible) CSS rule in styles.css handles the visual
  // switch — we just toggle the class on the shadow host element.
  useEffect(() => {
    const host = document.querySelector('apxm-overlay');
    if (host) {
      host.classList.toggle('apex-visible', apexVisible);
    }
  }, [apexVisible]);

  // Offset PrUn's #container below the FloatingReturn bar when APEX is visible.
  useEffect(() => {
    function apply(el: HTMLElement): void {
      if (apexVisible) {
        el.style.marginTop = '2.75rem';
        el.style.height = 'calc(100vh - 2.75rem)';
        el.style.overflow = 'auto';
      } else {
        el.style.marginTop = '';
        el.style.height = '';
        el.style.overflow = '';
      }
    }

    const existing = document.getElementById('container');
    if (existing) {
      apply(existing);
      return;
    }

    // #container may not exist yet — PrUn creates it after scripts load
    const observer = new MutationObserver(() => {
      const el = document.getElementById('container');
      if (el) {
        observer.disconnect();
        apply(el);
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [apexVisible]);

  if (unavailable) {
    return <MaintenanceOverlay />;
  }

  return <AppShell />;
}
