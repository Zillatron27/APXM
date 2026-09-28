import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeBatchRefresh, startAutoRefresh } from '../batch';
import { buildApexStack } from '../../../__tests__/fixtures/apex-stack';
import {
  acquireActionLock,
  releaseActionLock,
  isActionInFlight,
} from '../../act/action-lock';
import { useRefreshState } from '../../../stores/refreshState';

beforeEach(() => {
  document.body.innerHTML = '';
  releaseActionLock();
  useRefreshState.setState({ isRefreshing: false, siteStatus: new Map() });
});

describe('executeBatchRefresh action lock', () => {
  it('returns early without starting a refresh while another action holds the lock', async () => {
    const { container } = buildApexStack();
    const before = container.outerHTML;
    acquireActionLock();

    const results = await executeBatchRefresh({ siteIds: ['a', 'b'], stepTimeoutMs: 100 });

    expect(results.size).toBe(0);
    expect(useRefreshState.getState().isRefreshing).toBe(false);
    expect(useRefreshState.getState().siteStatus.size).toBe(0);
    expect(container.outerHTML).toBe(before);
    expect(isActionInFlight()).toBe(true);
  });

  it('holds the lock across every site, including the gaps between them', async () => {
    buildApexStack();
    const lockHeldAfterEachSite: boolean[] = [];

    const results = await executeBatchRefresh({
      siteIds: ['a', 'b', 'c'],
      stepTimeoutMs: 100,
      delayBetweenMs: 10,
      onProgress: () => lockHeldAfterEachSite.push(isActionInFlight()),
    });

    expect([...results.values()]).toEqual([true, true, true]);
    expect(lockHeldAfterEachSite).toEqual([true, true, true]);
    expect(isActionInFlight()).toBe(false);
  });

  it('releases the lock when the batch throws', async () => {
    buildApexStack();
    await expect(
      executeBatchRefresh({
        siteIds: ['a'],
        stepTimeoutMs: 100,
        onProgress: () => {
          throw new Error('boom');
        },
      })
    ).rejects.toThrow('boom');
    expect(isActionInFlight()).toBe(false);
  });
});

describe('startAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const started = () => useRefreshState.getState().siteStatus.has('a');

  it('starts the batch immediately when the lock is free', async () => {
    startAutoRefresh(() => ['a']);
    await vi.advanceTimersByTimeAsync(0);
    expect(started()).toBe(true);
  });

  it('retries after a delay when the lock is busy, instead of skipping', async () => {
    acquireActionLock();
    startAutoRefresh(() => ['a'], { retryDelayMs: 3000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(started()).toBe(false);

    releaseActionLock();
    await vi.advanceTimersByTimeAsync(3000);
    expect(started()).toBe(true);
  });

  it('gives up after maxAttempts while the lock stays busy', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    acquireActionLock();
    startAutoRefresh(() => ['a'], { maxAttempts: 3, retryDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(started()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('auto-refresh skipped'));
    warn.mockRestore();
  });
});
