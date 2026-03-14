/**
 * Fleet Overview Panel — lists all ships with status and location.
 *
 * Idle ships grouped by system, transit ships sorted by ETA ascending.
 * Click a row to pan camera and open ship panel.
 */

import { getSystemByNaturalId, getCxForSystem } from '@27bit/helm';
import type { EmpireState } from '../empire-state';
import './fleet-panel.css';

export interface FleetPanelCallbacks {
  onShipClick(systemNaturalId: string, shipId: string): void;
  onClose(): void;
}

let panelEl: HTMLDivElement | null = null;
let backdropEl: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;

function esc(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function systemDisplayName(naturalId: string | null): string {
  if (!naturalId) return '???';
  const sys = getSystemByNaturalId(naturalId);
  if (!sys) return naturalId;
  const cx = getCxForSystem(sys.id);
  return cx ? cx.ComexCode : sys.naturalId;
}

function formatEta(arrivalMs: number): string {
  const diff = arrivalMs - Date.now();
  if (diff <= 0) return 'arriving';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function cleanup(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (backdropEl) {
    backdropEl.remove();
    backdropEl = null;
  }
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
}

function render(empireState: EmpireState, callbacks: FleetPanelCallbacks): void {
  if (!panelEl) return;

  const body = panelEl.querySelector('.fleet-panel-body');
  if (!body) return;

  const idleBySystem = empireState.getIdleShipsBySystem();
  const inTransit = empireState.getInTransitShips()
    .sort((a, b) => a.flight.arrivalTimestamp - b.flight.arrivalTimestamp);

  let html = '';

  // Idle ships by system
  if (idleBySystem.size > 0) {
    html += '<div class="fleet-section-label">Idle</div>';
    for (const [systemId, ships] of idleBySystem) {
      for (const ship of ships) {
        html += `
          <div class="fleet-ship-row" data-system="${esc(systemId)}" data-ship="${esc(ship.shipId)}">
            <span class="fleet-ship-status idle">\u25CF</span>
            <div class="fleet-ship-info">
              <div class="fleet-ship-name">${esc(ship.name)}<span class="fleet-ship-reg">${esc(ship.registration)}</span></div>
              <div class="fleet-ship-location">${esc(systemDisplayName(systemId))}</div>
            </div>
          </div>`;
      }
    }
  }

  // Transit ships
  if (inTransit.length > 0) {
    html += '<div class="fleet-section-label">In Transit</div>';
    for (const { ship, flight } of inTransit) {
      const from = systemDisplayName(flight.originSystemNaturalId);
      const to = systemDisplayName(flight.destinationSystemNaturalId);
      const eta = formatEta(flight.arrivalTimestamp);
      // Use destination system for click-to-pan
      const targetSystem = flight.destinationSystemNaturalId ?? flight.originSystemNaturalId ?? '';
      html += `
        <div class="fleet-ship-row" data-system="${esc(targetSystem)}" data-ship="${esc(ship.shipId)}">
          <span class="fleet-ship-status transit">\u2192</span>
          <div class="fleet-ship-info">
            <div class="fleet-ship-name">${esc(ship.name)}<span class="fleet-ship-reg">${esc(ship.registration)}</span></div>
            <div class="fleet-ship-location">${esc(from)} \u2192 ${esc(to)} (${esc(eta)})</div>
          </div>
        </div>`;
    }
  }

  if (idleBySystem.size === 0 && inTransit.length === 0) {
    html = '<div class="fleet-empty">No ships</div>';
  }

  body.innerHTML = html;

  // Wire click handlers
  body.querySelectorAll<HTMLElement>('.fleet-ship-row').forEach((row) => {
    row.addEventListener('click', () => {
      const system = row.dataset.system;
      const shipId = row.dataset.ship;
      if (system && shipId) {
        callbacks.onShipClick(system, shipId);
      }
    });
  });
}

export function showFleetPanel(
  empireState: EmpireState,
  callbacks: FleetPanelCallbacks,
): void {
  cleanup();

  // Panel
  panelEl = document.createElement('div');
  panelEl.className = 'fleet-panel';
  panelEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  panelEl.innerHTML = `
    <div class="fleet-panel-header">
      <h3>Fleet Overview</h3>
      <button class="fleet-panel-close">\u00D7</button>
    </div>
    <div class="fleet-panel-body"></div>
  `;

  document.body.appendChild(panelEl);

  panelEl.querySelector('.fleet-panel-close')!.addEventListener('click', () => {
    cleanup();
    callbacks.onClose();
  });

  // Initial render
  render(empireState, callbacks);

  // Live updates
  unsubscribe = empireState.onChange(() => {
    render(empireState, callbacks);
  });

  // Escape key
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      callbacks.onClose();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function hideFleetPanel(): void {
  cleanup();
}

export function isFleetPanelVisible(): boolean {
  return panelEl !== null;
}

export function setFleetPanelMenuOpen(open: boolean): void {
  panelEl?.classList.toggle('menu-open', open);
}

export function getFleetPanelWidth(): number {
  return panelEl ? panelEl.offsetWidth : 0;
}

export function setFleetPanelRightOffset(px: number): void {
  if (panelEl) panelEl.style.right = `${px}px`;
}
