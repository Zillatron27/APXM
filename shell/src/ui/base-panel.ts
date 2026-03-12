/**
 * Base Detail Panel — click detail view for owned planet markers
 *
 * Shows production status, storage utilisation, workforce burn,
 * buffer command buttons, and screen switcher.
 */

import { showManagedPanel, hideManagedPanel, isManagedPanelActive } from './panel-manager';
import { showScreenPicker, hideScreenPicker } from './screen-picker';
import type { EmpireState } from '../empire-state';
import type { ScreenInfo } from '../types/bridge';
import './base-panel.css';

export interface BasePanelCallbacks {
  onBufferCommand(command: string): void;
  onScreenSwitch(screenId: string): void;
  onScreenAssign(planetNaturalId: string, screenId: string | null): void;
  onClose(): void;
}

let container: HTMLDivElement | null = null;
let callbacks: BasePanelCallbacks | null = null;
let currentPlanetNaturalId: string | null = null;
let currentPlanetName: string | null = null;
let currentEmpireState: EmpireState | null = null;

function ensureContainer(): HTMLDivElement {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'base-panel-container';
  document.body.appendChild(container);
  return container;
}

function esc(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function storageClass(pct: number): string {
  if (pct < 70) return 'storage-ok';
  if (pct < 90) return 'storage-warn';
  return 'storage-crit';
}

function burnLabel(status: string): string {
  if (status === 'ok') return 'healthy';
  if (status === 'warning') return 'warning';
  if (status === 'critical') return 'critical';
  return 'unknown';
}

function burnDotClass(status: string): string {
  if (status === 'ok') return 'burn-ok';
  if (status === 'warning') return 'burn-warn';
  if (status === 'critical') return 'burn-crit';
  return 'burn-unknown';
}

function render(): void {
  const el = ensureContainer();
  if (!currentPlanetNaturalId || !currentEmpireState) {
    el.classList.remove('panel-open');
    return;
  }

  const empire = currentEmpireState;
  const site = empire.getSiteForPlanet(currentPlanetNaturalId);
  if (!site) {
    // Base demolished — close panel
    hideBasePanel();
    return;
  }

  const production = empire.getProductionForPlanet(currentPlanetNaturalId);
  const workforce = empire.getWorkforceForPlanet(currentPlanetNaturalId);
  const storage = empire.getStorageForSite(site.siteId);
  const assignedScreen = empire.getAssignedScreenForPlanet(currentPlanetNaturalId);

  const sections: string[] = [];

  // Production
  if (production && production.totalLines > 0) {
    sections.push(`
      <div class="base-panel-section">
        <div class="base-panel-row">
          <span class="base-panel-row-label">Production</span>
          <span class="base-panel-row-value">${production.activeLines} active · ${production.idleLines} idle</span>
        </div>
      </div>
    `);
  } else {
    sections.push(`
      <div class="base-panel-section">
        <div class="base-panel-row">
          <span class="base-panel-row-label">Production</span>
          <span class="base-panel-row-value" style="opacity:0.4">No production</span>
        </div>
      </div>
    `);
  }

  // Storage
  if (storage && (storage.weightCapacity > 0 || storage.volumeCapacity > 0)) {
    const weightPct = storage.weightCapacity > 0 ? (storage.weightUsed / storage.weightCapacity) * 100 : 0;
    const volPct = storage.volumeCapacity > 0 ? (storage.volumeUsed / storage.volumeCapacity) * 100 : 0;
    sections.push(`
      <div class="base-panel-section">
        <div class="base-panel-row">
          <span class="base-panel-row-label">Weight</span>
          <div class="base-storage-bar">
            <div class="base-storage-fill ${storageClass(weightPct)}"
                 style="width: ${weightPct.toFixed(1)}%"></div>
          </div>
          <span class="base-panel-row-value">${weightPct.toFixed(0)}%</span>
        </div>
        <div class="base-panel-row" style="margin-top: 6px">
          <span class="base-panel-row-label">Volume</span>
          <div class="base-storage-bar">
            <div class="base-storage-fill ${storageClass(volPct)}"
                 style="width: ${volPct.toFixed(1)}%"></div>
          </div>
          <span class="base-panel-row-value">${volPct.toFixed(0)}%</span>
        </div>
      </div>
    `);
  }

  // Burn
  if (workforce) {
    const status = workforce.burnStatus;
    const days = workforce.lowestBurnDays;
    const daysText = days !== null ? `${Math.floor(days * 10) / 10}d` : '';
    sections.push(`
      <div class="base-panel-section">
        <div class="base-panel-row">
          <span class="base-panel-row-label">Burn</span>
          <span class="base-panel-row-value">
            <span class="base-burn-dot ${burnDotClass(status)}"></span>
            ${burnLabel(status)}${daysText ? `  ${daysText}` : ''}
          </span>
        </div>
      </div>
    `);
  }

  // Screen button label
  const screenLabel = assignedScreen ? esc(assignedScreen.name) : 'Select Screen';

  const planetDisplayName = currentPlanetName || currentPlanetNaturalId;

  el.innerHTML = `
    <div class="base-panel">
      <div class="base-panel-header">
        <div>
          <h3>${esc(planetDisplayName)}<span class="base-natural-id">${esc(currentPlanetNaturalId)}</span></h3>
        </div>
        <button class="base-panel-close" data-base-close>×</button>
      </div>
      <div class="base-panel-body">
        ${sections.join('')}
      </div>
      <div class="base-actions">
        <button class="base-action-btn" data-base-buffer="BS ${currentPlanetNaturalId}">BS</button>
        <button class="base-action-btn" data-base-buffer="INV ${currentPlanetNaturalId}">INV</button>
        <button class="base-action-btn" data-base-buffer="PROD ${site.siteId}">PROD</button>
        <button class="base-screen-btn" data-base-screen>${screenLabel}</button>
        <button class="base-config-btn" data-base-config>…</button>
      </div>
    </div>
  `;

  el.classList.add('panel-open');
  // Defer wiring so the originating planet click doesn't propagate into new buttons
  setTimeout(() => wireListeners(el), 0);
}

function wireListeners(el: HTMLDivElement): void {
  el.querySelector('[data-base-close]')?.addEventListener('click', () => hideBasePanel());

  el.querySelectorAll<HTMLButtonElement>('[data-base-buffer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.baseBuffer;
      if (cmd && callbacks) callbacks.onBufferCommand(cmd);
    });
  });

  // Screen button: if assigned, switch immediately; else open picker
  el.querySelector('[data-base-screen]')?.addEventListener('click', () => {
    if (!callbacks || !currentEmpireState || !currentPlanetNaturalId) return;
    const assigned = currentEmpireState.getAssignedScreenForPlanet(currentPlanetNaturalId);
    if (assigned) {
      callbacks.onScreenSwitch(assigned.id);
    } else {
      openPicker(el.querySelector<HTMLElement>('[data-base-config]')!);
    }
  });

  // Config button: always opens picker
  el.querySelector('[data-base-config]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPicker(e.currentTarget as HTMLElement);
  });
}

function openPicker(anchorEl: HTMLElement): void {
  if (!callbacks || !currentEmpireState) return;

  const screens = currentEmpireState.getScreens();
  if (!screens) return;
  const visibleScreens = screens.filter((s) => !s.hidden);
  visibleScreens.sort((a, b) => a.name.localeCompare(b.name));

  const planetId = currentPlanetNaturalId!;
  const assignedId = currentEmpireState.getAssignedScreenIdForPlanet(planetId);
  const cbs = callbacks;

  showScreenPicker(
    anchorEl,
    visibleScreens,
    assignedId,
    (screenId: string) => {
      cbs.onScreenAssign(planetId, screenId);
      hideScreenPicker();
      render();
    },
    () => {
      cbs.onScreenAssign(planetId, null);
      hideScreenPicker();
      render();
    },
    () => {
      hideScreenPicker();
    },
  );
}

export function showBasePanel(
  planetNaturalId: string,
  planetName: string,
  screenX: number,
  screenY: number,
  empireState: EmpireState,
  cbs: BasePanelCallbacks,
): void {
  callbacks = cbs;
  currentPlanetNaturalId = planetNaturalId;
  currentPlanetName = planetName;
  currentEmpireState = empireState;

  const el = ensureContainer();
  render();

  showManagedPanel(el, screenX, screenY, () => {
    el.classList.remove('panel-open');
    hideScreenPicker();
    currentPlanetNaturalId = null;
    currentPlanetName = null;
    currentEmpireState = null;
    if (callbacks) callbacks.onClose();
  });
}

export function hideBasePanel(): void {
  hideScreenPicker();
  if (container && isManagedPanelActive(container)) {
    hideManagedPanel();
  }
}

/** Re-render if open. If site no longer exists, close the panel. */
export function updateBasePanel(empireState: EmpireState): void {
  if (!isBasePanelVisible()) return;
  currentEmpireState = empireState;
  render();
}

export function isBasePanelVisible(): boolean {
  return container ? isManagedPanelActive(container) : false;
}
