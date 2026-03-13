/**
 * APXM Button — injects a styled button into APEX's toolbar area.
 *
 * On click: if an APXM screen exists, navigate to it.
 * If not, open a Create Screen (CS) buffer with pre-filled fields.
 */

import { useScreensStore } from '../stores/screens';
import { openBuffer } from './buffer-opener';
import { setInputValue, waitForElement } from './buffer-refresh/dom-helpers';

const BUTTON_ID = 'apxm-apex-button';
const CS_FORM_TIMEOUT_MS = 3000;

/** Find the APEX toolbar anchor point for button insertion. */
function findAnchor(): HTMLElement | null {
  // Try known APEX tour target ID first
  const tourTarget = document.getElementById('TOUR_TARGET_BUTTON_BUFFER_NEW');
  if (tourTarget) return tourTarget;

  // Fallback: text-matching for "NEW BFR" or "ADD" button (case-insensitive)
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase();
    if (text === 'new bfr' || text === 'add' || text === 'add new card') {
      return btn;
    }
  }
  return null;
}

function createApxmButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.textContent = 'APXM';
  btn.style.cssText = `
    font-family: "Droid Sans Mono", monospace;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 8px;
    margin-left: 4px;
    background: rgba(30, 30, 40, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    color: #ff8c00;
    cursor: pointer;
    line-height: 1.2;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255, 140, 0, 0.15)';
    btn.style.borderColor = 'rgba(255, 140, 0, 0.4)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(30, 30, 40, 0.9)';
    btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
  });

  btn.addEventListener('click', handleClick);
  return btn;
}

async function handleClick(): Promise<void> {
  // Check if an APXM screen already exists
  const screens = useScreensStore.getState().screens;
  const apxmScreen = screens.find(s => s.name.toLowerCase() === 'apxm');

  if (apxmScreen) {
    // Navigate to existing screen
    location.hash = `#screen=${apxmScreen.id}`;
    return;
  }

  // Open CS buffer to create a new screen
  const opened = await openBuffer('CS');
  if (!opened) {
    console.warn('[APXM] Failed to open CS buffer for screen creation');
    return;
  }

  // Wait for the CS form to appear, then pre-fill fields
  // The CS form renders inputs: Name, Description, CMD
  const formContainer = await waitForElement(() => {
    // Look for an input that appeared after the CS buffer opened
    // CS form has multiple inputs; find the container
    const inputs = document.querySelectorAll<HTMLInputElement>(
      '#container input[type="text"], #container input:not([type])'
    );
    // Need at least 2 visible inputs (Name + CMD) — Description may be textarea
    const visible = Array.from(inputs).filter(i => i.offsetParent !== null);
    if (visible.length >= 2) return visible[0]!;
    return null;
  }, CS_FORM_TIMEOUT_MS);

  if (!formContainer) {
    console.warn('[APXM] CS form inputs did not appear');
    return;
  }

  // Find all visible inputs in the CS form area
  const allInputs = document.querySelectorAll<HTMLInputElement>(
    '#container input[type="text"], #container input:not([type])'
  );
  const visibleInputs = Array.from(allInputs).filter(i => i.offsetParent !== null);

  // First input = Name, third input = CMD (skip Description)
  if (visibleInputs.length >= 1) {
    setInputValue(visibleInputs[0]!, 'APXM');
  }
  if (visibleInputs.length >= 3) {
    setInputValue(visibleInputs[2]!, 'XIT WEB apxm.27bit.dev');
  }

  console.log('[APXM] Pre-filled CS form — user needs to click CREATE');
}

function injectButton(): void {
  // Don't inject if already present
  if (document.getElementById(BUTTON_ID)) return;

  const anchor = findAnchor();
  if (!anchor) return;

  const btn = createApxmButton();
  // Insert adjacent to the anchor
  anchor.parentElement?.insertBefore(btn, anchor.nextSibling);
}

let observer: MutationObserver | null = null;

/** Initialize APXM button injection with MutationObserver for re-injection. */
export function initApxmButton(): void {
  // Initial injection attempt
  injectButton();

  // Watch for DOM changes that may rebuild the APEX toolbar
  observer = new MutationObserver(() => {
    // Re-inject if button was removed (APEX toolbar rebuilds on screen switches)
    if (!document.getElementById(BUTTON_ID)) {
      injectButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
