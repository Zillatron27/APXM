// NOTS mark-as-read passthrough (#93): the user taps READ on an APXM alert
// row (or MARK ALL READ on the panel), and APXM drives APEX's own NOTS
// buffer off-screen — open buffer, click APEX's row or "mark all as read"
// button, confirm via the alerts store, close and restore. This satisfies
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
import { setupActGlobals } from './act/globals-setup';
import { clickElement } from './act/_compat';
import { acquireActionLock, releaseActionLock } from './act/action-lock';
import { isApexButtonDisabled } from './act/apex-button';
import { useAlertsStore } from '../stores/entities';

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
 * NOTS is a LIST buffer with no form (device finding 2026-08-27) — the
 * default findReady (findBufferForm) never resolves and openMobileBuffer
 * times out reporting a false "Failed to open NOTS". APEX always renders the
 * "mark all as read" button, even against zero rows, so it's the readiness
 * sentinel for this buffer.
 */
function notsReady(): HTMLElement | null {
  const anchor = document.getElementById('container');
  return anchor ? findMarkAllReadButton(anchor) ?? null : null;
}

/**
 * Wait for the server's confirmation that `ids` are read, via the alerts
 * store rather than APEX's ActionFeedback overlay. Device finding
 * 2026-08-27: neither a NOTS row click nor "mark all as read" ever shows
 * that overlay — it's a form-action mechanism, and NOTS has no form. The
 * real confirmation is the server's ALERTS_ALERTS landing in the store, so
 * that's what this polls for. Resolves true once every id is either
 * `read === true` or has left the store entirely (aged out / superseded);
 * false if `timeoutMs` elapses first. Always unsubscribes before returning.
 */
export function waitForAlertsRead(ids: string[], timeoutMs = 5000): Promise<boolean> {
  const isSatisfied = () =>
    ids.every((id) => {
      const alert = useAlertsStore.getState().getById(id);
      return alert === undefined || alert.read === true;
    });

  if (isSatisfied()) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = useAlertsStore.subscribe(() => {
      if (settled || !isSatisfied()) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
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
    const opened = await openMobileBuffer('NOTS', notsReady);
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
      const confirmed = await waitForAlertsRead([alertId]);
      if (!confirmed) {
        return { ok: false, error: 'APEX did not confirm the read' };
      }
      return { ok: true };
    } finally {
      // The click above marks the alert read AND opens its target buffer as
      // a new appended card in the Buffer stack (device finding 2026-08-27)
      // — a card no command of ours created, so it needs the opt-in sweep.
      await closeMobileBuffer({ sweepAppended: true });
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
    const opened = await openMobileBuffer('NOTS', notsReady);
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
      // Captured BEFORE the click: APEX's own view of what's unread is
      // authoritative, and the click empties this set server-side.
      const unreadIds = useAlertsStore
        .getState()
        .getAll()
        .filter((a) => a.read === false)
        .map((a) => a.id);
      await clickElement(button);
      // If APXM's store somehow shows nothing unread but APEX's button was
      // enabled, still wait — for an empty id list waitForAlertsRead
      // resolves immediately, so this never blocks on a click that already
      // happened.
      const confirmed = await waitForAlertsRead(unreadIds);
      if (!confirmed) {
        return { ok: false, error: 'APEX did not confirm the read' };
      }
      return { ok: true };
    } finally {
      await closeMobileBuffer();
    }
  } finally {
    releaseActionLock();
  }
}
