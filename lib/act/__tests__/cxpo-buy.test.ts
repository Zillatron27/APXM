// CXPO_BUY step execution: what the step pre-fills into APEX's order form,
// and when it refuses to. The order book it fills from must be one received
// since the buffer opened — books persist until reconnect, so an older one
// can be hours stale and would pre-fill a wrong price.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../_compat', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../_compat')>()),
  exchangesStore: { getNaturalIdFromCode: () => 'ANT' },
  warehousesStore: { getByEntityNaturalId: () => ({ storeId: 'wh-1' }) },
  storagesStore: {
    getById: () => ({
      weightCapacity: 1e6,
      weightLoad: 0,
      volumeCapacity: 1e6,
      volumeLoad: 0,
      items: [],
    }),
  },
  materialsStore: { getByTicker: () => ({ ticker: 'RAT', weight: 0.21, volume: 0.1 }) },
}));

import '../action-steps/CXPO_BUY'; // side-effect: registers the step
import { act } from '../act-registry';
import { setupActGlobals } from '../globals-setup';
import { C } from '../prun-css';
import { Logger } from '../runner/logger';
import type { ActionStepExecuteContext } from '../shared-types';
import { useCxobStore } from '../../../stores/cxob';
import type { PrunApi } from '../../../types/prun-api';

beforeAll(() => {
  setupActGlobals();
  Object.assign(C, {
    Button: { btn: 'apex-btn', success: 'apex-btn-success' },
    ComExPlaceOrderForm: { form: 'cxpo-form' },
  });
});

function sells(orders: Array<{ amount: number | null; price: number }>): PrunApi.CXOrderBook {
  return {
    sellingOrders: orders.map((o) => ({ amount: o.amount, limit: { amount: o.price } })),
    buyingOrders: [],
  };
}

interface Form {
  anchor: HTMLElement;
  quantity: HTMLInputElement;
  price: HTMLInputElement;
}

function buildCxpoBuffer(): Form {
  const anchor = document.createElement('div');
  const form = document.createElement('div');
  form.className = 'cxpo-form';
  const quantity = document.createElement('input');
  const price = document.createElement('input');
  form.append(quantity, price);
  const buy = document.createElement('button');
  buy.className = 'apex-btn apex-btn-success';
  anchor.append(form, buy);
  document.body.appendChild(anchor);
  return { anchor, quantity, price };
}

interface Run {
  failed: string[];
  skipped: number;
  /** Resolves when the step reaches its ACT gate (the form is pre-filled). */
  reachedAct: Promise<void>;
}

/** Runs the step against the buffer. onOpen fires as requestTile opens it. */
function runStep(form: Form, amount: number, onOpen: () => void = () => {}): Run {
  let markReachedAct!: () => void;
  const run: Run = {
    failed: [],
    skipped: 0,
    reachedAct: new Promise((resolve) => (markReachedAct = resolve)),
  };
  const info = act.getActionStepInfo('CXPO_BUY');
  const ctx: ActionStepExecuteContext<unknown> = {
    data: {
      type: 'CXPO_BUY',
      exchange: 'AI1',
      ticker: 'RAT',
      amount,
      priceLimit: Infinity,
      allowUnfilled: false,
    },
    log: new Logger(() => {}),
    setStatus: () => {},
    // The ACT gate is held shut: these tests are about the pre-fill only.
    waitAct: () => {
      markReachedAct();
      return new Promise(() => {});
    },
    waitActionFeedback: async () => {},
    cacheDescription: () => {},
    complete: () => {},
    skip: () => run.skipped++,
    fail: (message) => run.failed.push(message ?? ''),
    assert: (condition, message) => {
      if (!condition) throw new Error(message);
    },
    requestTile: async () => {
      onOpen();
      return { anchor: form.anchor };
    },
  };
  void info.execute(ctx);
  return run;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  useCxobStore.getState().clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CXPO_BUY order-book freshness', () => {
  it('fills from the book the buffer open delivers', async () => {
    const form = buildCxpoBuffer();
    const run = runStep(form, 100, () =>
      useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 1000, price: 90 }])),
    );
    await vi.advanceTimersByTimeAsync(200);
    await run.reachedAct;

    expect(form.quantity.value).toBe('100');
    expect(form.price.value).toBe('90.00');
    expect(run.failed).toEqual([]);
  });

  it('ignores a book received before the buffer opened and fails instead of filling from it', async () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 1000, price: 90 }]));
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000); // the book is now three hours old
    const form = buildCxpoBuffer();
    const run = runStep(form, 100);

    await vi.advanceTimersByTimeAsync(9000);

    expect(run.failed).toEqual(['Missing RAT.AI1 order book data']);
    expect(form.quantity.value).toBe('');
    expect(form.price.value).toBe('');
  });

  it('a fresh book arriving after a stale one is used', async () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 1000, price: 90 }]));
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000);
    const form = buildCxpoBuffer();
    const run = runStep(form, 100);
    setTimeout(
      () => useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 1000, price: 120 }])),
      500,
    );

    await vi.advanceTimersByTimeAsync(1000);
    await run.reachedAct;

    expect(form.price.value).toBe('120.00');
    expect(run.failed).toEqual([]);
  });
});
