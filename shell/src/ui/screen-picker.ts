/**
 * Screen Picker — dropdown for selecting/assigning an APEX screen
 *
 * Renders as a positioned div anchored to the config button.
 * Has its own click-outside handler (separate from panel-manager).
 */

import type { ScreenInfo } from '../types/bridge';
import { esc } from './panel-utils';

let pickerEl: HTMLDivElement | null = null;
let clickHandler: ((e: MouseEvent) => void) | null = null;

function cleanup(): void {
  if (clickHandler) {
    document.removeEventListener('pointerdown', clickHandler);
    clickHandler = null;
  }
  if (pickerEl) {
    pickerEl.remove();
    pickerEl = null;
  }
}

export function showScreenPicker(
  anchorEl: HTMLElement,
  screens: ScreenInfo[],
  assignedScreenId: string | null,
  onSelect: (screenId: string) => void,
  onClear: () => void,
  onDismiss: () => void,
): void {
  cleanup();

  if (screens.length === 0) return;

  pickerEl = document.createElement('div');
  pickerEl.style.cssText = `
    position: fixed;
    z-index: 60;
    min-width: 160px;
    max-height: 240px;
    overflow-y: auto;
    background: rgba(20, 20, 30, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 14px;
    color: #e0e0e0;
    padding: 4px 0;
  `;

  // Position above or below the anchor
  const rect = anchorEl.getBoundingClientRect();
  let top = rect.bottom + 4;
  if (top + 240 > window.innerHeight) {
    top = rect.top - 240 - 4;
    if (top < 0) top = 10;
  }
  let left = rect.left;
  if (left + 180 > window.innerWidth) {
    left = window.innerWidth - 190;
  }
  pickerEl.style.top = `${top}px`;
  pickerEl.style.left = `${left}px`;

  // Screen items
  const items = screens.map((screen) => {
    const isAssigned = screen.id === assignedScreenId;
    return `<div class="screen-picker-item${isAssigned ? ' screen-picker-active' : ''}"
                 data-screen-id="${esc(screen.id)}"
                 style="padding: 8px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px;
                        ${isAssigned ? 'background: rgba(100, 140, 255, 0.12);' : ''}">
      ${isAssigned ? '<span style="opacity:0.6">✓</span>' : '<span style="opacity:0; width:14px">✓</span>'}
      <span>${esc(screen.name)}</span>
    </div>`;
  }).join('');

  // Clear option
  const clearHtml = assignedScreenId ? `
    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 2px; padding-top: 2px;">
      <div data-screen-clear
           style="padding: 8px 14px; cursor: pointer; opacity: 0.5; display: flex; align-items: center; gap: 8px;">
        <span>✕</span>
        <span>Clear</span>
      </div>
    </div>
  ` : '';

  pickerEl.innerHTML = items + clearHtml;
  document.body.appendChild(pickerEl);

  // Prevent pointerdown from reaching panel-manager's click-outside handler
  pickerEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  // Wire click handlers on items
  pickerEl.querySelectorAll<HTMLElement>('[data-screen-id]').forEach((item) => {
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255, 255, 255, 0.08)';
    });
    item.addEventListener('mouseleave', () => {
      const isActive = item.classList.contains('screen-picker-active');
      item.style.background = isActive ? 'rgba(100, 140, 255, 0.12)' : '';
    });
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = item.dataset.screenId;
      if (id) onSelect(id);
    });
  });

  pickerEl.querySelector('[data-screen-clear]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    onClear();
  });

  // Click-outside dismissal (delayed to avoid triggering from the opening click)
  setTimeout(() => {
    clickHandler = (e: MouseEvent) => {
      if (pickerEl && !pickerEl.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', clickHandler);
  }, 0);
}

export function hideScreenPicker(): void {
  cleanup();
}
