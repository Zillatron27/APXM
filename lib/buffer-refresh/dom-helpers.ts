/**
 * APEX DOM queries and manipulation for buffer refresh.
 *
 * All DOM interaction is isolated here so the engine and batch executor
 * never touch the DOM directly. Every query returns null on failure —
 * callers decide how to handle missing elements.
 */

// -- Saved styles type --

export interface SavedStyles {
  visibility: string;
  display: string;
  position: string;
  left: string;
}

// -- Query functions --

export function getContainer(): HTMLElement | null {
  return document.getElementById('container');
}

/** Check if APEX is showing the top-level Stacks view (Buffer stack visible). */
export function isAtStacksTopLevel(): boolean {
  return findBufferStackHeader() !== null;
}

/** Find the H2 heading for the "Buffer" stack in APEX. */
export function findBufferStackHeader(): HTMLElement | null {
  const headings = document.querySelectorAll('#container h2');
  for (const h2 of headings) {
    if (h2.textContent?.trim() === 'Buffer') {
      return h2 as HTMLElement;
    }
  }
  return null;
}

/**
 * Find a clickable navigation element that goes "up" in APEX's stack hierarchy.
 *
 * APEX breadcrumbs show "stack" (singular) when inside a buffer, and
 * "stacks" (plural) from the buffer list level. Match both to handle
 * multi-level navigation depth. Element type is unknown (could be any tag),
 * so we search all leaf elements by text match.
 */
export function findBackNav(): HTMLElement | null {
  // APEX may apply CSS text-transform — compare case-insensitively
  const all = document.body.querySelectorAll('*');
  for (const el of all) {
    if (el.children.length === 0) {
      const text = el.textContent?.trim().toLowerCase();
      if (text === 'stacks' || text === 'stack') {
        return el as HTMLElement;
      }
    }
  }
  return null;
}

/**
 * Navigate back to APEX's top-level stacks view by clicking breadcrumbs iteratively.
 *
 * Handles multi-level depth (e.g., PROD buffer → buffer list → stacks top level).
 * Each iteration clicks whatever back-nav element exists ("stack" or "stacks"),
 * waits for the DOM to update, then checks if we've reached the top level.
 *
 * Returns true if top level was reached, false if navigation failed.
 */
export async function navigateToStacksTopLevel(timeoutMs: number, maxAttempts: number = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (isAtStacksTopLevel()) return true;
    const nav = findBackNav();
    if (!nav) return false;
    nav.click();
    // Wait for Buffer stack header — confirms we reached top level
    const header = await waitForElement(findBufferStackHeader, timeoutMs);
    if (header) return true;
    // Header didn't appear — we may be at an intermediate level. Loop and try again.
  }
  return isAtStacksTopLevel();
}

/** Find the "Add New Card" button inside the Buffer stack. */
export function findAddNewCardButton(): HTMLElement | null {
  // APEX may use "Add New Card" or "Add new card" — match case-insensitively
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.trim().toLowerCase() === 'add new card') {
      return btn as HTMLElement;
    }
  }
  return null;
}

/**
 * Find the "CREATE" element in the add-card form.
 * Confirmed as a <button> in POC, but may render in a portal outside
 * #container. Search all buttons in the document, fall back to leaf text.
 */
export function findCreateButton(): HTMLElement | null {
  // APEX renders "Create" in the DOM but displays "CREATE" via CSS text-transform
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.trim().toLowerCase() === 'create') {
      return btn as HTMLElement;
    }
  }
  return null;
}

/** Find the "Cancel" button in the add-card form (for cleanup). */
export function findCancelButton(): HTMLElement | null {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.trim().toLowerCase() === 'cancel') {
      return btn as HTMLElement;
    }
  }
  return null;
}


/**
 * Find a card `<li>` by its command text (case-insensitive).
 *
 * APEX cards show the command (e.g. "BS ZV-194A") in a subtitle element
 * and the resolved name (e.g. "BASE: ANTARES III - NIKE") in the h4.
 * Search the full text content of each card to match the command regardless
 * of which child element contains it.
 */
export function findCardByCommand(cmd: string): HTMLElement | null {
  const target = cmd.toLowerCase();
  const cards = document.querySelectorAll('#container li');
  for (const li of cards) {
    if (li.textContent?.toLowerCase().includes(target)) {
      return li as HTMLElement;
    }
  }
  return null;
}

/** Find the command input element in the add-card form. */
export function getCommandInput(): HTMLInputElement | null {
  // APEX may render the add-card form in a portal outside #container
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
  let fallback: HTMLInputElement | null = null;

  for (const el of inputs) {
    if (el.offsetParent === null || el.closest('apxm-overlay')) continue;

    // Prefer the new-buffer command input by its placeholder text
    const ph = el.placeholder?.toLowerCase() ?? '';
    if (ph.includes('command') || ph.includes('buffer')) {
      return el;
    }

    // Track first visible input as fallback
    if (!fallback) fallback = el;
  }
  return fallback;
}

// -- Style management --

export function saveContainerStyles(el: HTMLElement): SavedStyles {
  return {
    visibility: el.style.visibility,
    display: el.style.display,
    position: el.style.position,
    left: el.style.left,
  };
}

/** Hide the container off-screen without display:none (APEX React needs DOM alive). */
export function applyRefreshHide(el: HTMLElement): void {
  el.style.visibility = 'hidden';
  el.style.display = 'block';
  el.style.position = 'absolute';
  el.style.left = '-9999px';
}

export function restoreContainerStyles(el: HTMLElement, saved: SavedStyles): void {
  el.style.visibility = saved.visibility;
  el.style.display = saved.display;
  el.style.position = saved.position;
  el.style.left = saved.left;
}

// -- Input injection (React-compatible) --

/**
 * Set an input's value in a way that React's synthetic event system recognizes.
 *
 * Chrome: Use the native value setter to bypass React's controlled input,
 * then dispatch an 'input' event so React picks up the change.
 *
 * Firefox with Xray wrappers: The native setter trick may not work through
 * Xray, so fall back to dispatching keyboard events per character.
 */
export function setInputValue(input: HTMLInputElement, value: string): void {
  // Try the native setter approach first (works in Chrome, may work in Firefox)
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Verify it stuck — if React's controlled input overrode it, fall back
    if (input.value === value) return;
  }

  // Fallback: simulate typing each character (Firefox Xray workaround)
  console.log('[APXM BufferRefresh] Native setter failed, falling back to keyboard events');
  input.focus();
  for (const char of value) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));

    // Append character via native setter if available, otherwise direct assignment
    const current = input.value;
    if (nativeSetter) {
      nativeSetter.call(input, current + char);
    } else {
      input.value = current + char;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
  }
}

// -- DOM waiting utility --

/**
 * Wait for an element to appear in the DOM using MutationObserver.
 *
 * The selectorFn is called immediately (element may already exist) and
 * on every DOM mutation. A setTimeout safety net fires at timeoutMs.
 * The observer disconnects as soon as the element is found or timeout fires.
 */
export function waitForElement<T extends HTMLElement>(
  selectorFn: () => T | null,
  timeoutMs: number
): Promise<T | null> {
  return new Promise((resolve) => {
    // Check if already present
    const existing = selectorFn();
    if (existing) {
      resolve(existing);
      return;
    }

    let resolved = false;

    const observer = new MutationObserver(() => {
      if (resolved) return;
      const el = selectorFn();
      if (el) {
        resolved = true;
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      // One last check — mutation may have fired between last callback and timeout
      resolve(selectorFn());
    }, timeoutMs);
  });
}
