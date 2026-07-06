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
import { useSettingsStore } from '../stores/settings';
import { useGameState } from '../stores/gameState';

export type ContractActionTarget =
  | { kind: 'accept' }
  | { kind: 'reject' }
  /** conditionIndex is the ordinal among AVAILABLE (fulfillable) conditions
   *  in contract order — APEX renders a button per fulfillable row, so the
   *  Nth matched button belongs to the Nth available condition, not to the
   *  condition's raw index. */
  | { kind: 'fulfill'; conditionIndex: number };

export type ContractActionResult = { ok: true } | { ok: false; error: string };

// APEX renders CSS text-transform: uppercase, so visible label case is
// meaningless — match textContent case-insensitively (CLAUDE.md gotcha).
// FULFILL labels are the discovery surface of this feature: nobody documents
// the CONT buffer's DOM (rPrun never drives it), so the candidate set grows
// from device testing. Condition types whose button opens a form instead of
// committing are documented as not-one-tappable, not special-cased here.
const TARGET_LABELS: Record<'accept' | 'reject' | 'fulfill', string[]> = {
  accept: ['accept'],
  reject: ['reject', 'decline'],
  fulfill: ['fulfill', 'fulfil', 'pay', 'provide'],
};

/**
 * Finds the APEX button for a target inside the opened CONT buffer. For
 * fulfill, the available-ordinal picks among multiple matches (see
 * ContractActionTarget). Exported for tests.
 */
export function findContractActionButton(
  root: HTMLElement,
  target: ContractActionTarget
): HTMLElement | undefined {
  const labels = TARGET_LABELS[target.kind];
  const matches: HTMLElement[] = [];
  for (const el of Array.from(root.getElementsByTagName('button'))) {
    const text = el.textContent?.trim().toLowerCase() ?? '';
    if (labels.some((label) => text === label)) {
      matches.push(el);
    }
  }
  if (target.kind !== 'fulfill') {
    return matches[0];
  }
  // Multiple fulfillable conditions render multiple buttons; a single match
  // is used regardless of index (the other conditions render none).
  return matches.length === 1 ? matches[0] : matches[target.conditionIndex];
}

// One driven action at a time — a second tap while a buffer is being driven
// would fight over #container. Module-level like the MTRA buffer cache.
let inFlight = false;

export function isContractActionInFlight(): boolean {
  return inFlight;
}

export async function runContractAction(
  localId: string,
  target: ContractActionTarget
): Promise<ContractActionResult> {
  if (inFlight) {
    return { ok: false, error: 'Another action is already running' };
  }
  inFlight = true;
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
    inFlight = false;
  }
}
