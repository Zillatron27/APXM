import { describe, it, expect, beforeEach } from 'vitest';
import { openMobileBuffer, closeMobileBuffer } from '../mobile-buffer-navigator';
import { buildApexStack } from '../../__tests__/fixtures/apex-stack';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('openMobileBuffer / closeMobileBuffer card cleanup (#84)', () => {
  it('deletes the card it created on close', async () => {
    const { list } = buildApexStack();
    expect(await openMobileBuffer('FLT')).toBe(true);
    expect(list.querySelectorAll('li').length).toBe(1);
    await closeMobileBuffer();
    expect(list.querySelectorAll('li').length).toBe(0);
  });

  it('leaves a pre-existing user card with the same command untouched', async () => {
    const { list } = buildApexStack({ existingCards: ['FLT'] });
    expect(await openMobileBuffer('FLT')).toBe(true);
    expect(list.querySelectorAll('li').length).toBe(2);
    await closeMobileBuffer();
    const remaining = list.querySelectorAll('li');
    expect(remaining.length).toBe(1);
    // The SURVIVOR must be the user's original card, not the created one.
    expect(remaining[0].classList.contains('user-card')).toBe(true);
  });

  it('sweeps every card of a multi-open action package on the one close', async () => {
    const { list } = buildApexStack();
    expect(await openMobileBuffer('CONT 1')).toBe(true);
    expect(await openMobileBuffer('INV abc')).toBe(true);
    expect(list.querySelectorAll('li').length).toBe(2);
    await closeMobileBuffer();
    expect(list.querySelectorAll('li').length).toBe(0);
  });

  it('restores container styles after close', async () => {
    const { container } = buildApexStack();
    container.style.position = 'relative';
    await openMobileBuffer('FLT');
    await closeMobileBuffer();
    expect(container.style.position).toBe('relative');
    expect(container.style.visibility).toBe('');
  });
});

describe('closeMobileBuffer sweepAppended option', () => {
  /** Simulate a driven click inside the open buffer spawning an untracked
   *  card in the list, the way a NOTS row click does (device 2026-08-27). */
  function appendUntrackedCard(list: HTMLElement) {
    const li = document.createElement('li');
    const remove = document.createElement('button');
    remove.className = 'BtnRemove__btnRemove___abc';
    remove.addEventListener('click', () => li.remove());
    li.appendChild(remove);
    const sub = document.createElement('h4');
    sub.className = 'Stack__commandSubTitle___x';
    sub.textContent = 'SOME_TARGET_BUFFER';
    li.appendChild(sub);
    list.appendChild(li);
  }

  it('default close leaves an appended card untouched (behaviour unchanged)', async () => {
    const { list } = buildApexStack();
    expect(await openMobileBuffer('NOTS')).toBe(true);
    appendUntrackedCard(list);
    expect(list.querySelectorAll('li').length).toBe(2); // NOTS card + appended

    await closeMobileBuffer();

    // Only the tracked NOTS card is swept; the appended one survives.
    expect(list.querySelectorAll('li').length).toBe(1);
  });

  it('sweepAppended: true deletes cards beyond the count recorded at open', async () => {
    const { list } = buildApexStack();
    expect(await openMobileBuffer('NOTS')).toBe(true);
    appendUntrackedCard(list);
    expect(list.querySelectorAll('li').length).toBe(2);

    await closeMobileBuffer({ sweepAppended: true });

    expect(list.querySelectorAll('li').length).toBe(0);
  });

  it('sweepAppended stops after a failed delete rather than looping forever', async () => {
    const { list } = buildApexStack();
    expect(await openMobileBuffer('NOTS')).toBe(true);
    appendUntrackedCard(list);
    // Remove the BtnRemove control so the sweep's delete click can't work,
    // and there's no edit-mode toggle in this fixture to fall back to.
    list.querySelector('[class*="BtnRemove"]')?.remove();

    await expect(closeMobileBuffer({ sweepAppended: true })).resolves.toBeUndefined();
    // Both cards remain: the NOTS card's own BtnRemove is gone too, so even
    // the tracked delete fails — the point of this test is that the sweep
    // doesn't hang or throw, not that cleanup is perfect against a broken DOM.
    expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
  });
});
