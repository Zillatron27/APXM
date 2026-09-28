// The onManualConfirm visibility signal: fired around the manual-confirm
// window (true before the wait, false when it resolves) so the caller can
// make APEX visible for the user's CONFIRM tap — the APXM shadow host is an
// opaque cover, so without this signal the dialog is un-hidden underneath it.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { waitActionFeedback, abandonManualConfirmWait } from '../action-feedback';
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
  cancelClicks: () => number;
}

function buildConfirmationOverlay(): Fixture {
  const anchor = document.createElement('div');
  anchor.style.visibility = 'hidden';
  anchor.style.left = '-9999px';
  document.body.appendChild(anchor);

  const overlay = document.createElement('div');
  overlay.className = 'af-overlay aco-container';
  // Lowercase, as in APEX's DOM (CSS uppercases the visible label).
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'apex-btn';
  cancelBtn.textContent = 'cancel';
  let cancelClicks = 0;
  cancelBtn.addEventListener('click', () => {
    cancelClicks++;
    overlay.remove();
  });
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'apex-btn';
  confirmBtn.textContent = 'confirm';
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
    cancelClicks: () => cancelClicks,
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

describe('waitActionFeedback progress wait (#5)', () => {
  function buildProgressOverlay(): { anchor: HTMLElement; overlay: HTMLElement } {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const overlay = document.createElement('div');
    overlay.className = 'af-overlay af-progress';
    anchor.appendChild(overlay);
    return { anchor, overlay };
  }

  it('returns an error instead of hanging when the overlay is detached mid-progress', async () => {
    const { anchor, overlay } = buildProgressOverlay();
    const result = waitActionFeedback({ anchor }, false);
    setTimeout(() => overlay.remove(), 10);
    await expect(result).resolves.toBe('Action feedback lost — check APEX');
  });

  it('returns an error when the overlay stays in progress past the timeout', async () => {
    vi.useFakeTimers();
    try {
      const { anchor } = buildProgressOverlay();
      const result = waitActionFeedback({ anchor }, false);
      await vi.advanceTimersByTimeAsync(60_000);
      await expect(result).resolves.toBe('Action feedback lost — check APEX');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still reports success when progress clears normally, leaving no timer behind', async () => {
    vi.useFakeTimers();
    try {
      const { anchor, overlay } = buildProgressOverlay();
      const result = waitActionFeedback({ anchor }, false);
      await vi.advanceTimersByTimeAsync(0);
      overlay.classList.remove('af-progress');
      overlay.classList.add('af-success');
      await expect(result).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('overlay removal at any ancestor level', () => {
  it('manual confirm: resolves when an ancestor of the overlay is removed', async () => {
    const fixture = buildConfirmationOverlay();
    const events: boolean[] = [];
    // The overlay's own parent leaves the document — the overlay itself is
    // never the removed node, so a parent-scoped observer never fires.
    setTimeout(() => fixture.anchor.remove(), 20);

    const error = await waitActionFeedback({ anchor: fixture.anchor }, false, (p) =>
      events.push(p)
    );

    expect(error).toBe('Unknown action feedback overlay');
    expect(events).toEqual([true, false]);
  });

  it('progress: returns the feedback-lost error well before the timeout when an ancestor is removed', async () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    const anchor = document.createElement('div');
    wrapper.appendChild(anchor);
    const overlay = document.createElement('div');
    overlay.className = 'af-overlay af-progress';
    anchor.appendChild(overlay);

    const started = Date.now();
    setTimeout(() => wrapper.remove(), 20);
    const error = await waitActionFeedback({ anchor }, false);

    expect(error).toBe('Action feedback lost — check APEX');
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('abandonManualConfirmWait (APXM-side escape)', () => {
  it('ends a pending manual-confirm wait with an error and restores the buffer styles', async () => {
    const fixture = buildConfirmationOverlay();
    const events: boolean[] = [];
    setTimeout(() => abandonManualConfirmWait(), 20);

    const error = await waitActionFeedback({ anchor: fixture.anchor }, false, (p) =>
      events.push(p)
    );

    expect(error).toBe('Stopped waiting for APEX confirmation');
    expect(events).toEqual([true, false]);
    expect(fixture.anchor.style.visibility).toBe('hidden');
    expect(fixture.anchor.style.left).toBe('-9999px');
  });

  it('is a no-op when no manual-confirm wait is pending', async () => {
    abandonManualConfirmWait();
    // A later wait is unaffected by the earlier call.
    const fixture = buildConfirmationOverlay();
    setTimeout(() => fixture.resolveConfirmation(), 20);
    const error = await waitActionFeedback({ anchor: fixture.anchor }, false);
    expect(error).toBeUndefined();
  });
});

describe('abandonManualConfirmWait and APEX cancel', () => {
  it("clicks APEX's cancel (matched by text) while the dialog is still confirming", async () => {
    const fixture = buildConfirmationOverlay();
    // Put the cancel button second so an index-based pick would miss it.
    fixture.overlay.appendChild(fixture.overlay.querySelector('button')!);
    setTimeout(() => abandonManualConfirmWait(), 20);

    const error = await waitActionFeedback({ anchor: fixture.anchor }, false);

    expect(fixture.cancelClicks()).toBe(1);
    expect(error).toBe('Stopped waiting for APEX confirmation');
  });

  it('clicks nothing, and follows the real outcome, when the dialog already moved to progress', async () => {
    const fixture = buildConfirmationOverlay();
    setTimeout(() => {
      // The user's CONFIRM landed; STOP WAITING arrives in the same tick,
      // before the class observer has run.
      fixture.overlay.classList.remove('aco-container');
      fixture.overlay.classList.add('af-progress');
      abandonManualConfirmWait();
      setTimeout(() => {
        fixture.overlay.classList.remove('af-progress');
        fixture.overlay.classList.add('af-success');
      }, 10);
    }, 20);

    const error = await waitActionFeedback({ anchor: fixture.anchor }, false);

    expect(fixture.cancelClicks()).toBe(0);
    expect(error).toBeUndefined();
  });

  it('clicks nothing when the dialog already reached success', async () => {
    const fixture = buildConfirmationOverlay();
    setTimeout(() => {
      fixture.resolveConfirmation();
      abandonManualConfirmWait();
    }, 20);

    const error = await waitActionFeedback({ anchor: fixture.anchor }, false);

    expect(fixture.cancelClicks()).toBe(0);
    expect(error).toBeUndefined();
  });
});
