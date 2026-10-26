// Extracted from runner/step-machine.ts so a single implementation serves
// both the ACT step machine and one-shot passthrough actions (contract
// ACCEPT/REJECT — issue #73). Fire-and-observe: after a button click in an
// APEX buffer, watch the ActionFeedback overlay through progress /
// confirmation / success / error.

import { clickElement } from './_compat';
import type { PrunTile } from './runtime-types';

// APEX clears the progress state within seconds; a minute means the overlay
// is wedged (reconnect, buffer torn down) and waiting longer would hold the
// shared action lock until page reload.
const PROGRESS_TIMEOUT_MS = 60_000;
const FEEDBACK_LOST = 'Action feedback lost — check APEX';
const CONFIRM_ABANDONED = 'Stopped waiting for APEX confirmation';

// Ends the in-flight manual-confirm wait, if any. Set only while
// waitConfirmationResolved is pending — there is at most one, because the
// shared action lock allows one driven action at a time.
let abandonPendingConfirm: (() => void) | null = null;

/**
 * APXM-side escape from the manual-confirm wait (ConfirmBar's button). The
 * human wait has no timeout by design, so this is what guarantees the action
 * lock can always be released without a reload — e.g. when APEX's dialog is
 * unreachable. While APEX's dialog is still asking, it taps APEX's cancel so
 * no confirmable dialog is left behind; it never confirms. If the dialog has
 * already moved on (the user's CONFIRM landed), it clicks nothing and the
 * wait follows the real outcome. No-op when no wait is pending.
 */
export function abandonManualConfirmWait(): void {
  abandonPendingConfirm?.();
}

export async function waitActionFeedback(
  tile: PrunTile,
  autoConfirm: boolean,
  /**
   * Fired around the manual-confirm window (true right before the wait,
   * false when it resolves). The APXM shadow host is an opaque fullscreen
   * cover, so whoever runs the action must use this signal to make APEX
   * visible for the user's CONFIRM tap — the engine's own un-hide of
   * #container below is not enough on its own.
   */
  onManualConfirm?: (pending: boolean) => void
): Promise<string | undefined> {
  const overlay = await $(tile.anchor, C.ActionFeedback.overlay);
  if (!overlay) {
    return 'Action feedback overlay did not appear';
  }
  if (!(await waitActionProgress(overlay))) {
    return FEEDBACK_LOST;
  }
  if (overlay.classList.contains(C.ActionConfirmationOverlay.container)) {
    if (autoConfirm) {
      // Matched by label, never position — the mirror of the cancel match in
      // waitConfirmationResolved. No label match clicks nothing: guessing
      // here could tap the wrong button. textContent is lowercase in APEX.
      const confirm = _$$(overlay, C.Button.btn).find(btn =>
        /confirm/i.test(btn.textContent ?? ''),
      );
      if (confirm === undefined) {
        return 'Confirmation overlay is missing confirm button';
      }
      await clickElement(confirm);
    } else {
      // Manual confirm (the default): the user must tap APEX's CONFIRM
      // themselves. The buffer may be parked off-screen (openMobileBuffer
      // hides #container — CXPO leaves it hidden), so bring it on-screen for
      // the tap and restore afterwards. MTRA already shows the container, in
      // which case this save/restore is a no-op.
      const anchor = tile.anchor;
      const prev = { visibility: anchor.style.visibility, left: anchor.style.left };
      anchor.style.visibility = 'visible';
      anchor.style.left = '0px';
      onManualConfirm?.(true);
      let abandoned: boolean;
      try {
        abandoned = !(await waitConfirmationResolved(overlay));
      } finally {
        onManualConfirm?.(false);
        anchor.style.left = prev.left;
        anchor.style.visibility = prev.visibility;
      }
      if (abandoned) {
        return CONFIRM_ABANDONED;
      }
    }
    if (!(await waitActionProgress(overlay))) {
      return FEEDBACK_LOST;
    }
  }
  if (overlay.classList.contains(C.ActionFeedback.success)) {
    await clickElement(overlay);
    return;
  }
  if (overlay.classList.contains(C.ActionFeedback.error)) {
    const message = _$(overlay, C.ActionFeedback.message)?.textContent;
    const dismiss = _$(overlay, C.ActionFeedback.dismiss)?.textContent;
    return dismiss ? message?.replace(dismiss, '') ?? undefined : message ?? undefined;
  }

  return 'Unknown action feedback overlay';
}

// Calls onDetached once the overlay leaves the document by any route: its
// own removal, or removal of any ancestor. Watching only the parent's subtree
// misses the parent itself being removed, so this watches the whole body and
// asks isConnected, which is true exactly while the node is in the document.
function observeDetach(overlay: HTMLElement, onDetached: () => void): MutationObserver {
  const observer = new MutationObserver(() => {
    if (!overlay.isConnected) {
      onDetached();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

// Manual-confirm wait: resolves true when the overlay leaves the confirmation
// state. Exits: (a) the overlay's own classList changes — after the user
// taps CONFIRM, APEX transitions the same element through progress to
// success/error, exactly the transition the auto-click path observes;
// (b) the overlay is detached — the user tapped CANCEL or APEX dismissed it
// (a cancel then falls through the success/error checks and fails the step);
// (c) resolves false when the user abandons the wait from APXM.
// No timeout: like waitAct(), a human decision is unbounded.
function waitConfirmationResolved(overlay: HTMLElement): Promise<boolean> {
  if (!overlay.classList.contains(C.ActionConfirmationOverlay.container) || !overlay.isConnected) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>(resolve => {
    let settled = false;
    const done = (resolved: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      attrObserver.disconnect();
      removalObserver.disconnect();
      abandonPendingConfirm = null;
      resolve(resolved);
    };
    const attrObserver = new MutationObserver(() => {
      if (!overlay.classList.contains(C.ActionConfirmationOverlay.container)) {
        done(true);
      }
    });
    attrObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    const removalObserver = observeDetach(overlay, () => done(true));
    abandonPendingConfirm = () => {
      // Decide from the live DOM, not observer state: the class observer may
      // not have run yet for a transition that already happened.
      const stillConfirming =
        overlay.isConnected &&
        overlay.classList.contains(C.ActionConfirmationOverlay.container);
      if (!stillConfirming) {
        done(true);
        return;
      }
      // Matched by label, never position: the confirm button must be
      // impossible to hit from here. textContent is lowercase in APEX's DOM.
      const cancel = _$$(overlay, C.Button.btn).find(btn =>
        /cancel/i.test(btn.textContent ?? ''),
      );
      if (cancel) {
        (cancel as HTMLElement).click();
      } else {
        console.warn('[APXM] confirmation dialog has no cancel button; abandoning wait only');
      }
      done(false);
    };
  });
}

// Resolves true when the overlay leaves the progress state, false if the
// overlay is detached while in progress or stays there past the timeout.
// Unlike the manual-confirm wait this is machine time, so it is bounded.
function waitActionProgress(overlay: HTMLElement): Promise<boolean> {
  if (!overlay.classList.contains(C.ActionFeedback.progress)) {
    return Promise.resolve(true);
  }
  if (!overlay.isConnected) {
    return Promise.resolve(false);
  }
  return new Promise<boolean>(resolve => {
    const done = (cleared: boolean) => {
      attrObserver.disconnect();
      removalObserver.disconnect();
      clearTimeout(timer);
      resolve(cleared);
    };
    const attrObserver = new MutationObserver(() => {
      if (!overlay.classList.contains(C.ActionFeedback.progress)) {
        done(true);
      }
    });
    attrObserver.observe(overlay, { attributes: true });
    const removalObserver = observeDetach(overlay, () => done(false));
    const timer = setTimeout(() => done(false), PROGRESS_TIMEOUT_MS);
  });
}
