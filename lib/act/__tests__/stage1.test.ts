// Stage 1 smoke tests: prove the ported ACT runner foundation imports
// cleanly and the pure (non-DOM, non-Vue) logic behaves. Runtime-dependent
// pieces (step-machine DOM interaction, store-backed bills) are exercised
// only for their input-validation / empty-data paths here; later stages add
// integration coverage once the stores and DOM adapters are wired up.

import { describe, it, expect } from 'vitest';
import { Logger, type LogTag, type LogContent } from '../runner/logger';
import { act } from '../act-registry';
import { configurableValue, groupTargetPrefix } from '../shared-types';
import { fillAmount } from '../actions/cx-buy/utils';
import { computeResupplyBill } from '../material-groups/resupply/bill';

describe('act Stage 1 — Logger', () => {
  it('routes each level to the right tag', () => {
    const calls: { tag: LogTag; msg: LogContent }[] = [];
    const log = new Logger((tag, msg) => calls.push({ tag, msg }));

    log.label('plain');
    log.info('i');
    log.action('a');
    log.success('s');
    log.error('e');
    log.skip('k');
    log.warning('w');
    log.cancel('c');

    expect(calls.map((c) => c.tag)).toEqual([
      null,
      'INFO',
      'ACTION',
      'SUCCESS',
      'ERROR',
      'SKIP',
      'WARNING',
      'CANCEL',
    ]);
  });

  it('runtimeError emits error lines for thrown Errors', () => {
    const tags: LogTag[] = [];
    const log = new Logger((tag) => tags.push(tag));
    log.runtimeError(new Error('boom'));
    expect(tags.every((t) => t === 'ERROR')).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
  });
});

describe('act Stage 1 — registry', () => {
  it('addActionStep returns a factory that stamps the step type', () => {
    const make = act.addActionStep<{ value: number }>({
      type: 'TEST_STEP',
      description: (d) => `value=${d.value}`,
      execute: async () => {},
    });

    const step = make({ value: 42 });
    expect(step.type).toBe('TEST_STEP');
    expect(step.value).toBe(42);

    const info = act.getActionStepInfo('TEST_STEP');
    expect(info.description(step)).toBe('value=42');
  });

  it('addActionStep applies preProcessData before stamping', () => {
    const make = act.addActionStep<{ n: number }>({
      type: 'PRE_STEP',
      preProcessData: (d) => ({ n: d.n * 2 }),
      description: (d) => String(d.n),
      execute: async () => {},
    });
    expect(make({ n: 3 }).n).toBe(6);
  });

  it('material group and action registration round-trips', () => {
    act.addMaterialGroup({
      type: 'Resupply',
      description: () => 'resupply group',
      editComponent: null,
      generateMaterialBill: async () => ({}),
    });
    act.addAction({
      type: 'CX Buy',
      description: () => 'cx buy action',
      editComponent: null,
      generateSteps: async () => {},
    });

    expect(act.getMaterialGroupInfo('Resupply')?.description({ type: 'Resupply' })).toBe(
      'resupply group',
    );
    expect(act.getMaterialGroupTypes()).toContain('Resupply');
    expect(act.getActionInfo('CX Buy')?.type).toBe('CX Buy');
    expect(act.getActionTypes()).toContain('CX Buy');
  });
});

describe('act Stage 1 — shared constants', () => {
  it('exports the rprun sentinel strings verbatim', () => {
    expect(configurableValue).toBe('Configure on Execution');
    expect(groupTargetPrefix).toBe('group:');
  });
});

describe('act Stage 1 — cx-buy fillAmount', () => {
  it('returns undefined when no order book is available (Stage 1 stub store)', () => {
    expect(fillAmount('RAT.CI1', 100, 50)).toBeUndefined();
  });
});

describe('act Stage 1 — resupply bill', () => {
  const group: UserData.MaterialGroupData = { type: 'Resupply' };

  it('returns undefined when planet is missing', () => {
    expect(computeResupplyBill(group, undefined, 10)).toBeUndefined();
  });

  it('returns undefined when days is missing or NaN', () => {
    expect(computeResupplyBill(group, 'OT-580b', undefined)).toBeUndefined();
    expect(computeResupplyBill(group, 'OT-580b', NaN)).toBeUndefined();
  });

  it('returns undefined when the site is not loaded', () => {
    expect(computeResupplyBill(group, 'OT-580b', 10)).toBeUndefined();
  });
});
