import { describe, it, expect, beforeEach } from 'vitest';
import { executeBufferRefresh } from '../engine';
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
  useRefreshState.setState({ siteStatus: new Map() });
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

  it('does not open or delete a user card when CREATE adds no row', async () => {
    const { container, list } = buildApexStack({ existingCards: ['BS ZV-307b'] });
    container.addEventListener(
      'click',
      (e) => {
        // APEX rejects the card: CREATE is a no-op.
        if ((e.target as HTMLElement).textContent === 'Create') e.stopImmediatePropagation();
      },
      true
    );
    const ok = await executeBufferRefresh({
      siteId: 'site-1',
      command: 'BS ZV-307b',
      stepTimeoutMs: 100,
    });
    expect(ok).toBe(false);
    expect(list.querySelectorAll('li').length).toBe(1);
    expect(list.querySelector('li')?.classList.contains('user-card')).toBe(true);
  });

  it('restores container styles after the run', async () => {
    const { container } = buildApexStack();
    container.style.position = 'relative';
    await executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 });
    expect(container.style.position).toBe('relative');
    expect(container.style.visibility).toBe('');
  });
});

describe('executeBufferRefresh action lock', () => {
  it('refuses without touching the DOM or the site status while another action holds the lock', async () => {
    const { container } = buildApexStack();
    container.style.position = 'relative';
    const before = container.outerHTML;
    useRefreshState.getState().updateSiteStatus('site-1', 'success');
    acquireActionLock();

    const ok = await executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 });

    expect(ok).toBe(false);
    expect(container.outerHTML).toBe(before);
    // Busy is not a failure — the card keeps whatever it showed before.
    expect(useRefreshState.getState().siteStatus.get('site-1')).toBe('success');
    // The refusal must not free the lock the other action still holds.
    expect(isActionInFlight()).toBe(true);
  });

  it('runs only the first of two concurrent refreshes', async () => {
    const { list } = buildApexStack();
    const cardsCreated: string[] = [];
    new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          cardsCreated.push((node as HTMLElement).querySelector('h4')?.textContent ?? '');
        }
      }
    }).observe(list, { childList: true });

    // The lock is taken before the entry path's first await, so the call
    // made first wins, not whichever happens to reach the DOM first.
    const first = executeBufferRefresh({ siteId: 'site-1', command: 'BS A', stepTimeoutMs: 100 });
    const second = executeBufferRefresh({ siteId: 'site-2', command: 'BS B', stepTimeoutMs: 100 });

    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(cardsCreated).toEqual(['BS A']);
  });

  it('holds the lock while running and releases it afterwards', async () => {
    buildApexStack();
    const run = executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 });
    expect(isActionInFlight()).toBe(true);
    await run;
    expect(isActionInFlight()).toBe(false);
  });

  it('releases the lock when the refresh fails', async () => {
    // No #container at all — the run fails immediately.
    const ok = await executeBufferRefresh({ siteId: 'site-1', command: 'BS X', stepTimeoutMs: 100 });
    expect(ok).toBe(false);
    expect(isActionInFlight()).toBe(false);
  });
});
