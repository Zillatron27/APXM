// One-tap ship unload (first slice of the ship actions, #9/#25): the user taps
// UNLOAD in APXM's ship sheet, and APXM drives the FLT buffer off-screen —
// open buffer, click the ship's own unload button, observe the feedback
// overlay, close and restore. APEX's unload commits immediately with NO
// confirmation overlay (device-captured 2026-08-14): the user's APXM tap IS
// the commit, same model as the contract actions.

import { openMobileBuffer, closeMobileBuffer } from './mobile-buffer-navigator';
import { waitActionFeedback } from './act/action-feedback';
import { setupActGlobals } from './act/globals-setup';
import { clickElement, waitUntil } from './act/_compat';
import { acquireActionLock, releaseActionLock } from './act/action-lock';
import { isApexButtonDisabled } from './act/apex-button';
import { toDisplayName } from './act/action-steps/cont-utils';
import { runTransfer } from './act/transfer-modal';
import { planRefuel, FUEL_TICKER, type FuelTank } from '../core/refuel';
import { useSettingsStore } from '../stores/settings';
import { useGameState } from '../stores/gameState';
import { useShipsStore, useStorageStore } from '../stores/entities';
import { useMaterialsStore } from '../stores/reference';

export type ShipActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** The unload button exists but APEX renders it disabled (ship in
       *  transit). The view mirrors the disabled state instead of erroring. */
      disabledInApex?: true;
    };

/**
 * Finds the unload button for one ship inside the opened FLT buffer.
 *
 * Addressed by SHIP, never by ordinal: the mobile FLT card renders one block
 * per ship (captured 2026-08-14: classless div > header.Fleet__fleetHeader
 * with the registration in a plain span, then the fly/cargo/fuel/unload
 * buttons), and every ship has an unload button — counting matches would pick
 * whichever ship sorts first. The registration leaf is located, then ancestors
 * are walked until one contains an unload button. The walk stops — refusing to
 * guess — once an ancestor holds more than one unload button OR more than one
 * registration-shaped leaf: either means it left the ship's own block and any
 * button found there could belong to a different ship. The same walk works on
 * the desktop FLT table (tr = the ship's row).
 */
export function findShipUnloadButton(
  root: HTMLElement,
  registration: string
): HTMLElement | undefined {
  // APEX may uppercase via CSS — compare case-insensitively (CLAUDE.md gotcha).
  const wanted = registration.trim().toLowerCase();
  // Transponder shape ("AVI-063I6") — used only to detect that an ancestor
  // spans multiple ships, so the pattern can be loose.
  const regShape = /^[a-z]{2,4}-[a-z0-9]{3,}$/i;
  const leaves = Array.from(root.querySelectorAll<HTMLElement>('span, td, div, h4')).filter(
    (el) => el.children.length === 0 && el.textContent?.trim().toLowerCase() === wanted
  );

  for (const leaf of leaves) {
    let node: HTMLElement | null = leaf.parentElement;
    while (node && node !== root.parentElement) {
      const regLeaves = Array.from(node.querySelectorAll<HTMLElement>('span, td, div, h4')).filter(
        (el) => el.children.length === 0 && regShape.test(el.textContent?.trim() ?? '')
      );
      if (regLeaves.length > 1) break; // ancestor spans multiple ships
      const unloads = Array.from(node.getElementsByTagName('button')).filter(
        (el) => el.textContent?.trim().toLowerCase() === 'unload'
      );
      if (unloads.length === 1) return unloads[0];
      if (unloads.length > 1) break;
      node = node.parentElement;
    }
  }
  return undefined;
}

const REFUEL_REASON_TEXT: Record<string, string> = {
  'tank-full': 'Tank is already full',
  'no-fuel-here': 'No fuel at this location',
  'no-reference-data': 'Material data not loaded yet',
  'no-tank': 'Tank data unavailable',
};

/**
 * One-tap tank fill: opens the SOURCE store's own INV buffer off-screen and
 * drives APEX's transfer wizard — material by display name, target tank by
 * store GUID (the fiber-addressed path; labels are nameless), amount from the
 * refuel plan — then commits. The commit is silent (no ActionFeedback), so
 * success is confirmed by the tank store's volume delta arriving over the
 * WebSocket. The user's APXM tap IS the commit, same model as unload.
 */
export async function runShipRefuel(shipId: string, tank: FuelTank): Promise<ShipActionResult> {
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is already running' };
  }
  try {
    setupActGlobals();
    const ship = useShipsStore.getState().getById(shipId);
    if (!ship) return { ok: false, error: 'Ship data unavailable' };
    const material = useMaterialsStore.getState().getById(FUEL_TICKER[tank]);
    // Act-time recheck — the UI gates on the same plan, but data may have
    // moved between render and tap.
    const plan = planRefuel(ship, useStorageStore.getState().getAll(), material, tank);
    if (!plan.available) {
      return { ok: false, error: REFUEL_REASON_TEXT[plan.reason] ?? plan.reason };
    }

    // INV is a list buffer (no FormComponent) — StoreView is its content.
    const opened = await openMobileBuffer(`INV ${plan.sourceStore.id}`, () =>
      document
        .getElementById('container')
        ?.querySelector<HTMLElement>('[class*="StoreView__container"]') ?? null
    );
    const anchor = document.getElementById('container');
    if (!opened || !anchor) {
      return { ok: false, error: 'Failed to open the source store buffer' };
    }
    try {
      const tankStoreId = tank === 'stl' ? ship.idStlFuelStore : ship.idFtlFuelStore;
      const before = useStorageStore.getState().getById(tankStoreId)?.volumeLoad ?? 0;
      const result = await runTransfer(anchor, {
        materialName: toDisplayName(material!.name),
        targetStoreId: tankStoreId,
        amount: plan.units,
      });
      if (!result.ok) return result;
      // Silent commit — the WS STORAGE_CHANGE delta is the ground truth.
      try {
        await waitUntil(
          () => (useStorageStore.getState().getById(tankStoreId)?.volumeLoad ?? 0) > before,
          250,
          15000
        );
      } catch {
        return {
          ok: false,
          error: 'Transfer sent but not confirmed by the game — check the tank in APEX',
        };
      }
      return { ok: true };
    } finally {
      await closeMobileBuffer();
    }
  } finally {
    releaseActionLock();
  }
}

export async function runShipUnload(registration: string): Promise<ShipActionResult> {
  // One driven action at a time across all action modules (contract actions
  // too) — concurrent runs would fight over #container.
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is already running' };
  }
  try {
    setupActGlobals();
    // FLT is a LIST buffer — no FormComponent — so the navigator needs a
    // fleet-content sentinel instead of its form default (device finding
    // 2026-08-14: the form wait times out and reports a false open failure).
    const opened = await openMobileBuffer('FLT', () =>
      document
        .getElementById('container')
        ?.querySelector<HTMLElement>('[class*="Fleet__fleetHeader"]') ?? null
    );
    const anchor = document.getElementById('container');
    if (!opened || !anchor) {
      return { ok: false, error: 'Failed to open the FLT buffer' };
    }
    try {
      const button = findShipUnloadButton(anchor, registration);
      if (!button) {
        return { ok: false, error: `No unload button found for ${registration}` };
      }
      if (isApexButtonDisabled(button)) {
        return { ok: false, disabledInApex: true, error: 'Not available in APEX' };
      }
      await clickElement(button);
      // Unload commits with ActionFeedback only — no confirmation overlay
      // (device-captured 2026-08-14). The manual-confirm wiring is kept anyway
      // so a future APEX change degrades to the visible dialog, not a hang.
      const autoConfirm = useSettingsStore.getState().autoConfirm;
      const error = await waitActionFeedback({ anchor }, autoConfirm, (pending) =>
        useGameState.getState().setActConfirmPending(pending)
      );
      if (error) {
        return { ok: false, error };
      }
      return { ok: true };
    } finally {
      // Always restore APEX — even on failure the buffer must not stay parked.
      await closeMobileBuffer();
    }
  } finally {
    releaseActionLock();
  }
}
