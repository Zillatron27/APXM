// One-tap contract actions (#73): the user taps ACCEPT / REJECT / FULFILL in
// APXM's contract sheet, and APXM drives the CONT buffer off-screen —
// open buffer, click the matching APEX button, observe the feedback overlay,
// close and restore. The user's tap IS the commit (one tap, one action); if
// APEX pops its confirmation dialog and settings.autoConfirm is off, the
// manual-confirm visibility mode hands them the dialog itself.

import { openMobileBuffer, closeMobileBuffer } from './mobile-buffer-navigator';
import { waitActionFeedback } from './act/action-feedback';
import { setupActGlobals } from './act/globals-setup';
import { clickElement } from './act/_compat';
import { acquireActionLock, releaseActionLock } from './act/action-lock';
import { useSettingsStore } from '../stores/settings';
import { useGameState } from '../stores/gameState';

export { isApexButtonDisabled } from './act/apex-button';
import { isApexButtonDisabled } from './act/apex-button';

export type ContractActionTarget =
  | { kind: 'accept' }
  | { kind: 'reject' }
  | { kind: 'terminate' }
  /** conditionNumber is the game-displayed condition number (condition.index
   *  + 1), matched against the CONT buffer row's Index cell ("#3"). Device
   *  finding (2026-08-13): APEX renders a — possibly disabled — button on
   *  EVERY self non-fulfilled row, so counting matched buttons by APXM's
   *  available-ordinal picks the wrong row whenever the two sets differ. */
  | { kind: 'fulfill'; conditionNumber: number };

export type ContractActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** The target button exists but APEX renders it disabled — the game
       *  gates on state the WS data doesn't expose (shipment arrival, funds).
       *  The view mirrors the disabled state instead of showing the error. */
      disabledInApex?: true;
    };

// APEX renders CSS text-transform: uppercase, so visible label case is
// meaningless — match textContent case-insensitively (CLAUDE.md gotcha).
// FULFILL labels are the discovery surface of this feature: nobody documents
// the CONT buffer's DOM (rPrun never drives it), so the candidate set grows
// from device testing. Condition types whose button opens a form instead of
// committing are documented as not-one-tappable, not special-cased here.
const TARGET_LABELS: Record<'accept' | 'reject' | 'terminate' | 'fulfill', string[]> = {
  accept: ['accept'],
  reject: ['reject', 'decline'],
  terminate: ['request termination'],
  fulfill: ['fulfill', 'fulfil', 'pay', 'provide'],
};

function labelMatches(el: HTMLElement, labels: string[]): boolean {
  const text = el.textContent?.trim().toLowerCase() ?? '';
  return labels.some((label) => text === label);
}

/**
 * Finds the APEX button for a target inside the opened CONT buffer.
 * Contract-level accept/reject match by label alone. Fulfill is addressed by
 * ROW: the conditions table's first cell carries the game-displayed condition
 * number ("#3"), so the button is taken from that row — never by counting
 * matches, which misaligns against disabled rows (see ContractActionTarget).
 * Falls back to a single unambiguous label match if the table shape ever
 * changes. Exported for tests.
 */
export function findContractActionButton(
  root: HTMLElement,
  target: ContractActionTarget
): HTMLElement | undefined {
  const labels = TARGET_LABELS[target.kind];
  const matches = Array.from(root.getElementsByTagName('button')).filter((el) =>
    labelMatches(el, labels)
  );
  if (target.kind !== 'fulfill') {
    return matches[0];
  }

  const rowLabel = `#${target.conditionNumber}`;
  for (const row of Array.from(root.getElementsByTagName('tr'))) {
    const indexCell = row.getElementsByTagName('td')[0];
    if (indexCell?.textContent?.trim() !== rowLabel) continue;
    return Array.from(row.getElementsByTagName('button')).find((el) =>
      labelMatches(el, labels)
    );
  }
  // Row addressing found nothing — only trust a label match if it's the sole
  // candidate; guessing among several risks committing the wrong condition.
  return matches.length === 1 ? matches[0] : undefined;
}

export async function runContractAction(
  localId: string,
  target: ContractActionTarget
): Promise<ContractActionResult> {
  // One driven action at a time across all action modules (ship actions too) —
  // a second tap while a buffer is being driven would fight over #container.
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is already running' };
  }
  try {
    setupActGlobals();
    const opened = await openMobileBuffer(`CONT ${localId}`);
    const anchor = document.getElementById('container');
    if (!opened || !anchor) {
      return { ok: false, error: `Failed to open CONT ${localId}` };
    }
    try {
      const button = findContractActionButton(anchor, target);
      if (!button) {
        return {
          ok: false,
          error:
            target.kind === 'fulfill'
              ? 'No fulfill button found — this condition type may need APEX (see #73)'
              : `No ${target.kind} button found in the contract buffer`,
        };
      }
      if (isApexButtonDisabled(button)) {
        return { ok: false, disabledInApex: true, error: 'Not yet enabled in APEX' };
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
      // Always restore APEX — even on failure the buffer must not stay parked.
      await closeMobileBuffer();
    }
  } finally {
    releaseActionLock();
  }
}
