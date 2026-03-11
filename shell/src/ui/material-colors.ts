// Canonical source: lib/material-colors.ts — duplicated because shell is a separate Vite build

export type MaterialTheme = 'rprun' | 'prun';

export interface CategoryColors {
  bg: string;
  text: string;
}

/**
 * Stock PrUn theme - vanilla game colors from PrUn JS bundle.
 * All categories have colors. Colors are derived from base color:
 * - bg: darkened ~20%
 * - text: brightened ~40%
 */
const PRUN_COLORS: Record<string, CategoryColors> = {
  'agricultural-products': { bg: '#8b1a1a', text: '#e54a4a' },
  'alloys': { bg: '#a06228', text: '#e9a05c' },
  'chemicals': { bg: '#b05070', text: '#f0a0c0' },
  'construction-materials': { bg: '#4878c8', text: '#98c0ff' },
  'construction-parts': { bg: '#386090', text: '#78b0e0' },
  'construction-prefabs': { bg: '#142d94', text: '#4868e0' },
  'consumable-bundles': { bg: '#701020', text: '#c04058' },
  'consumables-basic': { bg: '#a04848', text: '#f08888' },
  'consumables-luxury': { bg: '#a82238', text: '#f86080' },
  'drones': { bg: '#b04018', text: '#ff8858' },
  'electronic-devices': { bg: '#6820b0', text: '#b868ff' },
  'electronic-parts': { bg: '#7058b0', text: '#c0a0ff' },
  'electronic-pieces': { bg: '#9080b0', text: '#d8c8ff' },
  'electronic-systems': { bg: '#502878', text: '#9868c8' },
  'elements': { bg: '#604830', text: '#b08868' },
  'energy-systems': { bg: '#206848', text: '#60c090' },
  'fuels': { bg: '#28a028', text: '#68ff68' },
  'gases': { bg: '#00a0a8', text: '#48ffff' },
  'infrastructure': { bg: '#18186c', text: '#5050b0' },
  'liquids': { bg: '#98b8d0', text: '#e8ffff' },
  'medical-equipment': { bg: '#78a878', text: '#c0ffc0' },
  'metals': { bg: '#505050', text: '#a0a0a0' },
  'minerals': { bg: '#9c8468', text: '#e8d0b0' },
  'ores': { bg: '#686c78', text: '#b0b8c8' },
  'plastics': { bg: '#a02850', text: '#f06898' },
  'ship-engines': { bg: '#cc3800', text: '#ff7840' },
  'ship-kits': { bg: '#cc7000', text: '#ffb840' },
  'ship-parts': { bg: '#cc8400', text: '#ffc840' },
  'ship-shields': { bg: '#cc9038', text: '#ffe080' },
  'software-components': { bg: '#9c9048', text: '#e8e090' },
  'software-systems': { bg: '#786808', text: '#c8b040' },
  'software-tools': { bg: '#b08418', text: '#ffd058' },
  'textiles': { bg: '#788030', text: '#c0d070' },
  'unit-prefabs': { bg: '#403840', text: '#888080' },
  'utility': { bg: '#a8a098', text: '#f0e8e0' },
};

/**
 * rPrUn theme colors - extends stock with custom overrides.
 * 7 categories are overridden, rest use stock colors.
 */
const RPRUN_COLORS: Record<string, CategoryColors> = {
  ...PRUN_COLORS,
  'agricultural-products': { bg: '#003800', text: '#8bb37b' },
  'consumables-basic': { bg: '#a62c2a', text: '#ff989e' },
  'consumables-luxury': { bg: '#680000', text: '#db9191' },
  'fuels': { bg: '#548d22', text: '#cbfaa3' },
  'liquids': { bg: '#67a8da', text: '#f1ffff' },
  'plastics': { bg: '#791f62', text: '#f89ee1' },
  'ship-shields': { bg: '#bf740a', text: '#dbdb79' },
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
    .replace(/[()]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

/** Returns the background and text colors for a material category. */
export function getCategoryColors(category: string, theme: MaterialTheme): CategoryColors {
  const slug = normalizeCategory(category);
  const palette = theme === 'rprun' ? RPRUN_COLORS : PRUN_COLORS;
  return palette[slug] ?? DEFAULT_COLORS;
}
