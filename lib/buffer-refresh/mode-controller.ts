/**
 * Refresh mode controller.
 *
 * Module-level variable for fast non-React access (engine, batch).
 * Synced to useRefreshState.mode so React components re-render
 * when the debug panel changes the mode.
 *
 * Not persisted — resets to 'manual' (or URL param) on page reload.
 */

import type { RefreshMode } from './types';
import { useRefreshState } from '../../stores/refreshState';

let currentMode: RefreshMode = 'manual';

/** Initialize mode from URL param. Call once at startup. */
export function initRefreshMode(): void {
  const params = new URLSearchParams(location.search);
  const param = params.get('apxm_refresh');

  if (param === 'manual' || param === 'batch' || param === 'auto') {
    currentMode = param;
  } else {
    currentMode = 'manual';
  }

  useRefreshState.getState().setMode(currentMode);
}

/** Read current mode (fast, no store overhead). */
export function getRefreshMode(): RefreshMode {
  return currentMode;
}

/** Update mode — syncs both module variable and Zustand store. */
export function setRefreshMode(mode: RefreshMode): void {
  currentMode = mode;
  useRefreshState.getState().setMode(mode);
}

export function isAutoRefreshEnabled(): boolean {
  return currentMode === 'auto';
}

export function isBatchModeEnabled(): boolean {
  return currentMode === 'batch';
}

// -- Debug panel mode selector (vanilla DOM, matches diagnostics.ts pattern) --

const MODE_OPTIONS: RefreshMode[] = ['manual', 'batch', 'auto'];
const ACTIVE_COLOR = '#ff8c00'; // PrUn orange
const INACTIVE_COLOR = '#666';

/**
 * Build a mode selector row and append it to the given parent element.
 * Designed for the diagnostics panel — vanilla DOM, no React.
 */
export function createDebugModeSelector(parentEl: HTMLElement): void {
  const row = document.createElement('div');
  row.setAttribute('style', 'margin-top:8px;display:flex;gap:4px;align-items:center');

  const label = document.createElement('span');
  label.setAttribute('style', 'color:#999;font-size:11px;margin-right:4px');
  label.textContent = 'Refresh:';
  row.appendChild(label);

  const buttons: HTMLButtonElement[] = [];

  for (const mode of MODE_OPTIONS) {
    const btn = document.createElement('button');
    btn.textContent = mode.toUpperCase();
    btn.setAttribute('style', buildButtonStyle(mode === currentMode));
    btn.style.pointerEvents = 'auto';

    btn.addEventListener('click', () => {
      setRefreshMode(mode);
      // Update all button styles
      for (let i = 0; i < MODE_OPTIONS.length; i++) {
        buttons[i].setAttribute('style', buildButtonStyle(MODE_OPTIONS[i] === mode));
        buttons[i].style.pointerEvents = 'auto';
      }
    });

    buttons.push(btn);
    row.appendChild(btn);
  }

  parentEl.appendChild(row);
}

function buildButtonStyle(active: boolean): string {
  const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  const bg = active ? 'rgba(255,140,0,0.15)' : 'transparent';
  return [
    `color:${color}`,
    `background:${bg}`,
    `border:1px solid ${color}`,
    'border-radius:2px',
    'padding:2px 6px',
    'font-family:monospace',
    'font-size:10px',
    'font-weight:bold',
    'cursor:pointer',
  ].join(';');
}
