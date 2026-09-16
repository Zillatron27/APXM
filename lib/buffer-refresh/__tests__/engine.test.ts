import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeBufferRefresh } from '../engine';
import { executeBatchRefresh } from '../batch';
import { buildApexStack } from '../../../__tests__/fixtures/apex-stack';
import { acquireActionLock, releaseActionLock, isActionInFlight } from '../../act/action-lock';
import { useRefreshState } from '../../../stores/refreshState';
import * as domHelpers from '../dom-helpers';

// Only getContainer is stubbed per-test (to force a throw for the
// mid-run-exception case); every other helper keeps its real jsdom behaviour.
vi.mock('../dom-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dom-helpers')>();
  return { ...actual, getContainer: vi.fn(actual.getContainer) };
});

beforeEach(() => {
  document.body.innerHTML = '';
  releaseActionLock();
  vi.mocked(domHelpers.getContainer).mockImplementation(() => document.getElementById('container'));
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

describe('executeBufferRefresh shared action lock (#95)', () => {
  it('refuses while the lock is held, touching no DOM and reporting the shared error', async () => {
    const { container, list } = buildApexStack();
    acquireActionLock();
    try {
      const ok = await executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 });
      expect(ok).toBe(false);
      // No card was created and #container was never touched.
      expect(list.querySelectorAll('li').length).toBe(0);
      expect(container.style.visibility).toBe('');
      expect(useRefreshState.getState().siteStatus.get('site-1')).toBe('error');
    } finally {
      releaseActionLock();
    }
  });

  it('releases the lock after a successful refresh', async () => {
    buildApexStack();
    const ok = await executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 });
    expect(ok).toBe(true);
    expect(isActionInFlight()).toBe(false);
  });

  it('releases the lock even when the engine throws mid-run', async () => {
    buildApexStack();
    vi.mocked(domHelpers.getContainer).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(
      executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 })
    ).rejects.toThrow('boom');
    expect(isActionInFlight()).toBe(false);
  });
});

describe('executeBatchRefresh continues past a refused site (#95)', () => {
  it('reports a lock-refused site as failed and still processes the rest of the batch', async () => {
    buildApexStack();
    acquireActionLock();

    const results = await executeBatchRefresh({
      siteIds: ['site-1', 'site-2'],
      delayBetweenMs: 0,
      stepTimeoutMs: 100,
      // Release right after site-1's refused result is recorded, before the
      // batch moves on — deterministic, unlike a timer race.
      onProgress: (_completed, _total, siteId) => {
        if (siteId === 'site-1') releaseActionLock();
      },
    });

    expect(results.get('site-1')).toBe(false);
    expect(results.get('site-2')).toBe(true);
  });
});
