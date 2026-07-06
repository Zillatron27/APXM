// CX Buy: fillAmount order-book math against the real cxob store shape, and
// generateSteps behaviour (noBuy exclusion, CX-warehouse inventory use,
// partial-fill branches).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../actions/cx-buy/cx-buy'; // side-effect: registers 'CX Buy' + CXPO_BUY step
import { act } from '../act-registry';
import { fillAmount } from '../actions/cx-buy/utils';
import { Logger, type LogTag, type LogContent } from '../runner/logger';
import type { ActionStep, ActionStepGenerateContext } from '../shared-types';
import { useCxobStore } from '../../../stores/cxob';
import { useSettingsStore } from '../../../stores/settings';
import type { PrunApi } from '../../../types/prun-api';

function sells(orders: Array<{ amount: number | null; price: number }>): PrunApi.CXOrderBook {
  return {
    sellingOrders: orders.map((o) => ({ amount: o.amount, limit: { amount: o.price } })),
    buyingOrders: [],
  };
}

beforeEach(() => {
  useCxobStore.getState().clear();
});

afterEach(() => {
  useSettingsStore.getState().setNoBuy([]);
});

describe('fillAmount', () => {
  it('fills cheapest-first across price levels', () => {
    useCxobStore.getState().setOrderBook(
      'RAT.AI1',
      sells([
        { amount: 50, price: 100 },
        { amount: 100, price: 90 },
      ]),
    );
    // 120 wanted: 100 @ 90, then 20 @ 100.
    expect(fillAmount('RAT.AI1', 120, Infinity)).toEqual({
      amount: 120,
      priceLimit: 100,
      cost: 100 * 90 + 20 * 100,
    });
  });

  it('stops at the price limit and reports the partial fill', () => {
    useCxobStore.getState().setOrderBook(
      'RAT.AI1',
      sells([
        { amount: 100, price: 90 },
        { amount: 50, price: 100 },
      ]),
    );
    expect(fillAmount('RAT.AI1', 120, 95)).toEqual({ amount: 100, priceLimit: 90, cost: 9000 });
  });

  it('treats market-maker orders (amount: null) as infinite supply', () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: null, price: 150 }]));
    expect(fillAmount('RAT.AI1', 500, Infinity)).toEqual({
      amount: 500,
      priceLimit: 150,
      cost: 500 * 150,
    });
  });

  it('returns undefined when no order book has been observed', () => {
    expect(fillAmount('DW.NC1', 10, Infinity)).toBeUndefined();
  });
});

describe('CX Buy generateSteps', () => {
  interface RunResult {
    steps: ActionStep[];
    failMessage: string | undefined;
    failed: boolean;
    logs: { tag: LogTag; msg: LogContent }[];
  }

  async function runCxBuy(
    data: Partial<UserData.ActionData>,
    materials: Record<string, number>,
    war: Record<string, Record<string, number>> = {},
  ): Promise<RunResult & { war: Record<string, Record<string, number>> }> {
    const info = act.getActionInfo('CX Buy');
    expect(info).toBeDefined();
    const result: RunResult = { steps: [], failMessage: undefined, failed: false, logs: [] };
    const ctx: ActionStepGenerateContext<unknown> = {
      data: { type: 'CX Buy', name: 'buy', group: 'g', exchange: 'AI1', ...data },
      config: {},
      packageName: 'pkg',
      log: new Logger((tag, msg) => result.logs.push({ tag, msg })),
      fail: (message) => {
        result.failed = true;
        result.failMessage = message;
      },
      assert: (condition, message) => {
        if (!condition) throw new Error(message);
      },
      emitStep: (step) => result.steps.push(step),
      getMaterialGroup: async () => materials,
      getMaterialGroupPrices: () => undefined,
      getMaterialGroupPlanet: () => undefined,
      state: { WAR: war },
    };
    await info!.generateSteps(ctx);
    return { ...result, war };
  }

  it('emits a CXPO_BUY step per billed material', async () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 1000, price: 90 }]));
    const { steps, failed } = await runCxBuy({}, { RAT: 100 });
    expect(failed).toBe(false);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ type: 'CXPO_BUY', ticker: 'RAT', amount: 100, exchange: 'AI1' });
  });

  it('skips tickers on the settings.noBuy list', async () => {
    useSettingsStore.getState().setNoBuy(['RAT']);
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 1000, price: 90 }]));
    useCxobStore.getState().setOrderBook('DW.AI1', sells([{ amount: 1000, price: 50 }]));
    const { steps } = await runCxBuy({}, { RAT: 100, DW: 40 });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ type: 'CXPO_BUY', ticker: 'DW', amount: 40 });
  });

  it('subtracts CX warehouse inventory from the buy (useCXInv default) and mutates WAR', async () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 1000, price: 90 }]));
    const { steps, war } = await runCxBuy({}, { RAT: 100 }, { AI1: { RAT: 30 } });
    expect(steps[0]).toMatchObject({ ticker: 'RAT', amount: 70 });
    // The 30 warehoused units are consumed from the shared WAR state.
    expect(war.AI1.RAT).toBeUndefined();
  });

  it('fails when the book cannot fill and neither buyPartial nor allowUnfilled is set', async () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 40, price: 90 }]));
    const { failed, failMessage, steps } = await runCxBuy({}, { RAT: 100 });
    expect(failed).toBe(true);
    expect(failMessage).toContain('Not enough materials on AI1');
    expect(steps).toHaveLength(0);
  });

  it('buyPartial bids the available amount with a warning', async () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 40, price: 90 }]));
    const { failed, steps, logs } = await runCxBuy({ buyPartial: true }, { RAT: 100 });
    expect(failed).toBe(false);
    expect(steps[0]).toMatchObject({ ticker: 'RAT', amount: 40 });
    expect(logs.some((l) => l.tag === 'WARNING')).toBe(true);
  });

  it('allowUnfilled bids the full amount regardless of book depth', async () => {
    useCxobStore.getState().setOrderBook('RAT.AI1', sells([{ amount: 40, price: 90 }]));
    const { failed, steps } = await runCxBuy({ allowUnfilled: true }, { RAT: 100 });
    expect(failed).toBe(false);
    expect(steps[0]).toMatchObject({ ticker: 'RAT', amount: 100 });
  });
});
