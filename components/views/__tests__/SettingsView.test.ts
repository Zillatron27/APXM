import { describe, it, expect, beforeEach } from 'vitest';
import { validateThresholds, validateRepairThresholds, groupCards } from '../SettingsView';
import {
  useSettingsStore,
  DEFAULT_THRESHOLDS,
  DEFAULT_REPAIR_THRESHOLDS,
} from '../../../stores/settings';

describe('SettingsView repair threshold validation', () => {
  describe('validateRepairThresholds', () => {
    it('returns null for valid values', () => {
      expect(validateRepairThresholds(60, 10)).toBeNull();
    });

    it('rejects offset >= threshold', () => {
      expect(validateRepairThresholds(60, 60)).toBe('Offset must be less than the threshold');
      expect(validateRepairThresholds(60, 70)).toBe('Offset must be less than the threshold');
    });

    it('rejects zero and negative values', () => {
      expect(validateRepairThresholds(0, 10)).toBe('All values must be greater than 0');
      expect(validateRepairThresholds(60, 0)).toBe('All values must be greater than 0');
      expect(validateRepairThresholds(-60, -10)).toBe('All values must be greater than 0');
    });
  });

  describe('store integration', () => {
    beforeEach(() => {
      useSettingsStore.getState().reset();
    });

    it('defaults are 60/10 (rPrun-XIT-REP values proven on jackinabox86 fork)', () => {
      // Assert the literals, not just equality with the constant — the store
      // initializes FROM that constant, so toEqual alone is circular.
      const { repairThresholds } = useSettingsStore.getState();
      expect(repairThresholds.threshold).toBe(60);
      expect(repairThresholds.offset).toBe(10);
      expect(repairThresholds).toEqual(DEFAULT_REPAIR_THRESHOLDS);
    });

    it('setRepairThresholds persists partial updates', () => {
      useSettingsStore.getState().setRepairThresholds({ offset: 14 });
      const { repairThresholds } = useSettingsStore.getState();
      expect(repairThresholds.offset).toBe(14);
      expect(repairThresholds.threshold).toBe(60);
    });
  });
});

describe('preferred currency setting (#63)', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  it('defaults to null (faction-derived headline currency)', () => {
    expect(useSettingsStore.getState().preferredCurrency).toBeNull();
  });

  it('setPreferredCurrency round-trips a code and back to Auto', () => {
    useSettingsStore.getState().setPreferredCurrency('NCC');
    expect(useSettingsStore.getState().preferredCurrency).toBe('NCC');
    useSettingsStore.getState().setPreferredCurrency(null);
    expect(useSettingsStore.getState().preferredCurrency).toBeNull();
  });
});

describe('SettingsView burn threshold validation', () => {
  describe('validateThresholds', () => {
    it('returns null for valid thresholds', () => {
      expect(validateThresholds(3, 5, 30)).toBeNull();
    });

    it('rejects critical >= warning', () => {
      expect(validateThresholds(5, 5, 30)).toBe('Critical must be less than warning');
      expect(validateThresholds(6, 5, 30)).toBe('Critical must be less than warning');
    });

    it('rejects resupply < warning', () => {
      expect(validateThresholds(3, 5, 4)).toBe('Resupply target must be at least the warning threshold');
    });

    it('rejects zero values', () => {
      expect(validateThresholds(0, 5, 30)).toBe('All values must be greater than 0');
      expect(validateThresholds(3, 0, 30)).toBe('All values must be greater than 0');
      expect(validateThresholds(3, 5, 0)).toBe('All values must be greater than 0');
    });

    it('rejects negative values', () => {
      expect(validateThresholds(-1, 5, 30)).toBe('All values must be greater than 0');
    });

    it('accepts fractional values (e.g. 0.5 days)', () => {
      expect(validateThresholds(0.5, 1, 30)).toBeNull();
    });

    it('accepts resupply equal to warning', () => {
      expect(validateThresholds(3, 5, 5)).toBeNull();
    });
  });

  describe('store integration', () => {
    beforeEach(() => {
      useSettingsStore.getState().reset();
    });

    it('defaults match DEFAULT_THRESHOLDS', () => {
      const { burnThresholds } = useSettingsStore.getState();
      expect(burnThresholds).toEqual(DEFAULT_THRESHOLDS);
      expect(burnThresholds.critical).toBe(3);
      expect(burnThresholds.warning).toBe(5);
      expect(burnThresholds.resupply).toBe(30);
    });

    it('setBurnThresholds persists partial updates', () => {
      useSettingsStore.getState().setBurnThresholds({ resupply: 14 });
      const { burnThresholds } = useSettingsStore.getState();
      expect(burnThresholds.resupply).toBe(14);
      expect(burnThresholds.critical).toBe(3);
      expect(burnThresholds.warning).toBe(5);
    });

    it('reset restores defaults', () => {
      useSettingsStore.getState().setBurnThresholds({ critical: 1, warning: 2, resupply: 7 });
      useSettingsStore.getState().reset();
      expect(useSettingsStore.getState().burnThresholds).toEqual(DEFAULT_THRESHOLDS);
    });
  });
});

describe('groupCards', () => {
  it('groups by command prefix, largest first, ties alphabetical', () => {
    expect(
      groupCards([
        { command: 'CONT 1', title: '' },
        { command: 'cont 2', title: '' },
        { command: 'INV a', title: '' },
        { command: 'FLT', title: '' },
        { command: '', title: '' },
      ])
    ).toEqual([
      { prefix: 'CONT', count: 2 },
      { prefix: '(blank)', count: 1 },
      { prefix: 'FLT', count: 1 },
      { prefix: 'INV', count: 1 },
    ]);
  });
});
