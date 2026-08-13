// The onManualConfirm visibility signal: fired around the manual-confirm
// window (true before the wait, false when it resolves) so the caller can
// make APEX visible for the user's CONFIRM tap — the APXM shadow host is an
// opaque cover, so without this signal the dialog is un-hidden underneath it.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { waitActionFeedback } from '../action-feedback';
import { setupActGlobals } from '../globals-setup';
import { C } from '../prun-css';

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

interface Fixture {
  anchor: HTMLElement;
  overlay: HTMLElement;
  resolveConfirmation: () => void;
}

function buildConfirmationOverlay(): Fixture {
  const anchor = document.createElement('div');
  anchor.style.visibility = 'hidden';
  anchor.style.left = '-9999px';
  document.body.appendChild(anchor);

  const overlay = document.createElement('div');
  overlay.className = 'af-overlay aco-container';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'apex-btn';
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'apex-btn';
  confirmBtn.addEventListener('click', () => {
    overlay.classList.remove('aco-container');
    overlay.classList.add('af-success');
  });
  overlay.append(cancelBtn, confirmBtn);
  anchor.appendChild(overlay);
  return {
    anchor,
    overlay,
    resolveConfirmation: () => {
      overlay.classList.remove('aco-container');
      overlay.classList.add('af-success');
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('waitActionFeedback onManualConfirm signal', () => {
  it('fires true entering the manual window and false after the user resolves it', async () => {
    const fixture = buildConfirmationOverlay();
    const events: boolean[] = [];
    const anchorVisibleAt: string[] = [];
    const onManualConfirm = vi.fn((pending: boolean) => {
      events.push(pending);
      anchorVisibleAt.push(fixture.anchor.style.visibility);
    });
    setTimeout(() => fixture.resolveConfirmation(), 20);

    const error = await waitActionFeedback({ anchor: fixture.anchor }, false, onManualConfirm);

    expect(error).toBeUndefined();
    expect(events).toEqual([true, false]);
    // true arrives AFTER the engine un-hides the buffer, false BEFORE it
    // re-hides — the visible window fully covers the wait.
    expect(anchorVisibleAt).toEqual(['visible', 'visible']);
  });

  it('never fires under autoConfirm (no manual window exists)', async () => {
    const fixture = buildConfirmationOverlay();
    const onManualConfirm = vi.fn();

    const error = await waitActionFeedback({ anchor: fixture.anchor }, true, onManualConfirm);

    expect(error).toBeUndefined();
    expect(onManualConfirm).not.toHaveBeenCalled();
  });

  it('delivers false when the overlay is removed (user cancelled in APEX)', async () => {
    const fixture = buildConfirmationOverlay();
    const events: boolean[] = [];
    setTimeout(() => fixture.overlay.remove(), 20);

    const error = await waitActionFeedback({ anchor: fixture.anchor }, false, (p) =>
      events.push(p)
    );

    // A cancel falls through the success/error checks — the action failed,
    // but the visibility signal must still be balanced.
    expect(error).toBe('Unknown action feedback overlay');
    expect(events).toEqual([true, false]);
  });

  it('skips the signal entirely when no confirmation state occurs', async () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const overlay = document.createElement('div');
    overlay.className = 'af-overlay af-success';
    anchor.appendChild(overlay);
    const onManualConfirm = vi.fn();

    const error = await waitActionFeedback({ anchor }, false, onManualConfirm);

    expect(error).toBeUndefined();
    expect(onManualConfirm).not.toHaveBeenCalled();
  });
});
