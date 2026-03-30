/**
 * Menu Dropdown — anchored to the toolbar menu button.
 *
 * Contains Fleet Overview, Burn Status, Theme picker, and Settings.
 */

import {
  themePresets, getActiveThemeId, setTheme, getTheme,
} from '@27bit/helm';
import type { ThemePreset } from '@27bit/helm';
import type { EmpireState } from '../empire-state';
import type { CurrencyAmount } from '../types/bridge';
import './menu.css';

export interface MenuCallbacks {
  onSettings(): void;
  onDismiss(): void;
}

let menuEl: HTMLDivElement | null = null;
let clickHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let themeExpanded = false;
let liquidityExpanded = false;

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function cleanup(): void {
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
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

function sortBalances(
  balances: CurrencyAmount[],
  primaryCurrency: string | null,
): CurrencyAmount[] {
  return balances
    .filter((b) => b.currency !== 'ECD')
    .sort((a, b) => {
      if (primaryCurrency) {
        if (a.currency === primaryCurrency && b.currency !== primaryCurrency) return -1;
        if (b.currency === primaryCurrency && a.currency !== primaryCurrency) return 1;
      }
      return a.currency.localeCompare(b.currency);
    });
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
  empireState: EmpireState,
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

  // Company name
  const companyName = empireState.getCompanyName();
  if (companyName) {
    const companyEl = document.createElement('div');
    companyEl.className = 'menu-company-name';
    companyEl.textContent = companyName;
    companyEl.style.color = hexToCss(getTheme().accent);
    menuEl.appendChild(companyEl);
  }

  // Liquidity section
  const balances = sortBalances(empireState.getBalances(), empireState.getPrimaryCurrency());
  if (balances.length > 0) {
    const liqHeader = document.createElement('div');
    liqHeader.className = 'menu-liquidity-header';
    liqHeader.innerHTML = `
      <span>Liquidity</span>
      <span class="menu-liquidity-arrow${liquidityExpanded ? ' expanded' : ''}">\u25B6</span>
    `;

    const liqList = document.createElement('div');
    liqList.className = `menu-liquidity-list${liquidityExpanded ? ' expanded' : ''}`;

    for (const bal of balances) {
      const row = document.createElement('div');
      row.className = 'menu-liquidity-row';
      row.innerHTML = `
        <span class="menu-liquidity-amount">${Math.floor(bal.amount).toLocaleString()}</span>
        <span class="menu-liquidity-currency">${bal.currency}</span>
      `;
      liqList.appendChild(row);
    }

    liqHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      liquidityExpanded = !liquidityExpanded;
      liqList.classList.toggle('expanded', liquidityExpanded);
      const arrow = liqHeader.querySelector('.menu-liquidity-arrow');
      arrow?.classList.toggle('expanded', liquidityExpanded);
    });

    menuEl.appendChild(liqHeader);
    menuEl.appendChild(liqList);
  }

  // Separator between header and menu items
  if (companyName || balances.length > 0) {
    const sepHeader = document.createElement('div');
    sepHeader.className = 'menu-separator';
    menuEl.appendChild(sepHeader);
  }

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
  // Skip the anchor button — its own toggle handler manages open/close
  setTimeout(() => {
    clickHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuEl && !menuEl.contains(target) && !anchorEl.contains(target)) {
        cleanup();
        callbacks.onDismiss();
      }
    };
    document.addEventListener('pointerdown', clickHandler);
  }, 0);

  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      callbacks.onDismiss();
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

/** Returns the distance from the left edge of the menu to the right edge of the viewport. */
export function getMenuRightEdge(): number {
  if (!menuEl) return 0;
  // Force layout reflow so dimensions are available immediately after DOM append
  void menuEl.offsetWidth;
  const rect = menuEl.getBoundingClientRect();
  return window.innerWidth - rect.left;
}
