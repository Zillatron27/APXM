/**
 * Fleet Overview Panel — lists all ships with status and location.
 *
 * Idle ships grouped by system, transit ships sorted by ETA ascending.
 * Click a row to pan camera and open ship panel.
 */

import { getCategoryColors } from './material-colors';
import { MATERIAL_CATEGORIES } from './material-categories';
import { esc, systemDisplayName, getTheme } from './panel-utils';
import type { ShipSummary } from '../types/bridge';
import type { EmpireState } from '../empire-state';
import { makeDraggable, makeResizable, constrainToViewport, loadLayout, saveLayout, PIN_SVG, type PanelLayout } from './panel-drag';
import './panel-common.css';
import './fleet-panel.css';

function hasShipDetail(ship: ShipSummary): boolean {
  const hasCargo = ship.cargo && ship.cargo.items.length > 0;
  const hasFuel = ship.fuel && (ship.fuel.stlUnitCapacity > 0 || ship.fuel.ftlUnitCapacity > 0);
  return !!(hasCargo || hasFuel);
}

function renderShipDetail(ship: ShipSummary): string {
  const rows: string[] = [];

  // Fuel bars (top, side by side)
  if (ship.fuel && (ship.fuel.stlUnitCapacity > 0 || ship.fuel.ftlUnitCapacity > 0)) {
    let fuelHtml = '<div class="fleet-bar-row">';
    if (ship.fuel.stlUnitCapacity > 0) {
      const pct = ((ship.fuel.stlUnits / ship.fuel.stlUnitCapacity) * 100).toFixed(0);
      fuelHtml += `
        <span class="fleet-bar-label">S</span>
        <div class="fleet-bar"><div class="fleet-fuel-fill" style="width:${pct}%"></div></div>
        <span class="fleet-bar-text">${ship.fuel.stlUnits}/${ship.fuel.stlUnitCapacity}</span>`;
    }
    if (ship.fuel.ftlUnitCapacity > 0) {
      const pct = ((ship.fuel.ftlUnits / ship.fuel.ftlUnitCapacity) * 100).toFixed(0);
      fuelHtml += `
        <span class="fleet-bar-label">F</span>
        <div class="fleet-bar"><div class="fleet-fuel-fill" style="width:${pct}%"></div></div>
        <span class="fleet-bar-text">${ship.fuel.ftlUnits}/${ship.fuel.ftlUnitCapacity}</span>`;
    }
    fuelHtml += '</div>';
    rows.push(fuelHtml);
  }

  // Separator between fuel and cargo
  if (ship.fuel && (ship.fuel.stlUnitCapacity > 0 || ship.fuel.ftlUnitCapacity > 0) && ship.cargo) {
    rows.push('<div class="fleet-detail-sep"></div>');
  }

  // Cargo bars (middle, side by side)
  if (ship.cargo) {
    const wPct = ship.cargo.weightCapacity > 0
      ? ((ship.cargo.weightUsed / ship.cargo.weightCapacity) * 100).toFixed(0) : '0';
    const vPct = ship.cargo.volumeCapacity > 0
      ? ((ship.cargo.volumeUsed / ship.cargo.volumeCapacity) * 100).toFixed(0) : '0';
    rows.push(`<div class="fleet-bar-row">
      <span class="fleet-bar-label">W</span>
      <div class="fleet-bar"><div class="fleet-cargo-fill" style="width:${wPct}%"></div></div>
      <span class="fleet-bar-text">${Math.round(ship.cargo.weightUsed)}/${Math.round(ship.cargo.weightCapacity)}t</span>
      <span class="fleet-bar-label">V</span>
      <div class="fleet-bar"><div class="fleet-cargo-fill" style="width:${vPct}%"></div></div>
      <span class="fleet-bar-text">${Math.round(ship.cargo.volumeUsed)}/${Math.round(ship.cargo.volumeCapacity)}m\u00B3</span>
    </div>`);

    // Cargo tiles (bottom)
    if (ship.cargo.items.length > 0) {
      const theme = getTheme();
      const tiles = ship.cargo.items.map(item => {
        const slug = MATERIAL_CATEGORIES[item.ticker.toUpperCase()] ?? '';
        const c = getCategoryColors(slug, theme);
        return `<span class="fleet-cargo-tile" style="border-color:${c.text}; color:${c.text}">${item.ticker} \u00D7${item.amount}</span>`;
      }).join('');
      rows.push(`<div class="fleet-cargo-tiles fleet-tiles-spaced">${tiles}</div>`);
    }
  }

  if (rows.length === 0) return '';
  return `<div class="fleet-detail">${rows.join('')}</div>`;
}

export interface FleetPanelCallbacks {
  onShipClick(systemNaturalId: string, shipId: string): void;
  onBufferCommand(command: string): void;
  onClose(): void;
}

const LAYOUT_KEY = 'apxm-fleet-layout';

let panelEl: HTMLDivElement | null = null;
let backdropEl: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;
let dragCleanup: (() => void) | null = null;
let resizeCleanup: (() => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let pinned = false;

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
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
  if (dragCleanup) { dragCleanup(); dragCleanup = null; }
  if (resizeCleanup) { resizeCleanup(); resizeCleanup = null; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (backdropEl) { backdropEl.remove(); backdropEl = null; }
  if (panelEl) { panelEl.remove(); panelEl = null; }
}

function currentLayout(): PanelLayout | null {
  if (!panelEl) return null;
  const body = panelEl.querySelector('.fleet-panel-body') as HTMLElement | null;
  return {
    x: panelEl.offsetLeft,
    y: panelEl.offsetTop,
    height: body?.offsetHeight ?? 300,
    pinned,
  };
}

function persistLayout(): void {
  const layout = currentLayout();
  if (layout) saveLayout(LAYOUT_KEY, layout);
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
        const detail = hasShipDetail(ship);
        html += `
          <div class="fleet-ship-row${detail ? ' transit-row' : ''}" data-system="${esc(systemId)}" data-ship="${esc(ship.shipId)}">
            ${detail ? '<div class="fleet-ship-top">' : ''}
            <span class="fleet-ship-status idle">\u25CF</span>
            <div class="fleet-ship-info">
              <div class="fleet-ship-name">${esc(ship.name)}</div>
              <div class="fleet-ship-location">${esc(systemDisplayName(systemId))}</div>
            </div>
            <div class="fleet-ship-actions">
              <button class="fleet-action-btn" data-fleet-buffer="SFC ${esc(ship.registration)}">Fly</button>
              <button class="fleet-action-btn" data-fleet-buffer="SHPI ${esc(ship.registration)}">Cargo</button>
              <button class="fleet-action-btn" data-fleet-buffer="SHPF ${esc(ship.registration)}">Fuel</button>
            </div>
            ${detail ? '</div>' : ''}
            ${detail ? renderShipDetail(ship) : ''}
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
        <div class="fleet-ship-row transit-row" data-system="${esc(targetSystem)}" data-ship="${esc(ship.shipId)}">
          <div class="fleet-ship-top">
            <span class="fleet-ship-status transit">\u2192</span>
            <div class="fleet-ship-info">
              <div class="fleet-ship-name">${esc(ship.name)}</div>
              <div class="fleet-ship-location">${esc(from)} \u2192 ${esc(to)} (${esc(eta)})</div>
            </div>
            <div class="fleet-ship-actions">
              <button class="fleet-action-btn" data-fleet-buffer="SFC ${esc(ship.registration)}">Fly</button>
              <button class="fleet-action-btn" data-fleet-buffer="SHPI ${esc(ship.registration)}">Cargo</button>
              <button class="fleet-action-btn" data-fleet-buffer="SHPF ${esc(ship.registration)}">Fuel</button>
            </div>
          </div>
          ${renderShipDetail(ship)}
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

  // Wire buffer command buttons (stopPropagation to avoid row click)
  body.querySelectorAll<HTMLButtonElement>('[data-fleet-buffer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cmd = btn.dataset.fleetBuffer;
      if (cmd) callbacks.onBufferCommand(cmd);
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

  const showActs = empireState.isRprunDetected() && !empireState.isRprunFeaturesDisabled();
  panelEl.innerHTML = `
    <div class="fleet-panel-header">
      <h3>Fleet Overview</h3>
      ${showActs ? '<button class="fleet-acts-btn">ACTS</button>' : ''}
      <button class="panel-pin-btn${pinned ? ' pinned' : ''}">${PIN_SVG}</button>
      <button class="fleet-panel-close">\u00D7</button>
    </div>
    <div class="fleet-panel-body"></div>
  `;

  document.body.appendChild(panelEl);

  panelEl.querySelector('.fleet-panel-close')!.addEventListener('click', () => {
    cleanup();
    callbacks.onClose();
  });

  // Wire ACTS button (once)
  const actsBtn = panelEl.querySelector('.fleet-acts-btn');
  if (actsBtn) {
    actsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onBufferCommand('XIT ACTION');
    });
  }

  const headerEl = panelEl.querySelector('.fleet-panel-header') as HTMLElement;
  const bodyEl = panelEl.querySelector('.fleet-panel-body') as HTMLElement;

  // 1. Set position + height (from saved layout or defaults)
  const saved = loadLayout(LAYOUT_KEY);
  if (saved) {
    panelEl.style.left = `${saved.x}px`;
    panelEl.style.top = `${saved.y}px`;
    bodyEl.style.height = `${saved.height}px`;
    pinned = saved.pinned;
  } else {
    panelEl.style.left = `${window.innerWidth - 420}px`;
    panelEl.style.top = '54px';
    bodyEl.style.height = `${Math.floor(window.innerHeight * 0.4)}px`;
  }

  // 2. Constrain to viewport
  constrainToViewport(panelEl, bodyEl);

  // 3. Wire drag + resize
  dragCleanup = makeDraggable(panelEl, headerEl, { onDragEnd: () => persistLayout() });
  resizeCleanup = makeResizable(panelEl, bodyEl, { onResizeEnd: () => persistLayout() });

  // Pin toggle
  const pinBtn = panelEl.querySelector('.panel-pin-btn') as HTMLButtonElement;
  pinBtn.classList.toggle('pinned', pinned);
  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    pinBtn.classList.toggle('pinned', pinned);
    persistLayout();
  });

  // Initial render
  render(empireState, callbacks);

  // Live updates
  unsubscribe = empireState.onChange(() => {
    render(empireState, callbacks);
  });

  // Escape key (gated on pin state)
  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !pinned) {
      cleanup();
      callbacks.onClose();
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

