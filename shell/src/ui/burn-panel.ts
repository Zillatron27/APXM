/**
 * Burn Status Panel — lists all bases sorted by burn urgency.
 *
 * Critical bases first, then warning, then ok.
 * Expandable rows show material-level burn detail.
 * Inline action buttons open APEX buffers.
 */

import { getActiveThemeId } from '@27bit/helm';
import { getCategoryColors } from './material-colors';
import { MATERIAL_CATEGORIES } from './material-categories';
import type { MaterialTheme } from './material-colors';
import type { BridgeSiteBurnSummary, BurnMaterialSummary } from '../types/bridge';
import type { EmpireState } from '../empire-state';
import { makeDraggable, makeResizable, constrainToViewport, loadLayout, saveLayout, type PanelLayout } from './panel-drag';
import './burn-panel.css';

export interface BurnPanelCallbacks {
  onBaseClick(systemNaturalId: string, planetNaturalId: string): void;
  onBufferCommand(command: string): void;
  onClose(): void;
}

const STATUS_PRIORITY: Record<string, number> = {
  critical: 3,
  warning: 2,
  ok: 1,
  unknown: 0,
};

// Persist across re-renders within panel lifecycle
const expandedPlanets = new Set<string>();
const activeFilters = new Set<string>(['critical', 'warning', 'ok', 'surplus']);

const LAYOUT_KEY = 'apxm-burn-layout';
const PIN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';

let panelEl: HTMLDivElement | null = null;
let backdropEl: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;
let dragCleanup: (() => void) | null = null;
let resizeCleanup: (() => void) | null = null;
let pinned = false;

function cleanup(): void {
  if (dragCleanup) { dragCleanup(); dragCleanup = null; }
  if (resizeCleanup) { resizeCleanup(); resizeCleanup = null; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (backdropEl) { backdropEl.remove(); backdropEl = null; }
  if (panelEl) { panelEl.remove(); panelEl = null; }
}

function currentLayout(): PanelLayout | null {
  if (!panelEl) return null;
  const body = panelEl.querySelector('.burn-panel-body') as HTMLElement | null;
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

function esc(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTheme(): MaterialTheme {
  return getActiveThemeId() === 'prun-classic' ? 'prun' : 'rprun';
}

function formatDays(days: number | null): string {
  if (days === null) return '\u2014';
  if (!isFinite(days)) return '\u221E';
  return `${Math.floor(days * 10) / 10}d`;
}

function renderFilterToggles(): string {
  const filters: Array<{ key: string; label: string; cssClass: string }> = [
    { key: 'critical', label: 'RED', cssClass: 'critical' },
    { key: 'warning', label: 'YLW', cssClass: 'warning' },
    { key: 'ok', label: 'GRN', cssClass: 'ok' },
    { key: 'surplus', label: 'INF', cssClass: 'surplus' },
  ];
  return filters.map(f =>
    `<button class="burn-filter-btn ${f.cssClass}${activeFilters.has(f.key) ? ' active' : ''}" data-burn-filter="${f.key}">${f.label}</button>`
  ).join('');
}

function renderMaterialRows(burns: BurnMaterialSummary[]): string {
  const theme = getTheme();
  const filtered = burns.filter(b =>
    activeFilters.has(b.urgency) && (b.dailyAmount !== 0 || b.inventoryAmount > 0)
  );
  if (filtered.length === 0) return '<div class="burn-mat-empty">No materials match filter</div>';

  // Sort by days ascending (consuming first, surplus last)
  const sorted = [...filtered].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.urgency] ?? 0;
    const pb = STATUS_PRIORITY[b.urgency] ?? 0;
    if (pa !== pb) return pb - pa;
    const da = isFinite(a.daysRemaining) ? a.daysRemaining : Infinity;
    const db = isFinite(b.daysRemaining) ? b.daysRemaining : Infinity;
    return da - db;
  });

  let html = `<div class="burn-mat-table">
    <div class="burn-mat-header">
      <span class="burn-mat-col ticker">Ticker</span>
      <span class="burn-mat-col inv">Inv</span>
      <span class="burn-mat-col rate">Burn/d</span>
      <span class="burn-mat-col days">Days</span>
      <span class="burn-mat-col need">Need</span>
      <span class="burn-mat-col buy"></span>
    </div>`;

  for (const b of sorted) {
    const slug = MATERIAL_CATEGORIES[b.materialTicker.toUpperCase()] ?? '';
    const c = getCategoryColors(slug, theme);
    const daysText = formatDays(b.daysRemaining === Infinity ? null : b.daysRemaining);
    const rateText = b.dailyAmount !== 0 ? b.dailyAmount.toFixed(1) : '\u2014';
    const needText = b.need > 0 ? Math.ceil(b.need).toLocaleString() : '\u2014';
    const urgencyClass = b.urgency;

    html += `
      <div class="burn-mat-row ${urgencyClass}">
        <span class="burn-mat-col ticker"><span class="burn-mat-ticker" style="background:${c.bg}; color:${c.text}">${esc(b.materialTicker)}</span></span>
        <span class="burn-mat-col inv">${b.inventoryAmount.toLocaleString()}</span>
        <span class="burn-mat-col rate">${rateText}</span>
        <span class="burn-mat-col days">${daysText}</span>
        <span class="burn-mat-col need">${needText}</span>
        <span class="burn-mat-col buy"><button class="burn-buy-btn" data-burn-buffer="CXM ${esc(b.materialTicker)}">Buy</button></span>
      </div>`;
  }

  html += '</div>';
  return html;
}

function render(empireState: EmpireState, callbacks: BurnPanelCallbacks): void {
  if (!panelEl) return;

  const body = panelEl.querySelector('.burn-panel-body');
  if (!body) return;

  const siteBurns = empireState.getSiteBurns();

  // Sort by urgency, then by days ascending
  const sorted = [...siteBurns].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.burnStatus] ?? 0;
    const pb = STATUS_PRIORITY[b.burnStatus] ?? 0;
    if (pa !== pb) return pb - pa;
    const da = a.lowestBurnDays ?? Infinity;
    const db = b.lowestBurnDays ?? Infinity;
    return da - db;
  });

  // Filter bases by burn status (unknown always shown)
  const filtered = sorted.filter(s =>
    s.burnStatus === 'unknown' || activeFilters.has(s.burnStatus)
  );

  if (filtered.length === 0) {
    body.innerHTML = '<div class="burn-empty">No bases match filter</div>';
    return;
  }

  let html = '';
  for (const site of filtered) {
    const planetId = site.planetNaturalId ?? '';
    const isExpanded = expandedPlanets.has(planetId);
    const daysText = formatDays(site.lowestBurnDays);
    const daysClass = site.burnStatus === 'critical' ? ' critical' : site.burnStatus === 'warning' ? ' warning' : '';

    html += `
      <div class="burn-row${isExpanded ? ' expanded' : ''}" data-system="${esc(site.systemNaturalId ?? '')}" data-planet="${esc(planetId)}" data-site="${esc(site.siteId)}">
        <div class="burn-row-collapsed">
          <span class="burn-dot ${site.burnStatus}"></span>
          <div class="burn-info">
            <span class="burn-planet-name">${esc(site.planetName ?? planetId)}<span class="burn-planet-id">${esc(planetId)}</span></span>
          </div>
          <div class="burn-row-right">
            <div class="burn-row-actions">
              <button class="burn-inline-btn" data-burn-buffer="BS ${esc(planetId)}">BS</button>
              <button class="burn-inline-btn" data-burn-buffer="INV ${esc(planetId)}">INV</button>
            </div>
            <span class="burn-days${daysClass}">${daysText}</span>
          </div>
        </div>`;

    if (isExpanded) {
      html += `
        <div class="burn-row-detail">
          ${renderMaterialRows(site.burns)}
        </div>`;
    }

    html += '</div>';
  }

  body.innerHTML = html;

  // Wire expand/collapse on collapsed row click
  body.querySelectorAll<HTMLElement>('.burn-row-collapsed').forEach((rowEl) => {
    rowEl.addEventListener('click', (e) => {
      // Don't expand if clicking an action button
      if ((e.target as HTMLElement).closest('[data-burn-buffer]')) return;
      const parent = rowEl.closest('.burn-row') as HTMLElement;
      const planet = parent?.dataset.planet;
      if (!planet) return;
      if (expandedPlanets.has(planet)) {
        expandedPlanets.delete(planet);
      } else {
        expandedPlanets.add(planet);
      }
      const toggle = panelEl?.querySelector('#burn-expand-toggle');
      if (toggle) toggle.textContent = expandedPlanets.size > 0 ? 'Collapse All' : 'Expand All';
      render(empireState, callbacks);
    });
  });

  // Wire body-level buffer command buttons (inline BS/INV/Buy — NOT header ACTS)
  body.querySelectorAll<HTMLButtonElement>('[data-burn-buffer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cmd = btn.dataset.burnBuffer;
      if (cmd) callbacks.onBufferCommand(cmd);
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

  const showActionPackages = empireState.isRprunDetected() && !empireState.isRprunFeaturesDisabled();
  panelEl.innerHTML = `
    <div class="burn-panel-header">
      <h3>Burn Status</h3>
      ${showActionPackages ? '<button class="burn-acts-btn">ACTS</button>' : ''}
      <div class="burn-filter-group">${renderFilterToggles()}</div>
      <button class="panel-pin-btn${pinned ? ' pinned' : ''}">${PIN_SVG}</button>
      <button class="burn-panel-close">\u00D7</button>
    </div>
    <div class="burn-panel-toolbar">
      <button class="burn-expand-btn" id="burn-expand-toggle">Expand All</button>
    </div>
    <div class="burn-panel-body"></div>
  `;

  document.body.appendChild(panelEl);

  panelEl.querySelector('.burn-panel-close')!.addEventListener('click', () => {
    cleanup();
    callbacks.onClose();
  });

  // Wire header ACTS button (once, not per-render)
  const actsBtn = panelEl.querySelector('.burn-acts-btn');
  if (actsBtn) {
    actsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onBufferCommand('XIT ACTION');
    });
  }

  // Wire filter toggles (once, not per-render)
  panelEl.querySelectorAll<HTMLButtonElement>('[data-burn-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.burnFilter;
      if (!key) return;
      if (activeFilters.has(key)) activeFilters.delete(key);
      else activeFilters.add(key);
      // Update toggle appearance
      btn.classList.toggle('active', activeFilters.has(key));
      render(empireState, callbacks);
    });
  });

  // Wire expand/collapse toggle
  const expandToggle = panelEl.querySelector('#burn-expand-toggle') as HTMLButtonElement;
  expandToggle.addEventListener('click', () => {
    if (expandedPlanets.size > 0) {
      expandedPlanets.clear();
    } else {
      for (const site of empireState.getSiteBurns()) {
        if (site.planetNaturalId) expandedPlanets.add(site.planetNaturalId);
      }
    }
    expandToggle.textContent = expandedPlanets.size > 0 ? 'Collapse All' : 'Expand All';
    render(empireState, callbacks);
  });

  const headerEl = panelEl.querySelector('.burn-panel-header') as HTMLElement;
  const bodyEl = panelEl.querySelector('.burn-panel-body') as HTMLElement;

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

  // 2. Constrain to viewport (shrinks body if panel would overflow)
  constrainToViewport(panelEl, bodyEl);

  // 3. Wire drag + resize (maintains constraints going forward)
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
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !pinned) {
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

