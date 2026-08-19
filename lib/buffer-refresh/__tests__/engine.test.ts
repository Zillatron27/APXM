import { describe, it, expect, beforeEach } from 'vitest';
import { executeBufferRefresh } from '../engine';
import { buildApexStack } from '../../../__tests__/fixtures/apex-stack';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('executeBufferRefresh card cleanup (#84)', () => {
  it('deletes the BS card it created after the refresh', async () => {
    const { list } = buildApexStack();
    const ok = await executeBufferRefresh({
      siteId: 'site-1',
      command: 'BS ZV-307b',
      stepTimeoutMs: 100,
    });
    expect(ok).toBe(true);
    expect(list.querySelectorAll('li').length).toBe(0);
  });

  it('leaves a pre-existing user card with the same command untouched', async () => {
    const { list } = buildApexStack({ existingCards: ['BS ZV-307b'] });
    const ok = await executeBufferRefresh({
      siteId: 'site-1',
      command: 'BS ZV-307b',
      stepTimeoutMs: 100,
    });
    expect(ok).toBe(true);
    const remaining = list.querySelectorAll('li');
    expect(remaining.length).toBe(1);
    expect(remaining[0].classList.contains('user-card')).toBe(true);
  });

  it('restores container styles after the run', async () => {
    const { container } = buildApexStack();
    container.style.position = 'relative';
    await executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 });
    expect(container.style.position).toBe('relative');
    expect(container.style.visibility).toBe('');
  });
});
