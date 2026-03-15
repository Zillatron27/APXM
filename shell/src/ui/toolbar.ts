/**
 * Toolbar — fixed top-right button group for the desktop view.
 *
 * Provides gateway toggle, empire dim toggle, and menu button.
 */

import './toolbar.css';

export interface ToolbarCallbacks {
  onBurnToggle(active: boolean): void;
  onFleetToggle(active: boolean): void;
  onWarehouseToggle(active: boolean): void;
  onGatewayToggle(active: boolean): void;
  onEmpireToggle(active: boolean): void;
  onMenuToggle(active: boolean): void;
}

let toolbarEl: HTMLDivElement | null = null;

let burnBtn: HTMLButtonElement | null = null;
let fleetBtn: HTMLButtonElement | null = null;
let warehouseBtn: HTMLButtonElement | null = null;
let gatewayBtn: HTMLButtonElement | null = null;
let empireBtn: HTMLButtonElement | null = null;
let menuBtn: HTMLButtonElement | null = null;

let burnActive = false;
let fleetActive = false;
let warehouseActive = false;
let gatewayActive = true;
let empireActive = false;
let menuActive = false;

const BURN_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M12 2C12 2 7 8 7 13C7 15.5 8.5 17.5 10 18.5C9.5 17 10 15 12 13C14 15 14.5 17 14 18.5C15.5 17.5 17 15.5 17 13C17 8 12 2 12 2Z" fill="currentColor"/>
</svg>`;

const FLEET_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="7,12 12,7 17,12"/>
  <polyline points="7,17 12,12 17,17"/>
</svg>`;

const EMPIRE_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="3" fill="currentColor"/>
  <circle cx="12" cy="12" r="6.5" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.7"/>
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.4"/>
</svg>`;

const WAREHOUSE_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 8L12 3L3 8"/>
  <rect x="4" y="8" width="16" height="13" rx="1"/>
  <path d="M9 21V14h6v7"/>
</svg>`;

const GATEWAY_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 26 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <circle cx="4" cy="16" r="3"/>
  <circle cx="22" cy="16" r="3"/>
  <path d="M4 13 C4 1 22 1 22 13"/>
</svg>`;

function createButton(label: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'toolbar-btn';
  btn.textContent = label;
  btn.title = title;
  return btn;
}

function createIconButton(svg: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'toolbar-btn';
  btn.innerHTML = svg;
  btn.title = title;
  return btn;
}

export function createToolbar(callbacks: ToolbarCallbacks): HTMLDivElement {
  if (toolbarEl) return toolbarEl;

  toolbarEl = document.createElement('div');
  toolbarEl.className = 'apxm-toolbar';

  burnBtn = createIconButton(BURN_ICON_SVG, 'Burn status (B)');
  burnBtn.addEventListener('click', () => {
    burnActive = !burnActive;
    burnBtn!.classList.toggle('active', burnActive);
    callbacks.onBurnToggle(burnActive);
  });

  fleetBtn = createIconButton(FLEET_ICON_SVG, 'Fleet overview (F)');
  fleetBtn.addEventListener('click', () => {
    fleetActive = !fleetActive;
    fleetBtn!.classList.toggle('active', fleetActive);
    callbacks.onFleetToggle(fleetActive);
  });

  warehouseBtn = createIconButton(WAREHOUSE_ICON_SVG, 'Warehouses (W)');
  warehouseBtn.addEventListener('click', () => {
    warehouseActive = !warehouseActive;
    warehouseBtn!.classList.toggle('active', warehouseActive);
    callbacks.onWarehouseToggle(warehouseActive);
  });

  gatewayBtn = createIconButton(GATEWAY_ICON_SVG, 'Toggle gateways (G)');
  gatewayBtn.classList.add('active'); // gateways visible by default
  gatewayBtn.addEventListener('click', () => {
    gatewayActive = !gatewayActive;
    gatewayBtn!.classList.toggle('active', gatewayActive);
    callbacks.onGatewayToggle(gatewayActive);
  });

  empireBtn = createIconButton(EMPIRE_ICON_SVG, 'Toggle empire highlight (E)');
  empireBtn.addEventListener('click', () => {
    empireActive = !empireActive;
    empireBtn!.classList.toggle('active', empireActive);
    callbacks.onEmpireToggle(empireActive);
  });

  menuBtn = createButton('\u2630', 'Menu');
  menuBtn.classList.add('toolbar-btn-menu');
  menuBtn.addEventListener('click', () => {
    menuActive = !menuActive;
    menuBtn!.classList.toggle('active', menuActive);
    callbacks.onMenuToggle(menuActive);
  });

  toolbarEl.appendChild(burnBtn);
  toolbarEl.appendChild(fleetBtn);
  toolbarEl.appendChild(warehouseBtn);
  toolbarEl.appendChild(gatewayBtn);
  toolbarEl.appendChild(empireBtn);
  toolbarEl.appendChild(menuBtn);

  return toolbarEl;
}

export function setBurnActive(active: boolean): void {
  burnActive = active;
  burnBtn?.classList.toggle('active', active);
}

export function isBurnActive(): boolean {
  return burnActive;
}

export function setFleetActive(active: boolean): void {
  fleetActive = active;
  fleetBtn?.classList.toggle('active', active);
}

export function isFleetActive(): boolean {
  return fleetActive;
}

export function setWarehouseActive(active: boolean): void {
  warehouseActive = active;
  warehouseBtn?.classList.toggle('active', active);
}

export function isWarehouseActive(): boolean {
  return warehouseActive;
}

export function getWarehouseButton(): HTMLButtonElement | null {
  return warehouseBtn;
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

export function isGatewayActive(): boolean {
  return gatewayActive;
}

export function isEmpireActive(): boolean {
  return empireActive;
}

export function getMenuButton(): HTMLButtonElement | null {
  return menuBtn;
}
