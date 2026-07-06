/**
 * Mobile buffer navigator for the ported ACT action runner.
 *
 * Desktop refined-prun opens a dedicated tile per buffer command via its
 * TileAllocator. Mobile APEX has a single serial buffer and a hierarchical
 * Stack UI, so this module drives the same Stack-navigation sequence the
 * buffer-refresh engine already uses (see lib/buffer-refresh/engine.ts) to
 * open an arbitrary buffer command, then waits for the buffer's form to render.
 *
 * Unlike the buffer-refresh engine, the navigator deliberately does NOT restore
 * #container after a successful open: the buffer must stay open (off-screen) so
 * the action runner can drive its form. restoreContainerStyles only happens in
 * closeMobileBuffer (or after a failed open).
 */

import {
  getContainer,
  isAtStacksTopLevel,
  navigateToStacksTopLevel,
  saveContainerStyles,
  applyRefreshHide,
  restoreContainerStyles,
  findBufferStackHeader,
  findAddNewCardButton,
  getCommandInput,
  findCreateButton,
  findCancelButton,
  findCardByCommand,
  setInputValue,
  waitForElement,
  type SavedStyles,
} from './buffer-refresh/dom-helpers';
import { warn, error } from './debug/logger';

/** Timeout for each Stack-navigation DOM step. */
const STEP_TIMEOUT_MS = 2000;

/**
 * Timeout for the buffer form to render after the card is clicked. Longer than
 * a navigation step because opening a buffer can involve a server round-trip.
 */
const FORM_TIMEOUT_MS = 10000;

/**
 * Original #container styles, captured by the first openMobileBuffer call and
 * held until closeMobileBuffer restores them. Subsequent openMobileBuffer calls
 * (one per buffer command in a multi-step action package) must NOT recapture —
 * that would record the already-hidden styles and leak them on restore.
 */
let savedStyles: SavedStyles | null = null;

/**
 * The buffer form sentinel. APEX renders a FormComponent container element
 * inside an open buffer; its CSS-module class (FormComponent__containerActive
 * / Passive / Command and the Mobile variants) is identical on mobile and
 * desktop. Matching the class prefix avoids depending on a build-time hash map.
 */
function findBufferForm(): HTMLElement | null {
  const container = getContainer();
  if (!container) {
    return null;
  }
  return container.querySelector<HTMLElement>('[class*="FormComponent__container"]');
}

/**
 * Open an APEX buffer for `command` by driving the mobile Stack UI.
 *
 * Mirrors lib/buffer-refresh/engine.ts steps 1-8, then waits for the buffer's
 * form to render. #container is hidden off-screen and stays hidden on success —
 * the caller drives the form via the off-screen DOM and calls closeMobileBuffer
 * when done. On failure the page is restored before returning false.
 */
export async function openMobileBuffer(command: string): Promise<boolean> {
  const container = getContainer();
  if (!container) {
    error('openMobileBuffer: #container not found');
    return false;
  }

  // Capture the pristine styles once. Later calls reuse them so a multi-buffer
  // action package restores the real styles, not the off-screen ones.
  if (savedStyles === null) {
    savedStyles = saveContainerStyles(container);
  }

  try {
    // Step 1-2: ensure we're at the Stacks top level (Buffer stack header visible).
    if (!isAtStacksTopLevel()) {
      const header = await waitForElement(findBufferStackHeader, STEP_TIMEOUT_MS);
      if (!header) {
        const reached = await navigateToStacksTopLevel(STEP_TIMEOUT_MS);
        if (!reached) {
          throw new Error('Could not navigate to Stacks top level');
        }
      }
    }

    // Step 3: hide #container off-screen (React keeps the DOM alive).
    applyRefreshHide(container);

    // Step 4: open the Buffer stack.
    const stackHeader = findBufferStackHeader();
    if (!stackHeader) {
      throw new Error('Buffer stack header disappeared');
    }
    stackHeader.click();

    // Step 5: add a new card.
    const addButton = await waitForElement(findAddNewCardButton, STEP_TIMEOUT_MS);
    if (!addButton) {
      throw new Error('Add New Card button did not appear');
    }
    addButton.click();

    // Step 6: enter the buffer command.
    const input = await waitForElement(getCommandInput, STEP_TIMEOUT_MS);
    if (!input) {
      throw new Error('Command input did not appear');
    }
    setInputValue(input, command);

    // Step 7: confirm card creation.
    const createBtn = await waitForElement(findCreateButton, STEP_TIMEOUT_MS);
    if (!createBtn) {
      throw new Error('CREATE button did not appear');
    }
    createBtn.click();

    // Step 8: open the freshly created card.
    const card = await waitForElement(() => findCardByCommand(command), STEP_TIMEOUT_MS);
    if (!card) {
      throw new Error(`Card for "${command}" did not appear`);
    }
    card.click();

    // Step 9: wait for the buffer's form to render.
    const form = await waitForElement(findBufferForm, FORM_TIMEOUT_MS);
    if (!form) {
      throw new Error(`Buffer form for "${command}" did not render`);
    }

    return true;
  } catch (err) {
    error('openMobileBuffer:', err instanceof Error ? err.message : String(err));
    // Restore the page so a failed open never leaves APEX hidden off-screen.
    await closeMobileBuffer();
    return false;
  }
}

/**
 * Close the current buffer: dismiss any leftover add-card dialog, navigate back
 * to the Stacks top level, and restore #container to its pre-open styles.
 *
 * Safe to call when no buffer is open — every step is a no-op in that case.
 */
export async function closeMobileBuffer(): Promise<void> {
  // Dismiss a half-finished add-card dialog left behind by a failed open.
  const cancelBtn = findCancelButton();
  if (cancelBtn) {
    cancelBtn.click();
  }

  // Navigate back out of any open buffer to the Stacks top level.
  if (!isAtStacksTopLevel()) {
    const reached = await navigateToStacksTopLevel(STEP_TIMEOUT_MS);
    if (!reached) {
      warn('closeMobileBuffer: could not navigate back to Stacks top level');
    }
  }

  // Restore #container so APEX is visible again.
  const container = getContainer();
  if (container && savedStyles) {
    restoreContainerStyles(container, savedStyles);
  }
  savedStyles = null;
}
