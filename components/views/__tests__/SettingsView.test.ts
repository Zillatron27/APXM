import { describe, it, expect, beforeEach } from 'vitest';
import { validateThresholds } from '../SettingsView';
import { useSettingsStore, DEFAULT_THRESHOLDS } from '../../../stores/settings';

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
