/**
 * Toolbar — fixed top-right button group for the desktop view.
 *
 * Provides gateway toggle, empire dim toggle, and menu button.
 */

import './toolbar.css';

export interface ToolbarCallbacks {
  onGatewayToggle(active: boolean): void;
  onEmpireToggle(active: boolean): void;
  onMenuToggle(active: boolean): void;
}

let toolbarEl: HTMLDivElement | null = null;

let gatewayBtn: HTMLButtonElement | null = null;
let empireBtn: HTMLButtonElement | null = null;
let menuBtn: HTMLButtonElement | null = null;

let gatewayActive = true;
let empireActive = false;
let menuActive = false;

function createButton(label: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'toolbar-btn';
  btn.textContent = label;
  btn.title = title;
  return btn;
}

export function createToolbar(callbacks: ToolbarCallbacks): HTMLDivElement {
  if (toolbarEl) return toolbarEl;

  toolbarEl = document.createElement('div');
  toolbarEl.className = 'apxm-toolbar';

  gatewayBtn = createButton('G', 'Toggle gateways');
  gatewayBtn.classList.add('active'); // gateways visible by default
  gatewayBtn.addEventListener('click', () => {
    gatewayActive = !gatewayActive;
    gatewayBtn!.classList.toggle('active', gatewayActive);
    callbacks.onGatewayToggle(gatewayActive);
  });

  empireBtn = createButton('E', 'Toggle empire highlight');
  empireBtn.addEventListener('click', () => {
    empireActive = !empireActive;
    empireBtn!.classList.toggle('active', empireActive);
    callbacks.onEmpireToggle(empireActive);
  });

  menuBtn = createButton('\u2630', 'Menu');
  menuBtn.addEventListener('click', () => {
    menuActive = !menuActive;
    menuBtn!.classList.toggle('active', menuActive);
    callbacks.onMenuToggle(menuActive);
  });

  toolbarEl.appendChild(gatewayBtn);
  toolbarEl.appendChild(empireBtn);
  toolbarEl.appendChild(menuBtn);

  return toolbarEl;
}

export function setGatewayActive(active: boolean): void {
  gatewayActive = active;
  gatewayBtn?.classList.toggle('active', active);
}

export function setEmpireActive(active: boolean): void {
  empireActive = active;
  empireBtn?.classList.toggle('active', active);
}

export function setMenuActive(active: boolean): void {
  menuActive = active;
  menuBtn?.classList.toggle('active', active);
}

export function isEmpireActive(): boolean {
  return empireActive;
}

export function getMenuButton(): HTMLButtonElement | null {
  return menuBtn;
}
