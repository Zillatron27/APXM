import { describe, it, expect } from 'vitest';
import { buildContractDetail } from '../useContractDetails';
import { createTestContract, createContractCondition } from '../../../../__tests__/fixtures/factories';
import type { PrunApi } from '../../../../types/prun-api';

/**
 * The contract here is the PROVIDER (party === 'PROVIDER'), so PROVIDER
 * conditions are "self" and CUSTOMER conditions are "partner". The dependency
 * chain mirrors live contract OKOGOMI: #1 has no deps (actionable immediately),
 * #2 depends on #1, #4 depends on #2.
 */
function selfCondition(overrides: Partial<PrunApi.ContractCondition>): PrunApi.ContractCondition {
  return createContractCondition({ party: 'PROVIDER', ...overrides });
}

describe('buildContractDetail — dependency-aware condition flags', () => {
  it('marks a self PENDING condition with no dependencies as available', () => {
    const contract = createTestContract({
      party: 'PROVIDER',
      conditions: [selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: [] })],
    });

    const [cond] = buildContractDetail(contract).conditions;
    expect(cond.available).toBe(true);
    expect(cond.blocked).toBe(false);
  });

  it('marks a self condition waiting on an unfulfilled dependency as blocked, not available', () => {
    const contract = createTestContract({
      party: 'PROVIDER',
      conditions: [
        selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: [] }),
        selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
      ],
    });

    const c2 = buildContractDetail(contract).conditions.find((c) => c.id === 'c2')!;
    expect(c2.available).toBe(false);
    expect(c2.blocked).toBe(true);
    // Resolves the dep id to its 0-based index for the "waits on #1" hint.
    expect(c2.dependencyIndexes).toEqual([0]);
  });

  it('flips a dependent condition to available once its dependency is fulfilled', () => {
    const contract = createTestContract({
      party: 'PROVIDER',
      conditions: [
        selfCondition({ id: 'c1', index: 0, status: 'FULFILLED', dependencies: [] }),
        selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
      ],
    });

    const c2 = buildContractDetail(contract).conditions.find((c) => c.id === 'c2')!;
    expect(c2.available).toBe(true);
    expect(c2.blocked).toBe(false);
  });

  it('never marks a partner condition available or blocked, whatever its status', () => {
    const statuses: PrunApi.ContractConditionStatus[] = [
      'PENDING',
      'IN_PROGRESS',
      'FULFILLED',
      'PARTLY_FULFILLED',
      'FULFILLMENT_ATTEMPTED',
      'VIOLATED',
    ];

    for (const status of statuses) {
      const contract = createTestContract({
        party: 'PROVIDER',
        conditions: [createContractCondition({ id: 'p1', index: 0, party: 'CUSTOMER', status, dependencies: [] })],
      });

      const [cond] = buildContractDetail(contract).conditions;
      expect(cond.party).toBe('partner');
      expect(cond.available).toBe(false);
      expect(cond.blocked).toBe(false);
    }
  });

  it('treats an unresolvable dependency id as not-fulfilled (fail-safe)', () => {
    const contract = createTestContract({
      party: 'PROVIDER',
      conditions: [
        selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: ['ghost'] }),
      ],
    });

    const [cond] = buildContractDetail(contract).conditions;
    // Never available off a dependency we can't see; and a missing dep blocks.
    expect(cond.available).toBe(false);
    expect(cond.blocked).toBe(true);
    // The ghost id resolves to no index, so the hint list is empty.
    expect(cond.dependencyIndexes).toEqual([]);
  });

  it('marks no condition available or blocked once the contract is no longer valid', () => {
    const terminalStatuses: PrunApi.ContractStatus[] = [
      'REJECTED',
      'CANCELLED',
      'TERMINATED',
      'BREACHED',
      'DEADLINE_EXCEEDED',
    ];

    for (const status of terminalStatuses) {
      const contract = createTestContract({
        party: 'PROVIDER',
        status,
        conditions: [
          // Would be available on an active contract (PENDING, no deps)...
          selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: [] }),
          // ...and this would be blocked, waiting on c1.
          selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
        ],
      });

      const detail = buildContractDetail(contract);
      expect(detail.actionable).toBe(false);
      for (const cond of detail.conditions) {
        expect(cond.available).toBe(false);
        expect(cond.blocked).toBe(false);
      }
    }
  });

  it('sets contract.actionable true iff at least one condition is available', () => {
    const noneAvailable = createTestContract({
      party: 'PROVIDER',
      conditions: [
        selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: [] }),
        selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
      ],
    });
    // c1 available (no deps) → contract is actionable.
    expect(buildContractDetail(noneAvailable).actionable).toBe(true);

    const blockedOnly = createTestContract({
      party: 'PROVIDER',
      conditions: [
        selfCondition({ id: 'c1', index: 0, status: 'IN_PROGRESS', dependencies: [] }),
        selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
      ],
    });
    // c1 is mid-action (not PENDING → not available); c2 blocked on it. None available.
    expect(buildContractDetail(blockedOnly).actionable).toBe(false);
  });

  it('keeps breached as a convenience for the VIOLATED condition status', () => {
    const contract = createTestContract({
      party: 'PROVIDER',
      conditions: [selfCondition({ id: 'c1', index: 0, status: 'VIOLATED', dependencies: [] })],
    });

    const [cond] = buildContractDetail(contract).conditions;
    expect(cond.status).toBe('VIOLATED');
    expect(cond.breached).toBe(true);
    expect(cond.fulfilled).toBe(false);
    // A violated condition with no outstanding deps is a terminal state —
    // neither available (status !== PENDING) nor blocked (no unfulfilled dep).
    expect(cond.available).toBe(false);
    expect(cond.blocked).toBe(false);
  });
});
