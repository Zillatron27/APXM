// Extracted from runner/step-machine.ts so a single implementation serves
// both the ACT step machine and one-shot passthrough actions (contract
// ACCEPT/REJECT — issue #73). Fire-and-observe: after a button click in an
// APEX buffer, watch the ActionFeedback overlay through progress /
// confirmation / success / error.

import { clickElement } from './_compat';
import type { PrunTile } from './runtime-types';

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
  await waitActionProgress(overlay);
  if (overlay.classList.contains(C.ActionConfirmationOverlay.container)) {
    if (autoConfirm) {
      const confirm = _$$(overlay, C.Button.btn)[1];
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
      try {
        await waitConfirmationResolved(overlay);
      } finally {
        onManualConfirm?.(false);
        anchor.style.left = prev.left;
        anchor.style.visibility = prev.visibility;
      }
    }
    await waitActionProgress(overlay);
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

// Manual-confirm wait: resolves when the overlay leaves the confirmation
// state. Two exits: (a) the overlay's own classList changes — after the user
// taps CONFIRM, APEX transitions the same element through progress to
// success/error, exactly the transition the auto-click path observes; or
// (b) the overlay is detached — the user tapped CANCEL or APEX dismissed it
// (a cancel then falls through the success/error checks and fails the step).
// No timeout: like waitAct(), a human decision is unbounded.
function waitConfirmationResolved(overlay: HTMLElement): Promise<void> {
  if (!overlay.classList.contains(C.ActionConfirmationOverlay.container) || !overlay.isConnected) {
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    const done = () => {
      attrObserver.disconnect();
      removalObserver.disconnect();
      resolve();
    };
    const attrObserver = new MutationObserver(() => {
      if (!overlay.classList.contains(C.ActionConfirmationOverlay.container)) {
        done();
      }
    });
    attrObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    // A class observer never fires on node removal — watch the parent tree.
    const removalObserver = new MutationObserver(() => {
      if (!overlay.isConnected) {
        done();
      }
    });
    removalObserver.observe(overlay.parentElement ?? document.body, {
      childList: true,
      subtree: true,
    });
  });
}

async function waitActionProgress(overlay: HTMLElement) {
  if (!overlay.classList.contains(C.ActionFeedback.progress)) {
    return;
  }
  await new Promise<void>(resolve => {
    const mutationObserver = new MutationObserver(() => {
      if (!overlay.classList.contains(C.ActionFeedback.progress)) {
        mutationObserver.disconnect();
        resolve();
      }
    });
    mutationObserver.observe(overlay, { attributes: true });
  });
}
