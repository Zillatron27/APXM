/**
 * Menu Dropdown — anchored to the toolbar menu button.
 *
 * Contains Fleet Overview, Burn Status, Theme picker, and Settings.
 */

import {
  themePresets, getActiveThemeId, setTheme,
} from '@27bit/helm';
import type { ThemePreset } from '@27bit/helm';
import './menu.css';

export interface MenuCallbacks {
  onFleetOverview(): void;
  onBurnStatus(): void;
  onSettings(): void;
  onDismiss(): void;
}

let menuEl: HTMLDivElement | null = null;
let clickHandler: ((e: MouseEvent) => void) | null = null;
let themeExpanded = false;

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function cleanup(): void {
  if (clickHandler) {
    document.removeEventListener('pointerdown', clickHandler);
    clickHandler = null;
  }
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
  themeExpanded = false;
}

function renderThemeList(container: HTMLDivElement): void {
  const list = container.querySelector('.menu-theme-list') as HTMLDivElement;
  if (!list) return;

  const activeId = getActiveThemeId();
  list.innerHTML = '';

  for (const preset of themePresets) {
    const item = document.createElement('div');
    item.className = `menu-theme-item${preset.id === activeId ? ' active' : ''}`;

    const swatch = document.createElement('span');
    swatch.className = 'menu-theme-swatch';
    swatch.style.background = hexToCss(preset.tokens.accent);

    const name = document.createElement('span');
    name.textContent = preset.name;

    item.appendChild(swatch);
    item.appendChild(name);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      setTheme(preset.id);
      renderThemeList(container);
    });

    list.appendChild(item);
  }
}

export function showMenu(
  anchorEl: HTMLElement,
  callbacks: MenuCallbacks,
): void {
  cleanup();

  menuEl = document.createElement('div');
  menuEl.className = 'apxm-menu';

  // Position below and left-aligned with anchor
  const rect = anchorEl.getBoundingClientRect();
  let top = rect.bottom + 6;
  let right = window.innerWidth - rect.right;
  if (top + 300 > window.innerHeight) {
    top = Math.max(10, window.innerHeight - 310);
  }
  menuEl.style.top = `${top}px`;
  menuEl.style.right = `${right}px`;

  // Fleet Overview
  const fleetItem = document.createElement('div');
  fleetItem.className = 'menu-item';
  fleetItem.textContent = 'Fleet Overview';
  fleetItem.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup();
    callbacks.onDismiss();
    callbacks.onFleetOverview();
  });
  menuEl.appendChild(fleetItem);

  // Burn Status
  const burnItem = document.createElement('div');
  burnItem.className = 'menu-item';
  burnItem.textContent = 'Burn Status';
  burnItem.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup();
    callbacks.onDismiss();
    callbacks.onBurnStatus();
  });
  menuEl.appendChild(burnItem);

  // Separator
  const sep1 = document.createElement('div');
  sep1.className = 'menu-separator';
  menuEl.appendChild(sep1);

  // Theme picker (inline expand/collapse)
  const activeTheme = themePresets.find(p => p.id === getActiveThemeId());
  const themeHeader = document.createElement('div');
  themeHeader.className = 'menu-theme-header';
  themeHeader.innerHTML = `
    <span>Theme: ${activeTheme?.name ?? 'Default'}</span>
    <span class="menu-theme-arrow">\u25B6</span>
  `;

  const themeList = document.createElement('div');
  themeList.className = 'menu-theme-list';

  themeHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    themeExpanded = !themeExpanded;
    themeList.classList.toggle('expanded', themeExpanded);
    const arrow = themeHeader.querySelector('.menu-theme-arrow');
    arrow?.classList.toggle('expanded', themeExpanded);
  });

  menuEl.appendChild(themeHeader);
  menuEl.appendChild(themeList);
  renderThemeList(menuEl);

  // Separator
  const sep2 = document.createElement('div');
  sep2.className = 'menu-separator';
  menuEl.appendChild(sep2);

  // Settings
  const settingsItem = document.createElement('div');
  settingsItem.className = 'menu-item';
  settingsItem.textContent = 'Settings';
  settingsItem.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup();
    callbacks.onDismiss();
    callbacks.onSettings();
  });
  menuEl.appendChild(settingsItem);

  // Prevent clicks inside menu from reaching backdrop
  menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  document.body.appendChild(menuEl);

  // Click-outside dismissal + Escape key
  setTimeout(() => {
    clickHandler = (e: MouseEvent) => {
      if (menuEl && !menuEl.contains(e.target as Node)) {
        cleanup();
        callbacks.onDismiss();
      }
    };
    document.addEventListener('pointerdown', clickHandler);
  }, 0);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      callbacks.onDismiss();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function hideMenu(): void {
  cleanup();
}

export function isMenuVisible(): boolean {
  return menuEl !== null;
}
