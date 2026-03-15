/**
 * Ship Tooltip — hover overlay for ship markers
 *
 * Shows ship name + route/ETA or idle status.
 * Positioned near cursor, clamped to viewport edges.
 */

import { systemDisplayName } from './panel-utils';
import type { ShipSummary, FlightSummary } from '../types/bridge';

const OFFSET_X = 16;
const OFFSET_Y = -8;
const VIEWPORT_MARGIN = 8;

let el: HTMLDivElement | null = null;

function ensureElement(): HTMLDivElement {
  if (el) return el;
  el = document.createElement('div');
  el.style.cssText = [
    'position: fixed',
    'pointer-events: none',
    'z-index: 60',
    'padding: 8px 12px',
    'border-radius: 4px',
    'font-family: "IBM Plex Mono", monospace',
    'font-size: 15px',
    'line-height: 1.4',
    'white-space: nowrap',
    'background: rgba(var(--bg-secondary-rgb, 20, 20, 30), 0.92)',
    'color: var(--text-primary, #e0e0e0)',
    'border: 1px solid rgba(255, 255, 255, 0.1)',
    'display: none',
  ].join('; ');
  document.body.appendChild(el);
  return el;
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

function buildContent(ships: ShipSummary[], flights: FlightSummary[]): string {
  if (ships.length === 1) {
    const ship = ships[0];
    const flight = flights.find(f => f.shipId === ship.shipId);
    const name = `<strong>${ship.name}</strong> <span style="opacity:0.6">(${ship.registration})</span>`;
    if (flight) {
      const dest = systemDisplayName(flight.destinationSystemNaturalId);
      const eta = formatEta(flight.arrivalTimestamp);
      return `${name}<br>In transit to ${dest} — ETA ${eta}`;
    }
    const loc = systemDisplayName(ship.locationSystemNaturalId);
    return `${name}<br>Idle at ${loc}`;
  }

  // Multiple ships
  const loc = ships[0].locationSystemNaturalId;
  const sysLabel = loc ? systemDisplayName(loc) : 'location';
  const lines = ships.map(s => `  ${s.name} (${s.registration})`).join('<br>');
  return `<strong>${ships.length} ships at ${sysLabel}</strong><br>${lines}`;
}

function clamp(screenX: number, screenY: number): { x: number; y: number } {
  const tooltip = ensureElement();
  const w = tooltip.offsetWidth;
  const h = tooltip.offsetHeight;
  let x = screenX + OFFSET_X;
  let y = screenY + OFFSET_Y - h;

  if (x + w > window.innerWidth - VIEWPORT_MARGIN) {
    x = screenX - OFFSET_X - w;
  }
  if (y < VIEWPORT_MARGIN) {
    y = screenY + OFFSET_X;
  }
  if (x < VIEWPORT_MARGIN) x = VIEWPORT_MARGIN;

  return { x, y };
}

export function showTextTooltip(
  text: string,
  screenX: number,
  screenY: number,
): void {
  const tooltip = ensureElement();
  tooltip.textContent = text;
  tooltip.style.display = 'block';
  const pos = clamp(screenX, screenY);
  tooltip.style.left = `${pos.x}px`;
  tooltip.style.top = `${pos.y}px`;
}

export function showTooltip(
  ships: ShipSummary[],
  flights: FlightSummary[],
  screenX: number,
  screenY: number,
): void {
  const tooltip = ensureElement();
  tooltip.innerHTML = buildContent(ships, flights);
  tooltip.style.display = 'block';
  const pos = clamp(screenX, screenY);
  tooltip.style.left = `${pos.x}px`;
  tooltip.style.top = `${pos.y}px`;
}

export function updateTooltipPosition(screenX: number, screenY: number): void {
  if (!el || el.style.display === 'none') return;
  const pos = clamp(screenX, screenY);
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
}

export function hideTooltip(): void {
  if (el) el.style.display = 'none';
}

export function isTooltipVisible(): boolean {
  return !!el && el.style.display !== 'none';
}
