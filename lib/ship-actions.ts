// One-tap ship unload (first slice of the ship actions, #9/#25): the user taps
// UNLOAD in APXM's ship sheet, and APXM drives the FLT buffer off-screen —
// open buffer, click the ship's own unload button, observe the feedback
// overlay, close and restore. APEX's unload commits immediately with NO
// confirmation overlay (device-captured 2026-08-14): the user's APXM tap IS
// the commit, same model as the contract actions.

import { openMobileBuffer, closeMobileBuffer } from './mobile-buffer-navigator';
import { waitActionFeedback } from './act/action-feedback';
import { setupActGlobals } from './act/globals-setup';
import { clickElement } from './act/_compat';
import { acquireActionLock, releaseActionLock } from './act/action-lock';
import { isApexButtonDisabled } from './act/apex-button';
import { useSettingsStore } from '../stores/settings';
import { useGameState } from '../stores/gameState';

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

export async function runShipUnload(registration: string): Promise<ShipActionResult> {
  // One driven action at a time across all action modules (contract actions
  // too) — concurrent runs would fight over #container.
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is already running' };
  }
  try {
    setupActGlobals();
    const opened = await openMobileBuffer('FLT');
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
