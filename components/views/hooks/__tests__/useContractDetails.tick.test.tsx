import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useContractDetail, useContractDetails } from '../useContractDetails';
import { useContractsStore } from '../../../../stores/entities/contracts';
import {
  createTestContract,
  createContractCondition,
  createDateTime,
} from '../../../../__tests__/fixtures/factories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOUR_MS = 3_600_000;
const ALL = new Set(['all'] as const);

let container: HTMLDivElement;
let root: Root;

function DetailProbe() {
  return <span>{useContractDetail('c1')?.conditions[0].deadline}</span>;
}

function ListProbe() {
  return <span>{useContractDetails(ALL).contracts[0]?.conditions[0].deadline}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
  useContractsStore.getState().clear();
  // Condition deadline is 5h30m away: reads "5h", then "4h" after an hour passes.
  useContractsStore.getState().setAll([
    createTestContract({
      id: 'c1',
      conditions: [createContractCondition({ deadline: createDateTime(Date.now() + 5.5 * HOUR_MS) })],
    }),
  ]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('contract deadlines', () => {
  it.each([
    ['detail sheet', DetailProbe],
    ['contract list', ListProbe],
  ])('%s counts down as time passes without a store update', async (_name, Probe) => {
    await act(async () => {
      root.render(<Probe />);
    });
    expect(container.textContent).toBe('5h');

    await act(async () => {
      vi.advanceTimersByTime(HOUR_MS);
    });
    expect(container.textContent).toBe('4h');
  });
});
