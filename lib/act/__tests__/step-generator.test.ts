// StepGenerator behaviour: WAR (per-CX warehouse inventory) state built from
// live stores, action-log prefixing, and the no-steps failure path.

import { describe, it, expect, beforeEach } from 'vitest';
import { StepGenerator } from '../runner/step-generator';
import { Logger, type LogTag, type LogContent } from '../runner/logger';
import { act } from '../act-registry';
import type { ActionPackageConfig, ActionStepGenerateContext } from '../shared-types';
import { useStorageStore } from '../../../stores/entities/storage';
import { useWarehouseStore } from '../../../stores/warehouses';
import { useExchangeStore } from '../../../stores/exchanges';
import {
  resetIdCounter,
  createTestStorage,
  createStoreItem,
  createMaterialAmountValue,
  createMaterial,
} from '../../../__tests__/fixtures/factories';

// 'Refuel' is a real UserData.ActionType with no shipped implementation —
// safe to claim as this file's probe registration (vitest isolates the
// registry per test file).
let capturedCtx: ActionStepGenerateContext<unknown> | undefined;
act.addAction({
  type: 'Refuel',
  description: () => 'probe action',
  editComponent: null,
  generateSteps: async (ctx) => {
    capturedCtx = ctx;
    ctx.log.info('hello');
    ctx.emitStep({ type: 'NOOP' });
  },
});

const EMPTY_CONFIG = { materialGroups: {}, actions: {} } as unknown as ActionPackageConfig;

function makeGenerator() {
  const lines: { tag: LogTag; msg: LogContent }[] = [];
  const generator = new StepGenerator({
    log: new Logger((tag, msg) => lines.push({ tag, msg })),
    onStatusChanged: () => {},
  });
  return { generator, lines };
}

beforeEach(() => {
  resetIdCounter();
  capturedCtx = undefined;
  useStorageStore.getState().clear();
  useWarehouseStore.getState().clear();
  useExchangeStore.getState().clear();
});

describe('StepGenerator.generateSteps', () => {
  it('builds WAR state from warehouse + storage stores via the static CX map', async () => {
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'wh-ai', storeId: 'ws-1', systemNaturalId: 'AI', stationNaturalId: 'ANT' },
    ]);
    useStorageStore.getState().setAll([
      createTestStorage({
        id: 'ws-1',
        type: 'WAREHOUSE_STORE',
        addressableId: 'wh-ai',
        items: [
          createStoreItem({
            quantity: createMaterialAmountValue({
              material: createMaterial({ ticker: 'RAT' }),
              amount: 500,
            }),
          }),
        ],
      }),
    ]);

    const { generator } = makeGenerator();
    const result = await generator.generateSteps(
      { global: { name: 'pkg' }, groups: [], actions: [{ type: 'Refuel', name: 'a1' }] },
      EMPTY_CONFIG,
    );

    expect(result.fail).toBe(false);
    expect(result.steps).toEqual([{ type: 'NOOP' }]);
    expect(capturedCtx?.state.WAR['AI1']).toEqual({ RAT: 500 });
    // Exchanges with no warehouse still get an (empty) WAR bucket.
    expect(capturedCtx?.state.WAR['CI1']).toEqual({});
    expect(capturedCtx?.state.WAR['IC1']).toEqual({});
    expect(capturedCtx?.state.WAR['NC1']).toEqual({});
  });

  it('prefixes action log lines with the action name', async () => {
    const { generator, lines } = makeGenerator();
    await generator.generateSteps(
      { global: { name: 'pkg' }, groups: [], actions: [{ type: 'Refuel', name: 'a1' }] },
      EMPTY_CONFIG,
    );
    expect(lines).toContainEqual({ tag: 'INFO', msg: '[a1] hello' });
  });

  it('fails with "No actions were generated" when the package emits no steps', async () => {
    const { generator, lines } = makeGenerator();
    const result = await generator.generateSteps(
      { global: { name: 'pkg' }, groups: [], actions: [] },
      EMPTY_CONFIG,
    );
    expect(result.fail).toBe(true);
    expect(result.steps).toEqual([]);
    expect(lines).toContainEqual({ tag: 'ERROR', msg: 'No actions were generated' });
  });

  it('skips unregistered action types (and then fails on zero steps)', async () => {
    const { generator } = makeGenerator();
    const result = await generator.generateSteps(
      { global: { name: 'pkg' }, groups: [], actions: [{ type: 'CONT Ship', name: 'c1' }] },
      EMPTY_CONFIG,
    );
    expect(result.steps).toEqual([]);
    expect(result.fail).toBe(true);
  });
});
