/**
 * Warehouse Dropdown — lists all warehouses with INV action buttons.
 *
 * Positioned below the toolbar button, closes on outside click or Escape.
 */

import { esc, systemDisplayName } from './panel-utils';
import type { EmpireState } from '../empire-state';
import './warehouse-dropdown.css';

export interface WarehouseDropdownCallbacks {
  onBufferCommand(command: string): void;
  onDismiss(): void;
}

let dropdownEl: HTMLDivElement | null = null;
let clickHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

function cleanup(): void {
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
  if (clickHandler) {
    document.removeEventListener('pointerdown', clickHandler);
    clickHandler = null;
  }
  if (dropdownEl) {
    dropdownEl.remove();
    dropdownEl = null;
  }
}

export function showWarehouseDropdown(
  anchorEl: HTMLElement,
  empireState: EmpireState,
  callbacks: WarehouseDropdownCallbacks,
): void {
  cleanup();

  const warehouses = empireState.getWarehouses()
    .filter(wh => wh.stationNaturalId !== null)
    .sort((a, b) => systemDisplayName(a.systemNaturalId).localeCompare(systemDisplayName(b.systemNaturalId)));

  dropdownEl = document.createElement('div');
  dropdownEl.className = 'warehouse-dropdown';
  dropdownEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  if (warehouses.length === 0) {
    dropdownEl.innerHTML = '<div class="warehouse-empty">No warehouses</div>';
  } else {
    let html = '';
    for (const wh of warehouses) {
      const name = systemDisplayName(wh.systemNaturalId);
      const label = name;
      html += `
        <div class="warehouse-row">
          <span class="warehouse-name">${esc(label)}</span>
          <button class="warehouse-inv-btn" data-wh-buffer="INV ${esc(wh.storeId)}">INV</button>
        </div>`;
    }
    dropdownEl.innerHTML = html;
  }

  // Position below anchor, right-aligned
  const rect = anchorEl.getBoundingClientRect();
  let top = rect.bottom + 6;
  const right = window.innerWidth - rect.right;
  if (top + 200 > window.innerHeight) {
    top = Math.max(10, window.innerHeight - 210);
  }
  dropdownEl.style.top = `${top}px`;
  dropdownEl.style.right = `${right}px`;

  document.body.appendChild(dropdownEl);

  // Wire INV buttons
  dropdownEl.querySelectorAll<HTMLButtonElement>('[data-wh-buffer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.whBuffer;
      if (cmd) callbacks.onBufferCommand(cmd);
    });
  });

  // Outside click dismiss (deferred so the toolbar toggle click doesn't immediately dismiss)
  setTimeout(() => {
    clickHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownEl && !dropdownEl.contains(target) && !anchorEl.contains(target)) {
        cleanup();
        callbacks.onDismiss();
      }
    };
    document.addEventListener('pointerdown', clickHandler);
  }, 0);

  // Escape dismiss
  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      callbacks.onDismiss();
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function hideWarehouseDropdown(): void {
  cleanup();
}

export function isWarehouseDropdownVisible(): boolean {
  return dropdownEl !== null;
}
