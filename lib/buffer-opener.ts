/**
 * Opens an APEX buffer as a new tile on the desktop layout.
 *
 * Desktop counterpart to the mobile buffer-refresh engine — instead of
 * invisible data harvesting, this opens a buffer and leaves it visible.
 * Reuses dom-helpers for React-compatible input injection and DOM waits.
 */

import {
  findAddNewCardButton,
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

/** Get all currently visible text inputs (for diffing before/after click). */
function getVisibleInputs(): Set<HTMLInputElement> {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
  const visible = new Set<HTMLInputElement>();
  for (const el of inputs) {
    if (el.offsetParent !== null && !el.closest('apxm-overlay')) {
      visible.add(el);
    }
  }
  return visible;
}

export async function openBuffer(command: string): Promise<boolean> {
  try {
    const addBtn = findAddNewCardButton() ?? findNewBfrButton();
    if (!addBtn) {
      console.error('[APXM] Could not find new-buffer button');
      return false;
    }

    // Snapshot existing inputs before clicking so we can find the new one
    const inputsBefore = getVisibleInputs();
    addBtn.click();

    // Wait for a NEW input to appear that wasn't in the snapshot
    const input = await waitForElement(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
      for (const el of inputs) {
        if (el.offsetParent !== null && !el.closest('apxm-overlay') && !inputsBefore.has(el)) {
          return el;
        }
      }
      return null;
    }, STEP_TIMEOUT_MS);

    if (!input) {
      console.error('[APXM] Command input did not appear');
      findCancelButton()?.click();
      return false;
    }

    setInputValue(input, command);

    // Confirm — try CREATE button, then form submit, then Enter key
    const createBtn = findCreateButton();
    if (createBtn) {
      createBtn.click();
    } else if (input.form) {
      input.form.requestSubmit();
    } else {
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
