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

/**
 * Conditions are only fulfillable once the contract is accepted. CLOSED is the
 * accepted/active status, so the dependency-flag tests build accepted
 * contracts; OPEN (awaiting acceptance) is covered separately below.
 */
function acceptedContract(conditions: PrunApi.ContractCondition[]): PrunApi.Contract {
  return createTestContract({ party: 'PROVIDER', status: 'CLOSED', conditions });
}

describe('buildContractDetail — dependency-aware condition flags', () => {
  it('marks a self PENDING condition with no dependencies as available', () => {
    const contract = acceptedContract([
      selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: [] }),
    ]);

    const [cond] = buildContractDetail(contract).conditions;
    expect(cond.available).toBe(true);
    expect(cond.blocked).toBe(false);
  });

  it('marks a self condition waiting on an unfulfilled dependency as blocked, not available', () => {
    const contract = acceptedContract([
      selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: [] }),
      selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
    ]);

    const c2 = buildContractDetail(contract).conditions.find((c) => c.id === 'c2')!;
    expect(c2.available).toBe(false);
    expect(c2.blocked).toBe(true);
    // Resolves the dep id to its 0-based index for the "waits on #1" hint.
    expect(c2.dependencyIndexes).toEqual([0]);
  });

  it('flips a dependent condition to available once its dependency is fulfilled', () => {
    const contract = acceptedContract([
      selfCondition({ id: 'c1', index: 0, status: 'FULFILLED', dependencies: [] }),
      selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
    ]);

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
      const contract = acceptedContract([
        createContractCondition({ id: 'p1', index: 0, party: 'CUSTOMER', status, dependencies: [] }),
      ]);

      const [cond] = buildContractDetail(contract).conditions;
      expect(cond.party).toBe('partner');
      expect(cond.available).toBe(false);
      expect(cond.blocked).toBe(false);
    }
  });

  it('treats an unresolvable dependency id as not-fulfilled (fail-safe)', () => {
    const contract = acceptedContract([
      selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: ['ghost'] }),
    ]);

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
          // Would be available on an accepted contract (PENDING, no deps)...
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
    const oneAvailable = acceptedContract([
      selfCondition({ id: 'c1', index: 0, status: 'PENDING', dependencies: [] }),
      selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
    ]);
    // c1 available (no deps) → contract is actionable.
    expect(buildContractDetail(oneAvailable).actionable).toBe(true);

    const noneAvailable = acceptedContract([
      selfCondition({ id: 'c1', index: 0, status: 'IN_PROGRESS', dependencies: [] }),
      selfCondition({ id: 'c2', index: 1, status: 'PENDING', dependencies: ['c1'] }),
    ]);
    // c1 is mid-action (not PENDING → not available); c2 blocked on it. None available.
    expect(buildContractDetail(noneAvailable).actionable).toBe(false);
  });

  it('keeps breached as a convenience for the VIOLATED condition status', () => {
    const contract = acceptedContract([
      selfCondition({ id: 'c1', index: 0, status: 'VIOLATED', dependencies: [] }),
    ]);

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

describe('buildContractDetail — acceptance semantics (rPrun parlance)', () => {
  it('an OPEN contract where you are the customer is awaiting YOUR acceptance', () => {
    const contract = createTestContract({
      party: 'CUSTOMER',
      status: 'OPEN',
      conditions: [
        // A self (CUSTOMER) condition that would be available IF accepted.
        createContractCondition({ id: 'c1', index: 0, party: 'CUSTOMER', status: 'PENDING', dependencies: [] }),
      ],
    });

    const detail = buildContractDetail(contract);
    expect(detail.acceptance).toBe('awaiting-mine');
    expect(detail.accepted).toBe(false);
    // You must ACCEPT before you can fulfil — the condition is NOT available yet.
    expect(detail.conditions[0].available).toBe(false);
    expect(detail.actionable).toBe(false);
  });

  it('an OPEN contract where you are the provider is awaiting the PARTNER acceptance', () => {
    const contract = createTestContract({ party: 'PROVIDER', status: 'OPEN' });
    const detail = buildContractDetail(contract);
    expect(detail.acceptance).toBe('awaiting-partner');
    expect(detail.accepted).toBe(false);
  });

  it('an accepted contract (CLOSED / PARTIALLY_FULFILLED) is no longer awaiting acceptance', () => {
    for (const status of ['CLOSED', 'PARTIALLY_FULFILLED'] as PrunApi.ContractStatus[]) {
      const detail = buildContractDetail(createTestContract({ party: 'CUSTOMER', status }));
      expect(detail.acceptance).toBeNull();
      expect(detail.accepted).toBe(true);
    }
  });

  it('a terminal contract is neither awaiting acceptance nor accepted', () => {
    const detail = buildContractDetail(createTestContract({ party: 'CUSTOMER', status: 'FULFILLED' }));
    expect(detail.acceptance).toBeNull();
    expect(detail.accepted).toBe(false);
  });

  it('flags a faction contract by the partner countryCode', () => {
    const faction = createTestContract({
      partner: { id: 'p', name: 'Antares Logistics Officer', code: null, countryCode: 'AI' },
    });
    expect(buildContractDetail(faction).isFaction).toBe(true);

    const commercial = createTestContract({
      partner: { id: 'p', name: 'Trade Partner Corp', code: 'TPC' },
    });
    expect(buildContractDetail(commercial).isFaction).toBe(false);
  });
});
