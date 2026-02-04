/**
 * Material Category Color Palettes
 *
 * Color schemes for material tiles based on category.
 * Two themes: rprun (26 categories) and prun (stock UI, 5 categories).
 */

export type MaterialTheme = 'rprun' | 'prun';

export interface CategoryColors {
  bg: string;
  text: string;
}

/**
 * rPrUn theme colors - 26 categories with distinct colors.
 * Using darker end of PrUnderground gradients for better mobile visibility.
 */
const RPRUN_COLORS: Record<string, CategoryColors> = {
  'agricultural-products': { bg: '#003800', text: '#8bb37b' },
  'alloys': { bg: '#8a5414', text: '#e8b366' },
  'chemicals': { bg: '#a84a68', text: '#f4a8be' },
  'consumables-basic': { bg: '#a62c2a', text: '#ff989e' },
  'consumables-luxury': { bg: '#680000', text: '#db9191' },
  'construction-materials': { bg: '#3a6aa8', text: '#a8c8f0' },
  'construction-parts': { bg: '#2e5a7c', text: '#88b8dc' },
  'construction-prefabs': { bg: '#102478', text: '#6080e8' },
  'drones': { bg: '#a03810', text: '#f89868' },
  'electronic-devices': { bg: '#5a1894', text: '#c080f8' },
  'electronic-parts': { bg: '#6848a8', text: '#c8a8f8' },
  'electronic-pieces': { bg: '#8070a8', text: '#e0d0f8' },
  'electronic-systems': { bg: '#441c6c', text: '#a070d0' },
  'elements': { bg: '#54402c', text: '#b89878' },
  'energy-systems': { bg: '#1c5838', text: '#70d0a0' },
  'fuels': { bg: '#548d22', text: '#cbfaa3' },
  'gases': { bg: '#008888', text: '#60f8f8' },
  'liquids': { bg: '#4080a8', text: '#f1ffff' },
  'metals': { bg: '#444444', text: '#a8a8a8' },
  'minerals': { bg: '#907858', text: '#e8d0b0' },
  'ores': { bg: '#585c68', text: '#b8c0d0' },
  'plastics': { bg: '#791f62', text: '#f89ee1' },
  'ship-engines': { bg: '#c02800', text: '#ff9060' },
  'ship-kits': { bg: '#b86000', text: '#ffc060' },
  'ship-parts': { bg: '#c07800', text: '#ffd060' },
  'ship-shields': { bg: '#bf740a', text: '#dbdb79' },
  'software-components': { bg: '#988828', text: '#e8e098' },
  'software-systems': { bg: '#786808', text: '#d0c048' },
  'software-tools': { bg: '#a88010', text: '#f8d870' },
  'textiles': { bg: '#647020', text: '#c8d878' },
  'unit-prefabs': { bg: '#302830', text: '#908088' },
};

/**
 * Stock PrUn theme - only 5 categories have distinct colors.
 * All others fall back to default gray.
 */
const PRUN_COLORS: Record<string, CategoryColors> = {
  'agricultural-products': { bg: '#c83030', text: '#e86060' },
  'consumables-basic': { bg: '#e06868', text: '#f89898' },
  'fuels': { bg: '#40a040', text: '#80d080' },
  'liquids': { bg: '#6098c3', text: '#d0e8f8' },
  'plastics': { bg: '#c04078', text: '#e890b8' },
};

const DEFAULT_COLORS: CategoryColors = { bg: '#2a2a3c', text: '#808080' };

/**
 * Normalizes a category name to slug format for lookup.
 * FIO returns categories like "agricultural products" or "AGRICULTURAL_PRODUCTS".
 */
export function normalizeCategory(category: string | null | undefined): string {
  if (!category) return 'default';
  return category
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

/**
 * Returns the background and text colors for a material category.
 */
export function getCategoryColors(category: string, theme: MaterialTheme): CategoryColors {
  const slug = normalizeCategory(category);
  const palette = theme === 'rprun' ? RPRUN_COLORS : PRUN_COLORS;
  return palette[slug] ?? DEFAULT_COLORS;
}
