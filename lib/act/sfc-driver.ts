// SFC session driver: an OPEN, hidden SHIP FLIGHT CONTROL buffer that APXM's
// send-ship view reads and drives interactively. Unlike the one-shot actions,
// the buffer (and the shared action lock) stays held from open until close —
// the same unbounded-human model as the manual-confirm wait. Cancel/unmount
// MUST call close(): clearing the destination text does NOT disarm the form
// (device finding 2026-08-14) — only closing the buffer does.
//
// Mobile DOM facts (captured 2026-08-14): destination = AddressSelector,
// char-by-char typing populates suggestions, ArrowDown highlights
// (aria-selected) and Enter commits — the WebKit-safe path; the route renders
// as MissionPlan__table (header row, totals row with empty #/Type cells, then
// segments); sliders are rc-slider and clicking an rc-slider-mark-text SETS
// the value; toggles are RadioItem containers (RadioItem__active = on);
// route preferences is a native <select>. Every change triggers a server
// recompute observable as a MissionPlan table mutation (~1-2s).

import { openMobileBuffer, closeMobileBuffer } from '../mobile-buffer-navigator';
import { setupActGlobals } from './globals-setup';
import { sleep, waitUntil } from './_compat';
import { driveType, driveKey, driveClick } from './input-bridge';
import { acquireActionLock, releaseActionLock } from './action-lock';
import { isApexButtonDisabled } from './apex-button';
import { useFlightsStore } from '../../stores/entities';

export interface SfcRouteRow {
  index: string;
  type: string;
  destination: string;
  duration: string;
  distance: string;
  damage: string;
  fees: string;
  consumption: string;
}

export interface SfcSnapshot {
  /** APEX's Status field text ('valid', 'equal origin and destination', ...). */
  status: string;
  /** The totals row (empty when no route yet). */
  totals: SfcRouteRow | null;
  segments: SfcRouteRow[];
  reactorMark: string | null;
  fuelMark: string | null;
  routePref: string | null;
  surfaceLanding: boolean;
  useGateways: boolean;
  unloadOnArrival: boolean;
  startEnabled: boolean;
}

export type SendSessionResult = { ok: true; session: SendSession } | { ok: false; error: string };
export type SfcActionResult = { ok: true } | { ok: false; error: string };

const RECOMPUTE_WAIT_MS = 10000;

function anchor(): HTMLElement | null {
  return document.getElementById('container');
}

function fieldText(root: HTMLElement, label: string): string {
  const containers = Array.from(root.querySelectorAll<HTMLElement>('[class*="FormComponent__container"]'));
  const c = containers.find((el) => el.textContent?.trim().startsWith(label));
  return c ? (c.textContent?.trim().slice(label.length) ?? '').trim() : '';
}

function radioState(root: HTMLElement, label: string): { el: HTMLElement; active: boolean } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node.parentElement;
    if (
      node.textContent?.trim() === label &&
      el?.className.toString().includes('RadioItem__value')
    ) {
      const container = el.closest<HTMLElement>('span[class*="RadioItem__container"]');
      if (container) {
        return { el: container, active: !!container.querySelector('[class*="RadioItem__active"]') };
      }
    }
  }
  return null;
}

function sliderMarks(root: HTMLElement): { fuel: HTMLElement[]; reactor: HTMLElement[] } {
  // Two rc-sliders: fuel (marks MIN/MAX) and reactor (MIN/29%/53%/76%/100%).
  const sliders = Array.from(root.querySelectorAll<HTMLElement>('.rc-slider'));
  const byMarks = (s: HTMLElement) =>
    Array.from(s.querySelectorAll<HTMLElement>('.rc-slider-mark-text'));
  const fuel = sliders.find((s) => byMarks(s).length === 2);
  const reactor = sliders.find((s) => byMarks(s).length > 2);
  return { fuel: fuel ? byMarks(fuel) : [], reactor: reactor ? byMarks(reactor) : [] };
}

function highestActiveMark(marks: HTMLElement[]): string | null {
  const active = marks.filter((m) => m.className.includes('rc-slider-mark-text-active'));
  return active.length ? (active[active.length - 1].textContent?.trim() ?? null) : null;
}

function parseRouteTable(root: HTMLElement): { totals: SfcRouteRow | null; segments: SfcRouteRow[] } {
  const table = root.querySelector<HTMLElement>('[class*="MissionPlan__table"]');
  if (!table) return { totals: null, segments: [] };
  const rows = Array.from(table.querySelectorAll('tr'))
    .map((tr) => Array.from(tr.children).map((c) => c.textContent?.trim().replace(/\s+/g, ' ') ?? ''))
    .filter((cells) => cells.length >= 8 && cells[2] !== 'Destination'); // drop header
  const toRow = (cells: string[]): SfcRouteRow => ({
    index: cells[0],
    type: cells[1],
    destination: cells[2],
    duration: cells[3],
    distance: cells[4],
    damage: cells[5],
    fees: cells[6],
    consumption: cells[7],
  });
  const totals = rows.find((c) => c[0] === '' && c[1] === '');
  const segments = rows.filter((c) => c[0] !== '' || c[1] !== '').map(toRow);
  return { totals: totals ? toRow(totals) : null, segments };
}

async function waitRecompute(root: HTMLElement, beforeTableText: string): Promise<void> {
  const tableText = () =>
    root.querySelector('[class*="MissionPlan__table"]')?.textContent ?? '';
  try {
    await waitUntil(() => tableText() !== beforeTableText, 200, RECOMPUTE_WAIT_MS);
  } catch {
    // No visible change — some tweaks legitimately don't alter the route.
  }
  await sleep(300); // let the re-render settle before reading
}

export class SendSession {
  constructor(private readonly root: HTMLElement, private readonly shipId: string) {}
  private closed = false;

  readSnapshot(): SfcSnapshot {
    const root = this.root;
    const { totals, segments } = parseRouteTable(root);
    const marks = sliderMarks(root);
    const start = Array.from(root.getElementsByTagName('button')).find(
      (b) => b.textContent?.trim().toLowerCase() === 'start'
    );
    const select = root.querySelector<HTMLSelectElement>('select');
    return {
      status: fieldText(root, 'Status'),
      totals,
      segments,
      reactorMark: highestActiveMark(marks.reactor),
      fuelMark: highestActiveMark(marks.fuel),
      routePref: select?.value ?? null,
      surfaceLanding: radioState(root, 'Surface landing')?.active ?? false,
      useGateways: radioState(root, 'Use gateways')?.active ?? false,
      unloadOnArrival: radioState(root, 'Unload on arrival')?.active ?? false,
      startEnabled: !!start && !isApexButtonDisabled(start),
    };
  }

  async setDestination(dest: {
    query: string;
    label: string;
    naturalId?: string;
  }): Promise<SfcActionResult> {
    const input = this.root.querySelector<HTMLInputElement>('input[class*="AddressSelector"]');
    if (!input) return { ok: false, error: 'Destination field not found' };
    // Typing MUST happen in the main world: content-world synthetic events
    // update the value but never trigger APEX's suggestion fetch (device
    // finding 2026-08-14) — the input bridge performs the sequence there.
    const typed = await driveType(input, dest.query);
    if (!typed) return { ok: false, error: 'Destination typing failed (bridge unavailable?)' };
    await sleep(800);
    // Suggestion match: exact label, or the unique "(naturalId)" suffix —
    // WS planet names ("Bober") don't always match APEX's rendered labels
    // ("Antares I - Bober (ZV-307b)"), but the naturalId suffix is exact.
    const suffix = dest.naturalId ? `(${dest.naturalId})` : null;
    const findSuggestion = () =>
      Array.from(document.querySelectorAll<HTMLElement>('li[role="option"]')).find((li) => {
        const text = li.textContent?.trim() ?? '';
        return text === dest.label || (suffix !== null && text.endsWith(suffix));
      }) ?? null;
    let suggestion = findSuggestion();
    for (let attempt = 0; !suggestion && attempt < 3; attempt++) {
      // The dropdown refuses to reopen by typing after a prior selection —
      // ArrowDown (via the bridge) reopens it.
      await driveKey(input, 'ArrowDown');
      await sleep(700);
      suggestion = findSuggestion();
    }
    if (!suggestion) {
      return { ok: false, error: `${dest.label} not found in APEX's destination list` };
    }
    const before = this.root.querySelector('[class*="MissionPlan__table"]')?.textContent ?? '';
    // Selection click also goes through the bridge — autosuggest selection
    // is the interaction most sensitive to event provenance.
    const clicked = await driveClick(suggestion);
    if (!clicked) return { ok: false, error: 'Destination selection failed' };
    await waitRecompute(this.root, before);
    return { ok: true };
  }

  async setReactorMark(markLabel: string): Promise<SfcActionResult> {
    return this.clickMark(sliderMarks(this.root).reactor, markLabel);
  }

  async setFuelMark(markLabel: string): Promise<SfcActionResult> {
    return this.clickMark(sliderMarks(this.root).fuel, markLabel);
  }

  private async clickMark(marks: HTMLElement[], markLabel: string): Promise<SfcActionResult> {
    const mark = marks.find((m) => m.textContent?.trim() === markLabel);
    if (!mark) return { ok: false, error: `${markLabel} not available` };
    const before = this.root.querySelector('[class*="MissionPlan__table"]')?.textContent ?? '';
    mark.click();
    await waitRecompute(this.root, before);
    return { ok: true };
  }

  async setRoutePref(value: string): Promise<SfcActionResult> {
    const select = this.root.querySelector<HTMLSelectElement>('select');
    if (!select) return { ok: false, error: 'Route preference not found' };
    const before = this.root.querySelector('[class*="MissionPlan__table"]')?.textContent ?? '';
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitRecompute(this.root, before);
    return { ok: true };
  }

  async toggle(label: 'Surface landing' | 'Use gateways' | 'Unload on arrival'): Promise<SfcActionResult> {
    const radio = radioState(this.root, label);
    if (!radio) return { ok: false, error: `${label} control not found` };
    const before = this.root.querySelector('[class*="MissionPlan__table"]')?.textContent ?? '';
    radio.el.click();
    await waitRecompute(this.root, before);
    return { ok: true };
  }

  /** The user's SEND tap. Refuses unless APEX itself says the flight is
   *  committable; confirms via the ship gaining a flight over the WS. */
  async commitStart(): Promise<SfcActionResult> {
    const snapshot = this.readSnapshot();
    if (snapshot.status !== 'valid' || !snapshot.startEnabled) {
      return { ok: false, error: snapshot.status ? `Not sendable: ${snapshot.status}` : 'Route not ready' };
    }
    const start = Array.from(this.root.getElementsByTagName('button')).find(
      (b) => b.textContent?.trim().toLowerCase() === 'start'
    );
    if (!start || isApexButtonDisabled(start)) return { ok: false, error: 'START not enabled in APEX' };
    const hadFlight = !!useFlightsStore.getState().getAll().find((f) => f.shipId === this.shipId);
    start.click();
    try {
      await waitUntil(
        () => !!useFlightsStore.getState().getAll().find((f) => f.shipId === this.shipId) && !hadFlight,
        250,
        15000
      );
    } catch {
      return {
        ok: false,
        error: 'START sent but no flight confirmed by the game — check the ship in APEX',
      };
    }
    return { ok: true };
  }

  /** Always restores APEX and frees the lock. Idempotent. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await closeMobileBuffer();
    } finally {
      releaseActionLock();
    }
  }
}

export async function openSendSession(
  registration: string,
  shipId: string
): Promise<SendSessionResult> {
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is already running' };
  }
  setupActGlobals();
  const opened = await openMobileBuffer(`SFC ${registration}`);
  const root = anchor();
  if (!opened || !root) {
    releaseActionLock();
    return { ok: false, error: 'Failed to open the flight control buffer' };
  }
  // The navigator parks #container hidden (visibility:hidden, off-screen) —
  // but a hidden input cannot take focus, and the AddressSelector only
  // renders suggestions while focused (the MTRA off-screen rule; refound the
  // hard way 2026-08-14). Reveal it for the session: APXM's opaque overlay
  // covers the page, so the buffer stays invisible to the user, and
  // closeMobileBuffer restores the pristine styles it saved at open.
  root.style.visibility = 'visible';
  root.style.left = '0px';
  return { ok: true, session: new SendSession(root, shipId) };
}
