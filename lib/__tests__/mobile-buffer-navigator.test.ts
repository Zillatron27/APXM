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
