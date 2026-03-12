/**
 * Ship Info Panel — click detail view for ship markers
 *
 * Shows condition, flight info, cargo, fuel, and buffer command button.
 * Multi-ship groups get prev/next navigation.
 */

import { getSystemByNaturalId, getCxForSystem, getActiveThemeId, onThemeChange, offThemeChange } from '@27bit/helm';
import { getCategoryColors } from './material-colors';
import { MATERIAL_CATEGORIES } from './material-categories';
import type { MaterialTheme } from './material-colors';
import type { ShipSummary, FlightSummary } from '../types/bridge';
import { showManagedPanel, hideManagedPanel, isManagedPanelActive } from './panel-manager';
import './ship-panel.css';

export interface ShipPanelCallbacks {
  onBufferCommand(command: string): void;
  onClose(): void;
}

let container: HTMLDivElement | null = null;
let callbacks: ShipPanelCallbacks | null = null;
let currentShips: ShipSummary[] = [];
let currentFlights: FlightSummary[] = [];
let currentIndex = 0;
let trackedShipId: string | null = null;
let themeListener: (() => void) | null = null;

function getTheme(): MaterialTheme {
  return getActiveThemeId() === 'prun-classic' ? 'prun' : 'rprun';
}

function ensureContainer(): HTMLDivElement {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'ship-panel-container';
  document.body.appendChild(container);
  return container;
}

function systemName(naturalId: string | null): string {
  if (!naturalId) return '???';
  const sys = getSystemByNaturalId(naturalId);
  if (!sys) return naturalId;
  const cx = getCxForSystem(sys.id);
  return cx ? cx.ComexCode : sys.naturalId;
}

function formatLocalTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatEta(arrivalMs: number): string {
  const delta = arrivalMs - Date.now();
  if (delta <= 0) return 'Arrived';
  const local = formatLocalTime(arrivalMs);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return `< 1m (${local})`;
  const hours = Math.floor(mins / 60);
  if (hours < 1) return `${mins}m (${local})`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours}h ${mins % 60}m (${local})`;
  return `${days}d ${hours % 24}h (${local})`;
}

function conditionClass(pct: number): string {
  if (pct > 0.8) return 'cond-good';
  if (pct > 0.5) return 'cond-warn';
  return 'cond-crit';
}

function renderShip(ship: ShipSummary, flight: FlightSummary | undefined): string {
  const theme = getTheme();
  const sections: string[] = [];

  // Condition
  const condPct = ship.condition;
  sections.push(`
    <div class="ship-panel-section">
      <div class="ship-panel-section-label">Condition</div>
      <div class="ship-condition-bar">
        <div class="ship-condition-fill ${conditionClass(condPct)}"
             style="width: ${(condPct * 100).toFixed(1)}%"></div>
      </div>
      <div class="ship-condition-text">${(condPct * 100).toFixed(1)}%</div>
    </div>
  `);

  // Flight
  if (flight) {
    const origin = systemName(flight.originSystemNaturalId);
    const dest = systemName(flight.destinationSystemNaturalId);
    const eta = formatEta(flight.arrivalTimestamp);
    const seg = flight.segments[flight.currentSegmentIndex];
    const segInfo = seg ? `${seg.type} — segment ${flight.currentSegmentIndex + 1}/${flight.segments.length}` : '';
    sections.push(`
      <div class="ship-panel-section">
        <div class="ship-panel-section-label">Flight</div>
        <div class="ship-flight-route">
          ${origin}<span class="route-arrow">→</span>${dest}
        </div>
        <div class="ship-flight-eta">ETA ${eta}</div>
        ${segInfo ? `<div class="ship-flight-segment">${segInfo}</div>` : ''}
      </div>
    `);
  }

  // Cargo
  if (ship.cargo && ship.cargo.items.length > 0) {
    const wPct = ship.cargo.weightCapacity > 0
      ? ((ship.cargo.weightUsed / ship.cargo.weightCapacity) * 100).toFixed(0) : '0';
    const vPct = ship.cargo.volumeCapacity > 0
      ? ((ship.cargo.volumeUsed / ship.cargo.volumeCapacity) * 100).toFixed(0) : '0';
    const tiles = ship.cargo.items.map(item => {
      const categorySlug = MATERIAL_CATEGORIES[item.ticker.toUpperCase()] ?? '';
      const c = getCategoryColors(categorySlug, theme);
      return `<span class="ship-cargo-tile" style="border-color:${c.text}; color:${c.text}">
        <span class="tile-ticker">${item.ticker}</span>
        <span class="tile-amount">${item.amount}</span>
      </span>`;
    }).join('');
    sections.push(`
      <div class="ship-panel-section">
        <div class="ship-panel-section-label">Cargo</div>
        <div class="ship-cargo-summary">${wPct}% weight · ${vPct}% volume</div>
        <div class="ship-cargo-grid">${tiles}</div>
      </div>
    `);
  }

  // Fuel
  if (ship.fuel) {
    const fuelRows: string[] = [];
    if (ship.fuel.stlWeightCapacity > 0) {
      const pct = (ship.fuel.stlWeightUsed / ship.fuel.stlWeightCapacity * 100).toFixed(0);
      fuelRows.push(`
        <div class="ship-fuel-row">
          <span class="ship-fuel-label">STL</span>
          <div class="ship-fuel-bar">
            <div class="ship-fuel-fill" style="width:${pct}%"></div>
          </div>
          <span class="ship-fuel-text">${ship.fuel.stlWeightUsed.toFixed(1)}/${ship.fuel.stlWeightCapacity.toFixed(1)}t</span>
        </div>
      `);
    }
    if (ship.fuel.ftlWeightCapacity > 0) {
      const pct = (ship.fuel.ftlWeightUsed / ship.fuel.ftlWeightCapacity * 100).toFixed(0);
      fuelRows.push(`
        <div class="ship-fuel-row">
          <span class="ship-fuel-label">FTL</span>
          <div class="ship-fuel-bar">
            <div class="ship-fuel-fill" style="width:${pct}%"></div>
          </div>
          <span class="ship-fuel-text">${ship.fuel.ftlWeightUsed.toFixed(1)}/${ship.fuel.ftlWeightCapacity.toFixed(1)}t</span>
        </div>
      `);
    }
    if (fuelRows.length > 0) {
      sections.push(`
        <div class="ship-panel-section">
          <div class="ship-panel-section-label">Fuel</div>
          ${fuelRows.join('')}
        </div>
      `);
    }
  }

  return sections.join('');
}

function render(): void {
  const el = ensureContainer();
  if (currentShips.length === 0) {
    el.classList.remove('panel-open');
    return;
  }

  const ship = currentShips[currentIndex];
  if (!ship) return;
  trackedShipId = ship.shipId;
  const flight = currentFlights.find(f => f.shipId === ship.shipId);

  const multi = currentShips.length > 1;
  const navHtml = multi ? `
    <div class="ship-nav">
      <button data-ship-nav="prev" ${currentIndex === 0 ? 'disabled' : ''}>◀</button>
      <span class="ship-nav-label">${currentIndex + 1} of ${currentShips.length}</span>
      <button data-ship-nav="next" ${currentIndex === currentShips.length - 1 ? 'disabled' : ''}>▶</button>
    </div>
  ` : '';

  el.innerHTML = `
    <div class="ship-panel">
      <div class="ship-panel-header">
        <div>
          <h3>${ship.name}<span class="ship-reg">${ship.registration}</span></h3>
          <span class="ship-blueprint">${ship.blueprintNaturalId}</span>
        </div>
        <button class="ship-panel-close" data-ship-close>×</button>
      </div>
      ${navHtml}
      <div class="ship-panel-body">
        ${renderShip(ship, flight)}
      </div>
      <div class="ship-action">
        <button data-ship-buffer="SFC ${ship.registration}">Open Flight Control</button>
      </div>
    </div>
  `;

  el.classList.add('panel-open');
  wireListeners(el);
}

function wireListeners(el: HTMLDivElement): void {
  el.querySelector('[data-ship-close]')?.addEventListener('click', () => hidePanel());
  el.querySelector('[data-ship-nav="prev"]')?.addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; render(); }
  });
  el.querySelector('[data-ship-nav="next"]')?.addEventListener('click', () => {
    if (currentIndex < currentShips.length - 1) { currentIndex++; render(); }
  });
  const bufBtn = el.querySelector<HTMLButtonElement>('[data-ship-buffer]');
  if (bufBtn) {
    bufBtn.addEventListener('click', () => {
      const cmd = bufBtn.dataset.shipBuffer;
      if (cmd && callbacks) callbacks.onBufferCommand(cmd);
    });
  }
}

export function showPanel(
  ships: ShipSummary[],
  flights: FlightSummary[],
  screenX: number,
  screenY: number,
  cbs: ShipPanelCallbacks,
): void {
  callbacks = cbs;
  currentShips = ships;
  currentFlights = flights;
  currentIndex = 0;

  // Re-render cargo colors on theme change
  if (!themeListener) {
    themeListener = () => { if (isPanelVisible()) render(); };
    onThemeChange(themeListener);
  }

  const el = ensureContainer();
  render();

  showManagedPanel(el, screenX, screenY, () => {
    // Called by panel-manager when dismissing (click-outside or another panel opening)
    el.classList.remove('panel-open');
    currentShips = [];
    currentFlights = [];
    trackedShipId = null;
    if (callbacks) callbacks.onClose();
  });
}

export function hidePanel(): void {
  hideManagedPanel();
}

export function isPanelVisible(): boolean {
  return container ? isManagedPanelActive(container) : false;
}

/** Re-render if the tracked ship is in the updated data */
export function updatePanel(ships: ShipSummary[], flights: FlightSummary[]): void {
  if (!isPanelVisible() || !trackedShipId) return;
  const newShip = ships.find(s => s.shipId === trackedShipId);
  if (!newShip) {
    hidePanel();
    return;
  }
  // Update data arrays and re-render keeping the tracked ship
  currentShips = currentShips.map(s => ships.find(ns => ns.shipId === s.shipId) ?? s);
  currentFlights = flights;
  render();
}

export function destroyPanel(): void {
  if (themeListener) {
    offThemeChange(themeListener);
    themeListener = null;
  }
  container?.remove();
  container = null;
}
