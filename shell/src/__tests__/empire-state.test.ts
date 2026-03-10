import { describe, it, expect, vi } from 'vitest';
import { createEmpireState } from '../empire-state';
import type { BridgeSnapshot, BridgeUpdate } from '../types/bridge';

function makeSnapshot(overrides?: Partial<BridgeSnapshot>): BridgeSnapshot {
  return {
    sites: [],
    ships: [],
    flights: [],
    storage: [],
    production: [],
    workforce: [],
    contracts: [],
    balances: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('EmpireState', () => {
  describe('applySnapshot', () => {
    it('populates state from snapshot', () => {
      const state = createEmpireState();
      state.applySnapshot(
        makeSnapshot({
          sites: [
            {
              siteId: 's1',
              planetName: 'Montem',
              planetNaturalId: 'UV-351a',
              systemNaturalId: 'UV-351',
              platformCount: 1,
              area: 500,
            },
          ],
        }),
      );
      expect(state.getOwnedSystemNaturalIds()).toEqual(['UV-351']);
    });

    it('replaces previous state entirely', () => {
      const state = createEmpireState();
      state.applySnapshot(
        makeSnapshot({
          sites: [
            {
              siteId: 's1',
              planetName: 'Montem',
              planetNaturalId: 'UV-351a',
              systemNaturalId: 'UV-351',
              platformCount: 1,
              area: 500,
            },
          ],
        }),
      );
      state.applySnapshot(makeSnapshot({ sites: [] }));
      expect(state.getOwnedSystemNaturalIds()).toEqual([]);
    });
  });

  describe('applyUpdate', () => {
    it('replaces a single entity array', () => {
      const state = createEmpireState();
      state.applySnapshot(makeSnapshot());

      const update: BridgeUpdate = {
        entityType: 'sites',
        data: [
          {
            siteId: 's2',
            planetName: 'Promitor',
            planetNaturalId: 'HM-838b',
            systemNaturalId: 'HM-838',
            platformCount: 2,
            area: 750,
          },
        ],
        timestamp: Date.now(),
      };
      state.applyUpdate(update);
      expect(state.getOwnedSystemNaturalIds()).toEqual(['HM-838']);
    });
  });

  describe('getOwnedSystemNaturalIds', () => {
    it('deduplicates systems with multiple sites', () => {
      const state = createEmpireState();
      state.applySnapshot(
        makeSnapshot({
          sites: [
            {
              siteId: 's1',
              planetName: 'Montem',
              planetNaturalId: 'UV-351a',
              systemNaturalId: 'UV-351',
              platformCount: 1,
              area: 500,
            },
            {
              siteId: 's2',
              planetName: 'Vallis',
              planetNaturalId: 'UV-351b',
              systemNaturalId: 'UV-351',
              platformCount: 1,
              area: 500,
            },
          ],
        }),
      );
      expect(state.getOwnedSystemNaturalIds()).toEqual(['UV-351']);
    });

    it('excludes sites with null systemNaturalId', () => {
      const state = createEmpireState();
      state.applySnapshot(
        makeSnapshot({
          sites: [
            {
              siteId: 's1',
              planetName: null,
              planetNaturalId: null,
              systemNaturalId: null,
              platformCount: 0,
              area: 0,
            },
          ],
        }),
      );
      expect(state.getOwnedSystemNaturalIds()).toEqual([]);
    });
  });

  describe('getSystemBurnStatus', () => {
    it('returns worst burn status across workforce entries', () => {
      const state = createEmpireState();
      state.applySnapshot(
        makeSnapshot({
          workforce: [
            {
              siteId: 's1',
              planetNaturalId: 'UV-351a',
              systemNaturalId: 'UV-351',
              overallSatisfaction: 0.9,
              burnStatus: 'ok',
              lowestBurnDays: 30,
            },
            {
              siteId: 's2',
              planetNaturalId: 'UV-351b',
              systemNaturalId: 'UV-351',
              overallSatisfaction: 0.3,
              burnStatus: 'warning',
              lowestBurnDays: 3,
            },
          ],
        }),
      );
      expect(state.getSystemBurnStatus('UV-351')).toBe('warning');
    });

    it('returns critical when any entry is critical', () => {
      const state = createEmpireState();
      state.applySnapshot(
        makeSnapshot({
          workforce: [
            {
              siteId: 's1',
              planetNaturalId: 'UV-351a',
              systemNaturalId: 'UV-351',
              overallSatisfaction: 0.9,
              burnStatus: 'ok',
              lowestBurnDays: 30,
            },
            {
              siteId: 's2',
              planetNaturalId: 'UV-351b',
              systemNaturalId: 'UV-351',
              overallSatisfaction: 0.1,
              burnStatus: 'critical',
              lowestBurnDays: 0,
            },
          ],
        }),
      );
      expect(state.getSystemBurnStatus('UV-351')).toBe('critical');
    });

    it('returns unknown for system with no workforce data', () => {
      const state = createEmpireState();
      state.applySnapshot(makeSnapshot());
      expect(state.getSystemBurnStatus('UV-351')).toBe('unknown');
    });
  });

  describe('onChange', () => {
    it('fires on snapshot', () => {
      const state = createEmpireState();
      const listener = vi.fn();
      state.onChange(listener);
      state.applySnapshot(makeSnapshot());
      expect(listener).toHaveBeenCalledOnce();
    });

    it('fires on update', () => {
      const state = createEmpireState();
      const listener = vi.fn();
      state.onChange(listener);
      state.applyUpdate({ entityType: 'sites', data: [], timestamp: Date.now() });
      expect(listener).toHaveBeenCalledOnce();
    });

    it('returns working unsubscribe function', () => {
      const state = createEmpireState();
      const listener = vi.fn();
      const unsub = state.onChange(listener);
      unsub();
      state.applySnapshot(makeSnapshot());
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
