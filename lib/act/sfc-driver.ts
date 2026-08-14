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
import { driveType, driveKey, driveClick, driveClickAt } from './input-bridge';
import { acquireActionLock, releaseActionLock } from './action-lock';
import { isApexButtonDisabled } from './apex-button';
import { useFlightsStore, useShipsStore } from '../../stores/entities';

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
  /** Null when the ship renders no such slider. */
  reactor: SliderState | null;
  fuel: SliderState | null;
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

export type SliderKind = 'fuel' | 'reactor';

const SLIDER_LABELS: Record<SliderKind, string> = {
  fuel: 'Fuel usage',
  reactor: 'Reactor usage',
};

/** The slider for a labelled field. Absent legitimately — e.g. STL-only
 *  ships render no Reactor usage slider (device finding 2026-08-14). */
function findSlider(root: HTMLElement, kind: SliderKind): HTMLElement | null {
  const containers = Array.from(
    root.querySelectorAll<HTMLElement>('[class*="FormComponent__container"]')
  );
  const field = containers.find((el) => el.textContent?.trim().startsWith(SLIDER_LABELS[kind]));
  return field?.querySelector<HTMLElement>('.rc-slider') ?? null;
}

export interface SliderState {
  /** The actual value as a percent (aria-valuenow × 100). */
  valuePct: number;
  /** Position across the slider's OWN range, 0–1. Ranges vary wildly —
   *  Picard's reactor spans 97.5%–100% while a Sprinter's starts near 5%
   *  (device 2026-08-14) — so controls address positions, not absolutes. */
  posFrac: number;
}

function sliderState(root: HTMLElement, kind: SliderKind): SliderState | null {
  const handle = findSlider(root, kind)?.querySelector('.rc-slider-handle');
  const now = Number(handle?.getAttribute('aria-valuenow'));
  const min = Number(handle?.getAttribute('aria-valuemin'));
  const max = Number(handle?.getAttribute('aria-valuemax'));
  if (!Number.isFinite(now) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return null;
  }
  return { valuePct: Math.round(now * 1000) / 10, posFrac: (now - min) / (max - min) };
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
  // A control change puts the form into Status "calculating", during which
  // APEX UNMOUNTS the route table and sliders (device 2026-08-14) — reading
  // a snapshot then captures a transient no-route/no-slider state that never
  // heals (snapshots only refresh on user action). Settle: wait until the
  // recompute finishes AND the table is back (or a terminal non-calculating
  // status explains why it isn't).
  try {
    await waitUntil(
      () => {
        const status = fieldText(root, 'Status');
        if (status === 'calculating') return false;
        return tableText() !== '' || (status !== '' && status !== 'valid');
      },
      250,
      20000
    );
  } catch {
    // Settle timeout — the snapshot will honestly show whatever state APEX is in.
  }
  await sleep(300); // let the re-render settle before reading
}

export class SendSession {
  constructor(private readonly root: HTMLElement, private readonly shipId: string) {}
  private closed = false;

  readSnapshot(): SfcSnapshot {
    const root = this.root;
    const { totals, segments } = parseRouteTable(root);
    const start = Array.from(root.getElementsByTagName('button')).find(
      (b) => b.textContent?.trim().toLowerCase() === 'start'
    );
    const select = root.querySelector<HTMLSelectElement>('select');
    return {
      status: fieldText(root, 'Status'),
      totals,
      segments,
      reactor: sliderState(root, 'reactor'),
      fuel: sliderState(root, 'fuel'),
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

  /** Sets a usage slider to a POSITION across its own range (0 = MIN,
   *  1 = MAX) by clicking the rc-slider rail there via the input bridge.
   *  Position, not absolute percent: slider ranges are per-ship/per-route
   *  (Picard's reactor spans only 97.5–100%), so absolute targets are often
   *  unsatisfiable and would clamp confusingly. */
  async setSliderFraction(kind: SliderKind, frac: number): Promise<SfcActionResult> {
    const slider = findSlider(this.root, kind);
    if (!slider) return { ok: false, error: `No ${SLIDER_LABELS[kind]} control on this ship` };
    const before = this.root.querySelector('[class*="MissionPlan__table"]')?.textContent ?? '';
    const clicked = await driveClickAt(slider, Math.min(Math.max(frac, 0), 1));
    if (!clicked) return { ok: false, error: 'Slider did not respond' };
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
    // A stale record from a completed flight may linger — success is a
    // flight with a NEW id, not merely any flight existing. The ship's own
    // flightId (SHIP_DATA delta) is a second, independent departure signal.
    const priorFlightIds = new Set(
      useFlightsStore
        .getState()
        .getAll()
        .filter((f) => f.shipId === this.shipId)
        .map((f) => f.id)
    );
    const priorShipFlightId = useShipsStore.getState().getById(this.shipId)?.flightId ?? null;
    start.click();
    // START pops APEX's ActionConfirmationOverlay ("Confirmation required:
    // The flight from X to Y...") — live-confirmed 2026-08-14, the first
    // action that does. The user's SEND tap is the informed commit (the full
    // route was reviewed in APXM), so the confirmation is completed here —
    // handing the dialog over would mean switching to APEX, which this
    // feature exists to avoid. The confirm button is the overlay's second
    // "start"; the other is Cancel.
    try {
      await waitUntil(
        () => !!document.querySelector('[class*="ActionConfirmationOverlay__container"]'),
        200,
        5000
      );
      const overlay = document.querySelector<HTMLElement>(
        '[class*="ActionConfirmationOverlay__container"]'
      );
      const confirm = overlay
        ? Array.from(overlay.getElementsByTagName('button')).find(
            (b) => !/cancel/i.test(b.textContent ?? '')
          )
        : undefined;
      if (confirm) confirm.click();
    } catch {
      // No overlay appeared — some sends may commit directly; the flight
      // delta below is the ground truth either way.
    }
    try {
      await waitUntil(
        // ANY flight with a new id — SHIP_FLIGHT_STARTED adds the new flight
        // alongside stale cached ones for the same ship, so a find-first
        // check can stare at an old record forever (device 2026-08-14: the
        // ship dispatched while this wait timed out). The ship's flightId
        // changing is accepted as an independent departure signal too.
        () => {
          const newFlight = useFlightsStore
            .getState()
            .getAll()
            .some((f) => f.shipId === this.shipId && !priorFlightIds.has(f.id));
          const shipFlightId = useShipsStore.getState().getById(this.shipId)?.flightId ?? null;
          return newFlight || (shipFlightId !== null && shipFlightId !== priorShipFlightId);
        },
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
  // Ready = the destination AddressSelector itself, not the generic form
  // sentinel: the SFC form renders progressively and its first FormComponents
  // (Ship/Location) appear a tick before the destination input — the generic
  // sentinel raced ahead and setDestination found no field (device 2026-08-14).
  const opened = await openMobileBuffer(`SFC ${registration}`, () =>
    document
      .getElementById('container')
      ?.querySelector<HTMLElement>('input[class*="AddressSelector"]') ?? null
  );
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
