import { describe, it, expect } from 'vitest';
import { classifyProdStatus, classifyProdUrgency, prodStatusLabel } from '../prod';
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
