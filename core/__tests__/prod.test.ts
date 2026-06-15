import { describe, it, expect } from 'vitest';
import {
  classifyProdStatus,
  classifyProdUrgency,
  prodStatusLabel,
  classifyOrderState,
  orderProgressPct,
  sortOrders,
} from '../prod';
import {
  createTestProductionLine,
  createProductionOrder,
} from '../../__tests__/fixtures/factories';
import type { PrunApi } from '../../types/prun-api';

function runningOrder(): PrunApi.ProductionOrder {
  return createProductionOrder({ started: { timestamp: 1000 } });
}

function queuedOrder(): PrunApi.ProductionOrder {
  return createProductionOrder({ started: null });
}

function haltedOrder(): PrunApi.ProductionOrder {
  return createProductionOrder({ started: { timestamp: 1000 }, halted: true });
}

describe('classifyProdStatus', () => {
  it('is full when every building has a running order', () => {
    const line = createTestProductionLine({
      capacity: 3,
      orders: [runningOrder(), runningOrder(), runningOrder()],
    });
    expect(classifyProdStatus([line])).toEqual({ tier: 'full', active: 3, capacity: 3 });
  });

  it('is partial when any building is idle — even a single one', () => {
    const line = createTestProductionLine({
      capacity: 24,
      orders: Array.from({ length: 23 }, runningOrder),
    });
    expect(classifyProdStatus([line])).toEqual({ tier: 'partial', active: 23, capacity: 24 });
  });

  it('is stopped when no orders are running', () => {
    const line = createTestProductionLine({ capacity: 2, orders: [queuedOrder()] });
    expect(classifyProdStatus([line])).toEqual({ tier: 'stopped', active: 0, capacity: 2 });
  });

  it('is stopped for a site with no production lines', () => {
    expect(classifyProdStatus([])).toEqual({ tier: 'stopped', active: 0, capacity: 0 });
  });

  it('does not count queued (unstarted) orders as active', () => {
    const line = createTestProductionLine({
      capacity: 2,
      orders: [runningOrder(), queuedOrder(), queuedOrder()],
    });
    expect(classifyProdStatus([line])).toEqual({ tier: 'partial', active: 1, capacity: 2 });
  });

  it('does not count halted orders as active', () => {
    const line = createTestProductionLine({
      capacity: 2,
      orders: [runningOrder(), haltedOrder()],
    });
    expect(classifyProdStatus([line])).toEqual({ tier: 'partial', active: 1, capacity: 2 });
  });

  it('caps active at capacity per line, so utilisation never reads above 100%', () => {
    const line = createTestProductionLine({
      capacity: 2,
      orders: [runningOrder(), runningOrder(), runningOrder()],
    });
    expect(classifyProdStatus([line])).toEqual({ tier: 'full', active: 2, capacity: 2 });
  });

  it('aggregates across lines: one full line plus one stopped line is partial', () => {
    const farm = createTestProductionLine({ capacity: 2, orders: [runningOrder(), runningOrder()] });
    const plant = createTestProductionLine({ capacity: 3, orders: [] });
    expect(classifyProdStatus([farm, plant])).toEqual({ tier: 'partial', active: 2, capacity: 5 });
  });
});

describe('classifyProdUrgency', () => {
  it('maps tiers onto the shared urgency scale', () => {
    expect(classifyProdUrgency('full')).toBe('ok');
    expect(classifyProdUrgency('partial')).toBe('warning');
    expect(classifyProdUrgency('stopped')).toBe('critical');
  });
});

describe('prodStatusLabel', () => {
  it('uses a distinct glyph per state so colour is never the only signal', () => {
    expect(prodStatusLabel(null)).toBe('?');
    expect(prodStatusLabel({ tier: 'full', active: 24, capacity: 24 })).toBe('✓');
    expect(prodStatusLabel({ tier: 'partial', active: 21, capacity: 24 })).toBe('21/24');
    expect(prodStatusLabel({ tier: 'stopped', active: 0, capacity: 24 })).toBe('∅');
  });
});

describe('classifyOrderState', () => {
  it('is running when started and not halted', () => {
    expect(classifyOrderState(createProductionOrder({ started: { timestamp: 1000 } }))).toBe('running');
  });

  it('is queued when never started', () => {
    expect(classifyOrderState(createProductionOrder({ started: null }))).toBe('queued');
  });

  it('is halted even when a stale started timestamp remains', () => {
    // A paused order can keep the started timestamp from before it was halted;
    // halted must win so it is never counted or shown as producing.
    expect(
      classifyOrderState(createProductionOrder({ started: { timestamp: 1000 }, halted: true }))
    ).toBe('halted');
  });
});

describe('orderProgressPct', () => {
  it('is elapsed wall-clock against duration, not units completed', () => {
    // 30 min into a 60 min order = 50%, regardless of the `completed` field.
    const order = createProductionOrder({
      started: { timestamp: 0 },
      duration: { millis: 3_600_000 },
      completed: 0,
    });
    expect(orderProgressPct(order, 1_800_000)).toBe(50);
  });

  it('is null for a queued order — nothing has started to measure', () => {
    expect(orderProgressPct(createProductionOrder({ started: null }), 1000)).toBeNull();
  });

  it('clamps to 0–100 across clock skew and overrun', () => {
    const order = createProductionOrder({ started: { timestamp: 0 }, duration: { millis: 1000 } });
    expect(orderProgressPct(order, -500)).toBe(0); // skew below start
    expect(orderProgressPct(order, 5000)).toBe(100); // finished but not cleared
  });
});

describe('sortOrders', () => {
  it('puts running first (soonest ETA), then queue order, then halted', () => {
    const queuedFirst = createProductionOrder({ started: null });
    const queuedSecond = createProductionOrder({ started: null });
    const runningSoon = createProductionOrder({
      started: { timestamp: 0 },
      completion: { timestamp: 100 },
    });
    const runningLater = createProductionOrder({
      started: { timestamp: 0 },
      completion: { timestamp: 900 },
    });
    const halted = createProductionOrder({ started: { timestamp: 0 }, halted: true });

    const sorted = sortOrders([queuedFirst, halted, runningLater, queuedSecond, runningSoon]);

    expect(sorted).toEqual([runningSoon, runningLater, queuedFirst, queuedSecond, halted]);
  });

  it('does not mutate the input array', () => {
    const orders = [
      createProductionOrder({ started: null }),
      createProductionOrder({ started: { timestamp: 0 }, completion: { timestamp: 100 } }),
    ];
    const snapshot = [...orders];
    sortOrders(orders);
    expect(orders).toEqual(snapshot);
  });
});
