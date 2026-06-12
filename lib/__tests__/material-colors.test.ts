import { describe, it, expect } from 'vitest';
import { normalizeCategory, getCategoryColors, type MaterialTheme } from '../material-colors';
import { MATERIAL_CATEGORIES } from '../material-categories';

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

      it('returns rPrUn override color for agricultural-products (green)', () => {
        const colors = getCategoryColors('agricultural-products', theme);
        expect(colors.bg).toBe('#003800');
        expect(colors.text).toBe('#8bb37b');
      });

      it('returns stock color for metals (not overridden by rPrUn)', () => {
        const colors = getCategoryColors('metals', theme);
        expect(colors.bg).toBe('#505050');
        expect(colors.text).toBe('#a0a0a0');
      });

      it('returns rPrUn override color for fuels (olive)', () => {
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

      it('returns stock color for agricultural-products (red)', () => {
        const colors = getCategoryColors('agricultural-products', theme);
        expect(colors.bg).toBe('#8b1a1a');
        expect(colors.text).toBe('#e54a4a');
      });

      it('returns stock color for fuels (lime green)', () => {
        const colors = getCategoryColors('fuels', theme);
        expect(colors.bg).toBe('#28a028');
        expect(colors.text).toBe('#68ff68');
      });

      it('returns stock color for metals (gray)', () => {
        // metals HAS a stock color in PrUn (dim gray)
        const colors = getCategoryColors('metals', theme);
        expect(colors.bg).toBe('#505050');
        expect(colors.text).toBe('#a0a0a0');
      });

      it('returns default colors for unknown category', () => {
        const colors = getCategoryColors('unknown-category', theme);
        expect(colors.bg).toBe('#2a2a3c');
        expect(colors.text).toBe('#808080');
      });
    });

    describe('drydock theme', () => {
      const theme: MaterialTheme = 'drydock';

      it('returns the DryDock palette value for a native category (fuels)', () => {
        const colors = getCategoryColors('fuels', theme);
        expect(colors).toEqual({ bg: '#1a1a1a', text: '#a0ff60', border: '#a0ff60' });
      });

      it('renders a derived category in the same neon style: dark fill, text matching border', () => {
        const colors = getCategoryColors('agricultural-products', theme);
        expect(colors.bg).toBe('#1a1a1a');
        expect(colors.border).toBeDefined();
        expect(colors.text).toBe(colors.border);
      });

      it('covers every category a material can resolve to with the full neon contract', () => {
        // MaterialTile looks up via MATERIAL_CATEGORIES, so its unique slugs
        // are the complete set of categories the tile can ever request.
        const slugs = new Set(Object.values(MATERIAL_CATEGORIES));
        for (const slug of slugs) {
          const colors = getCategoryColors(slug, theme);
          expect(colors.bg, slug).toBe('#1a1a1a');
          expect(colors.border, slug).toBeDefined();
          expect(colors.text, slug).toBe(colors.border);
        }
      });

      it('returns a neon-styled default for unknown categories', () => {
        const colors = getCategoryColors('unknown-category', theme);
        expect(colors).toEqual({ bg: '#1a1a1a', text: '#808080', border: '#808080' });
      });
    });

    describe('border back-compat contract', () => {
      it('prun and rprun themes never set a border — existing tiles rely on borderless rendering', () => {
        expect(getCategoryColors('metals', 'prun').border).toBeUndefined();
        expect(getCategoryColors('fuels', 'rprun').border).toBeUndefined();
        expect(getCategoryColors('unknown-category', 'prun').border).toBeUndefined();
      });
    });
  });
});
