/**
 * Burn Status Panel — lists all bases sorted by burn urgency.
 *
 * Critical bases first, then warning, then ok.
 * Click a row to pan camera and open base panel.
 */

import type { EmpireState } from '../empire-state';
import './burn-panel.css';

export interface BurnPanelCallbacks {
  onBaseClick(systemNaturalId: string, planetNaturalId: string): void;
  onClose(): void;
}

interface BurnRow {
  planetName: string;
  planetNaturalId: string;
  systemNaturalId: string;
  status: string;
  days: number | null;
}

const STATUS_PRIORITY: Record<string, number> = {
  critical: 3,
  warning: 2,
  ok: 1,
  unknown: 0,
};

let panelEl: HTMLDivElement | null = null;
let backdropEl: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;

function esc(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

function render(empireState: EmpireState, callbacks: BurnPanelCallbacks): void {
  if (!panelEl) return;

  const body = panelEl.querySelector('.burn-panel-body');
  if (!body) return;

  // Collect burn data from sites + workforce
  const rows: BurnRow[] = [];
  const systemIds = empireState.getOwnedSystemNaturalIds();

  for (const sysId of systemIds) {
    const planetIds = empireState.getOwnedPlanetNaturalIds(sysId);
    for (const planetId of planetIds) {
      const site = empireState.getSiteForPlanet(planetId);
      const workforce = empireState.getWorkforceForPlanet(planetId);
      if (!site) continue;

      rows.push({
        planetName: site.planetName ?? planetId,
        planetNaturalId: planetId,
        systemNaturalId: sysId,
        status: workforce?.burnStatus ?? 'unknown',
        days: workforce?.lowestBurnDays ?? null,
      });
    }
  }

  // Sort: critical first, then warning, then ok, then unknown
  rows.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 0;
    const pb = STATUS_PRIORITY[b.status] ?? 0;
    if (pa !== pb) return pb - pa;
    // Within same status, sort by days ascending (lowest first)
    const da = a.days ?? Infinity;
    const db = b.days ?? Infinity;
    return da - db;
  });

  if (rows.length === 0) {
    body.innerHTML = '<div class="burn-empty">No bases</div>';
    return;
  }

  let html = '';
  for (const row of rows) {
    const daysText = row.days !== null ? `${Math.floor(row.days * 10) / 10}d` : '\u2014';
    const daysClass = row.status === 'critical' ? ' critical' : row.status === 'warning' ? ' warning' : '';
    html += `
      <div class="burn-row" data-system="${esc(row.systemNaturalId)}" data-planet="${esc(row.planetNaturalId)}">
        <span class="burn-dot ${row.status}"></span>
        <div class="burn-info">
          <span class="burn-planet-name">${esc(row.planetName)}<span class="burn-planet-id">${esc(row.planetNaturalId)}</span></span>
        </div>
        <span class="burn-days${daysClass}">${daysText}</span>
      </div>`;
  }

  body.innerHTML = html;

  // Wire click handlers
  body.querySelectorAll<HTMLElement>('.burn-row').forEach((rowEl) => {
    rowEl.addEventListener('click', () => {
      const system = rowEl.dataset.system;
      const planet = rowEl.dataset.planet;
      if (system && planet) {
        callbacks.onBaseClick(system, planet);
      }
    });
  });
}

export function showBurnPanel(
  empireState: EmpireState,
  callbacks: BurnPanelCallbacks,
): void {
  cleanup();

  // Panel
  panelEl = document.createElement('div');
  panelEl.className = 'burn-panel';
  panelEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  panelEl.innerHTML = `
    <div class="burn-panel-header">
      <h3>Burn Status</h3>
      <button class="burn-panel-close">\u00D7</button>
    </div>
    <div class="burn-panel-body"></div>
  `;

  document.body.appendChild(panelEl);

  panelEl.querySelector('.burn-panel-close')!.addEventListener('click', () => {
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

export function hideBurnPanel(): void {
  cleanup();
}

export function isBurnPanelVisible(): boolean {
  return panelEl !== null;
}

export function setBurnPanelMenuOpen(open: boolean): void {
  panelEl?.classList.toggle('menu-open', open);
}

export function getBurnPanelWidth(): number {
  return panelEl ? panelEl.offsetWidth : 0;
}

export function setBurnPanelRightOffset(px: number): void {
  if (panelEl) panelEl.style.right = `${px}px`;
}
