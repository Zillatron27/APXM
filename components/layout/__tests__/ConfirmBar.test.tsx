import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConfirmBar } from '../ConfirmBar';
import { waitActionFeedback } from '../../../lib/act/action-feedback';
import { setupActGlobals } from '../../../lib/act/globals-setup';
import { C } from '../../../lib/act/prun-css';

// Client-rendered: the test taps a real click handler.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  setupActGlobals();
  Object.assign(C, {
    ActionFeedback: {
      overlay: 'af-overlay',
      progress: 'af-progress',
      success: 'af-success',
      error: 'af-error',
      message: 'af-message',
      dismiss: 'af-dismiss',
    },
    ActionConfirmationOverlay: { container: 'aco-container' },
    Button: { btn: 'apex-btn' },
  });
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ConfirmBar', () => {
  it('has a stop-waiting button that ends a stuck manual-confirm wait', async () => {
    // A confirmation dialog the user can no longer reach in APEX.
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const overlay = document.createElement('div');
    overlay.className = 'af-overlay aco-container';
    anchor.appendChild(overlay);

    const pending = waitActionFeedback({ anchor }, false);
    await new Promise((r) => setTimeout(r, 0));

    act(() => root.render(<ConfirmBar />));
    const button = container.querySelector('button');
    expect(button?.textContent).toMatch(/stop waiting/i);
    act(() => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect(pending).resolves.toBe('Stopped waiting for APEX confirmation');
  });
});
