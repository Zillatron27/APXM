// NOTS mark-as-read passthrough (#93): the user taps READ on an APXM alert
// row (or MARK ALL READ on the panel), and APXM drives APEX's own NOTS
// buffer off-screen — open buffer, click APEX's row or "mark all as read"
// button, observe the feedback overlay, close and restore. This satisfies
// the HARD RULE on action authorisation (see CLAUDE.md): APXM never sends
// ALERTS_MARK_AS_READ itself. APEX sends that message and the server
// confirms it; APXM only clicks a control that already exists in APEX's
// own UI. The user's tap on the APXM button is the authorisation for the
// click that follows — the same one-tap-one-commit shape as
// runContractAction.
//
// The NOTS buffer renders APEX's full alert history (hundreds of rows on a
// long-lived account — see the discovery spec), not just the unread ones
// APXM shows. It is opened only for the duration of the click and closed
// immediately after, exactly like every other driven buffer.
//
// See ~/Projects/project-context/apxm/specs/nots-mark-read-discovery.md for
// the device-captured DOM shapes and wire trace this module implements.

import { openMobileBuffer, closeMobileBuffer } from './mobile-buffer-navigator';
import { waitActionFeedback } from './act/action-feedback';
import { setupActGlobals } from './act/globals-setup';
import { clickElement } from './act/_compat';
import { acquireActionLock, releaseActionLock } from './act/action-lock';
import { isApexButtonDisabled } from './act/apex-button';
import { useSettingsStore } from '../stores/settings';
import { useGameState } from '../stores/gameState';

export type AlertActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** "mark all as read" exists but APEX renders it disabled — nothing is
       *  unread in APEX's own view. Mirror the disabled state, don't retry. */
      disabledInApex?: true;
    };

/**
 * Finds an alert's row inside the opened NOTS buffer by its game id.
 * Exported for tests, mirroring findContractActionButton.
 */
export function findAlertRow(anchor: HTMLElement, alertId: string): HTMLElement | undefined {
  // alertId comes off the wire: compare the attribute value directly rather
  // than interpolating untrusted text into a selector.
  return Array.from(
    anchor.querySelectorAll<HTMLElement>('[class*="AlertListItem__container"]')
  ).find((row) => row.dataset.prunId === alertId);
}

/**
 * Finds APEX's "mark all as read" button inside the opened NOTS buffer.
 * APEX renders CSS text-transform: uppercase, so visible text differs from
 * actual textContent — match case-insensitively (CLAUDE.md gotcha).
 * Exported for tests.
 */
export function findMarkAllReadButton(anchor: HTMLElement): HTMLElement | undefined {
  return Array.from(anchor.getElementsByTagName('button')).find(
    (el) => el.textContent?.trim().toLowerCase() === 'mark all as read'
  );
}

/**
 * Marks one alert read by opening NOTS and clicking APEX's own row for it —
 * the same click a user would make in APEX. There is no per-alert dismiss
 * control; the row itself is the only click target (see discovery spec).
 */
export async function markAlertRead(alertId: string): Promise<AlertActionResult> {
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is already running' };
  }
  try {
    setupActGlobals();
    const opened = await openMobileBuffer('NOTS');
    const anchor = document.getElementById('container');
    if (!opened || !anchor) {
      return { ok: false, error: 'Failed to open NOTS' };
    }
    try {
      const row = findAlertRow(anchor, alertId);
      if (!row) {
        // Not a transient failure — the alert already left APEX's NOTS list
        // (read elsewhere, or aged out). Retrying won't produce a row.
        return { ok: false, error: 'Alert not found in NOTS — already read or removed' };
      }
      await clickElement(row);
      const autoConfirm = useSettingsStore.getState().autoConfirm;
      const error = await waitActionFeedback({ anchor }, autoConfirm, (pending) =>
        useGameState.getState().setActConfirmPending(pending)
      );
      if (error) {
        return { ok: false, error };
      }
      return { ok: true };
    } finally {
      await closeMobileBuffer();
    }
  } finally {
    releaseActionLock();
  }
}

/**
 * Marks every unread alert read by opening NOTS and clicking APEX's own
 * "mark all as read" button. APEX sends ALERTS_MARK_AS_READ with every
 * unread id itself (see discovery spec wire trace) — APXM only supplies
 * the click.
 */
export async function markAllAlertsRead(): Promise<AlertActionResult> {
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is already running' };
  }
  try {
    setupActGlobals();
    const opened = await openMobileBuffer('NOTS');
    const anchor = document.getElementById('container');
    if (!opened || !anchor) {
      return { ok: false, error: 'Failed to open NOTS' };
    }
    try {
      const button = findMarkAllReadButton(anchor);
      if (!button) {
        return { ok: false, error: 'No "mark all as read" button found in NOTS' };
      }
      if (isApexButtonDisabled(button)) {
        return { ok: false, disabledInApex: true, error: 'Nothing unread in APEX' };
      }
      await clickElement(button);
      const autoConfirm = useSettingsStore.getState().autoConfirm;
      const error = await waitActionFeedback({ anchor }, autoConfirm, (pending) =>
        useGameState.getState().setActConfirmPending(pending)
      );
      if (error) {
        return { ok: false, error };
      }
      return { ok: true };
    } finally {
      await closeMobileBuffer();
    }
  } finally {
    releaseActionLock();
  }
}
