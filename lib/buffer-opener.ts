/**
 * Opens an APEX buffer as a new tile on the desktop layout.
 *
 * Desktop counterpart to the mobile buffer-refresh engine — instead of
 * invisible data harvesting, this opens a buffer and leaves it visible.
 * Reuses dom-helpers for React-compatible input injection and DOM waits.
 */

import {
  findAddNewCardButton,
  getCommandInput,
  setInputValue,
  findCreateButton,
  findCancelButton,
  waitForElement,
} from './buffer-refresh/dom-helpers';

const STEP_TIMEOUT_MS = 2000;

/** Find the "NEW BFR" element in the desktop tile dock (a div, not a button). */
function findNewBfrButton(): HTMLElement | null {
  return document.getElementById('TOUR_TARGET_BUTTON_BUFFER_NEW');
}

export async function openBuffer(command: string): Promise<boolean> {
  try {
    // Find and click the new-buffer button — try mobile name first, then desktop variant
    const addBtn = findAddNewCardButton() ?? findNewBfrButton();
    if (!addBtn) {
      console.error('[APXM] Could not find new-buffer button');
      return false;
    }
    addBtn.click();

    // Wait for command input to appear
    const input = await waitForElement(getCommandInput, STEP_TIMEOUT_MS);
    if (!input) {
      console.error('[APXM] Command input did not appear');
      findCancelButton()?.click();
      return false;
    }

    // Inject command string
    setInputValue(input, command);

    // Confirm — try CREATE button, then form submit, then Enter key sequence
    const createBtn = findCreateButton();
    if (createBtn) {
      createBtn.click();
    } else if (input.form) {
      input.form.requestSubmit();
    } else {
      // Simulate full Enter key sequence on the focused input
      input.focus();
      const enterProps = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
      input.dispatchEvent(new KeyboardEvent('keydown', enterProps));
      input.dispatchEvent(new KeyboardEvent('keypress', enterProps));
      input.dispatchEvent(new KeyboardEvent('keyup', enterProps));
    }

    console.log(`[APXM] Opened buffer: ${command}`);
    return true;
  } catch (err) {
    console.error('[APXM] Failed to open buffer:', err);
    return false;
  }
}
