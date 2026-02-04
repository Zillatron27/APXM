import { describe, it, expect } from 'vitest';
import { normalizeCategory, getCategoryColors, type MaterialTheme } from '../material-colors';

describe('material-colors', () => {
  describe('normalizeCategory', () => {
    it('converts spaces to hyphens', () => {
      expect(normalizeCategory('agricultural products')).toBe('agricultural-products');
    });

    it('converts underscores to hyphens', () => {
      expect(normalizeCategory('agricultural_products')).toBe('agricultural-products');
    });

    it('lowercases the category', () => {
      expect(normalizeCategory('AGRICULTURAL_PRODUCTS')).toBe('agricultural-products');
    });

    it('handles null/undefined', () => {
      expect(normalizeCategory(null)).toBe('default');
      expect(normalizeCategory(undefined)).toBe('default');
    });

    it('handles empty string', () => {
      expect(normalizeCategory('')).toBe('default');
    });
  });

  describe('getCategoryColors', () => {
    describe('rprun theme', () => {
      const theme: MaterialTheme = 'rprun';

      it('returns correct colors for agricultural-products', () => {
        const colors = getCategoryColors('agricultural-products', theme);
        expect(colors.bg).toBe('#003800');
        expect(colors.text).toBe('#8bb37b');
      });

      it('returns correct colors for metals', () => {
        const colors = getCategoryColors('metals', theme);
        expect(colors.bg).toBe('#444444');
        expect(colors.text).toBe('#a8a8a8');
      });

      it('returns correct colors for fuels', () => {
        const colors = getCategoryColors('fuels', theme);
        expect(colors.bg).toBe('#548d22');
        expect(colors.text).toBe('#cbfaa3');
      });

      it('returns default colors for unknown category', () => {
        const colors = getCategoryColors('unknown-category', theme);
        expect(colors.bg).toBe('#2a2a3c');
        expect(colors.text).toBe('#808080');
      });

      it('normalizes category before lookup', () => {
        const colors = getCategoryColors('AGRICULTURAL_PRODUCTS', theme);
        expect(colors.bg).toBe('#003800');
      });
    });

    describe('prun theme', () => {
      const theme: MaterialTheme = 'prun';

      it('returns correct colors for agricultural-products', () => {
        const colors = getCategoryColors('agricultural-products', theme);
        expect(colors.bg).toBe('#c83030');
        expect(colors.text).toBe('#e86060');
      });

      it('returns correct colors for fuels', () => {
        const colors = getCategoryColors('fuels', theme);
        expect(colors.bg).toBe('#40a040');
        expect(colors.text).toBe('#80d080');
      });

      it('returns default colors for category not in prun theme', () => {
        // metals is not in the stock PrUn theme
        const colors = getCategoryColors('metals', theme);
        expect(colors.bg).toBe('#2a2a3c');
        expect(colors.text).toBe('#808080');
      });
    });
  });
});
