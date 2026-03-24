/**
 * APXM Button — injects a styled button into APEX's toolbar area.
 *
 * On click: copies the XIT WEB command to clipboard.
 * On hover: shows APXM version.
 */

import { BUILD_VERSION } from './constants';

const BUTTON_ID = 'apxm-apex-button';
const BUFFER_COMMAND = 'XIT WEB https://apxm.27bit.dev';

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
  btn.title = `APXM ${BUILD_VERSION}`;
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

  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(BUFFER_COMMAND).then(() => {
      const original = btn.textContent;
      btn.textContent = 'COPIED';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });

  return btn;
}

function injectButton(): void {
  if (document.getElementById(BUTTON_ID)) return;

  const anchor = findAnchor();
  if (!anchor) return;

  const btn = createApxmButton();
  anchor.parentElement?.insertBefore(btn, anchor.nextSibling);
}

let observer: MutationObserver | null = null;

/** Initialize APXM button injection with MutationObserver for re-injection. */
export function initApxmButton(): void {
  injectButton();

  observer = new MutationObserver(() => {
    if (!document.getElementById(BUTTON_ID)) {
      injectButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
