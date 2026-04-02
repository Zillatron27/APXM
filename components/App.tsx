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
  // When showing APEX, make the shadow host semi-transparent so APEX shows through.
  useEffect(() => {
    const host = document.querySelector('apxm-overlay') as HTMLElement | null;
    if (host) {
      host.classList.toggle('apex-visible', apexVisible);
      if (apexVisible) {
        host.style.opacity = '0.3';
        host.style.pointerEvents = 'none';
      } else {
        host.style.opacity = '';
        host.style.pointerEvents = '';
      }
    }
  }, [apexVisible]);

  // Manage #container visibility and offset when toggling APEX.
  // When APEX visible: ensure display, offset below FloatingReturn bar.
  // When APEX hidden: clear all inline styles (CSS overlay covers APEX).
  // Uses different properties (display/margin) than the buffer refresh engine
  // (visibility/position/left), so no conflict between the two.
  useEffect(() => {
    function apply(el: HTMLElement): void {
      if (apexVisible) {
        el.style.display = '';
        el.style.marginTop = '2.75rem';
        el.style.height = 'calc(100dvh - 2.75rem)';
        el.style.overflow = 'auto';
      } else {
        el.style.marginTop = '';
        el.style.height = '';
        el.style.overflow = '';
        el.style.display = '';
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
