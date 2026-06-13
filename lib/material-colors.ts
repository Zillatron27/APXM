/**
 * Material Category Color Palettes
 *
 * Color schemes for material tiles based on category.
 * Three themes:
 * - prun: Stock game colors (from PrUn JS bundle)
 * - rprun: rPrUn extension colors (overrides 7 categories)
 * - drydock: DryDock's neon-sign style — dark fill, category colour as
 *   both border and text (ported from drydock src/theme/tokens.css)
 *
 * Source: refined-prun/src/infrastructure/prun-ui/item-tracker.ts
 */

export type MaterialTheme = 'rprun' | 'prun' | 'drydock';

export interface CategoryColors {
  bg: string;
  text: string;
  /** Tile border colour. Only the drydock theme sets it — tiles draw a
   *  border iff the theme provides one. */
  border?: string;
}

/**
 * Stock PrUn theme - vanilla game colors from PrUn JS bundle.
 * All categories have colors. Colors are derived from base color:
 * - bg: darkened ~20%
 * - text: brightened ~40%
 *
 * Source: categoryColors in item-tracker.ts
 */
const PRUN_COLORS: Record<string, CategoryColors> = {
  'agricultural-products': { bg: '#8b1a1a', text: '#e54a4a' },  // #b22222 firebrick
  'alloys': { bg: '#a06228', text: '#e9a05c' },                 // #cd7f32 bronze
  'chemicals': { bg: '#b05070', text: '#f0a0c0' },              // #db7093 pale violet red
  'construction-materials': { bg: '#4878c8', text: '#98c0ff' }, // #6495ed cornflower blue
  'construction-parts': { bg: '#386090', text: '#78b0e0' },     // #4682b4 steel blue
  'construction-prefabs': { bg: '#142d94', text: '#4868e0' },   // #1c39bb dark blue
  'consumable-bundles': { bg: '#701020', text: '#c04058' },     // #971728 dark red
  'consumables-basic': { bg: '#a04848', text: '#f08888' },      // #cd5c5c indian red
  'consumables-luxury': { bg: '#a82238', text: '#f86080' },     // #da2c43 red
  'drones': { bg: '#b04018', text: '#ff8858' },                 // #e25822 flame
  'electronic-devices': { bg: '#6820b0', text: '#b868ff' },     // #8a2be2 blue violet
  'electronic-parts': { bg: '#7058b0', text: '#c0a0ff' },       // #9370db medium purple
  'electronic-pieces': { bg: '#9080b0', text: '#d8c8ff' },      // #b19cd9 light purple
  'electronic-systems': { bg: '#502878', text: '#9868c8' },     // #663399 rebecca purple
  'elements': { bg: '#604830', text: '#b08868' },               // #806043 brown
  'energy-systems': { bg: '#206848', text: '#60c090' },         // #2e8b57 sea green
  'fuels': { bg: '#28a028', text: '#68ff68' },                  // #32cd32 lime green
  'gases': { bg: '#00a0a8', text: '#48ffff' },                  // #00ced1 dark turquoise
  'infrastructure': { bg: '#18186c', text: '#5050b0' },         // #1e1e8c dark blue
  'liquids': { bg: '#98b8d0', text: '#e8ffff' },                // #bcd4e6 light blue
  'medical-equipment': { bg: '#78a878', text: '#c0ffc0' },      // #99cc99 pale green
  'metals': { bg: '#505050', text: '#a0a0a0' },                 // #696969 dim gray
  'minerals': { bg: '#9c8468', text: '#e8d0b0' },               // #c4a484 tan
  'ores': { bg: '#686c78', text: '#b0b8c8' },                   // #838996 gray blue
  'plastics': { bg: '#a02850', text: '#f06898' },               // #cb3365 pink red
  'ship-engines': { bg: '#cc3800', text: '#ff7840' },           // #ff4500 orange red
  'ship-kits': { bg: '#cc7000', text: '#ffb840' },              // #ff8c00 dark orange
  'ship-parts': { bg: '#cc8400', text: '#ffc840' },             // #ffa500 orange
  'ship-shields': { bg: '#cc9038', text: '#ffe080' },           // #ffb347 pastel orange
  'software-components': { bg: '#9c9048', text: '#e8e090' },    // #c5b358 vegas gold
  'software-systems': { bg: '#786808', text: '#c8b040' },       // #9b870c dark gold
  'software-tools': { bg: '#b08418', text: '#ffd058' },         // #daa520 goldenrod
  'textiles': { bg: '#788030', text: '#c0d070' },               // #96a53c olive green
  'unit-prefabs': { bg: '#403840', text: '#888080' },           // #534b4f dark gray
  'utility': { bg: '#a8a098', text: '#f0e8e0' },                // #cec7c1 light gray
};

/**
 * rPrUn theme colors - extends stock with custom overrides.
 * 7 categories are overridden, rest use stock colors.
 *
 * Source: better-item-colors.module.css
 */
const RPRUN_COLORS: Record<string, CategoryColors> = {
  // Start with all stock colors
  ...PRUN_COLORS,
  // Override 7 categories with rPrUn custom colors
  'agricultural-products': { bg: '#003800', text: '#8bb37b' },  // green (was red)
  'consumables-basic': { bg: '#a62c2a', text: '#ff989e' },      // dark red
  'consumables-luxury': { bg: '#680000', text: '#db9191' },     // maroon
  'fuels': { bg: '#548d22', text: '#cbfaa3' },                  // olive (was lime)
  'liquids': { bg: '#67a8da', text: '#f1ffff' },                // steel blue (was light blue)
  'plastics': { bg: '#791f62', text: '#f89ee1' },               // purple (was pink red)
  'ship-shields': { bg: '#bf740a', text: '#dbdb79' },           // dark orange (was pastel)
};

const DRYDOCK_BG = '#1a1a1a';

/** DryDock neon tile: bright category colour as both text and border over
 *  the shared dark fill. No glow/shadow — the "neon" read comes entirely
 *  from the bright-on-dark contrast. */
function neon(color: string): CategoryColors {
  return { bg: DRYDOCK_BG, text: color, border: color };
}

/**
 * DryDock theme. The 14 categories DryDock itself defines use its palette
 * verbatim; the remaining 21 reuse the prun theme's text colours (already
 * the bright variant of each category) so the whole set reads as one style.
 */
const DRYDOCK_COLORS: Record<string, CategoryColors> = {
  // DryDock-native palette (drydock src/theme/tokens.css)
  'alloys': neon('#ffaa44'),
  'chemicals': neon('#ff7eb3'),
  'construction-materials': neon('#5eaaff'),
  'electronic-systems': neon('#9955dd'),
  'elements': neon('#c9a06a'),
  'fuels': neon('#a0ff60'),
  'metals': neon('#b0b0b0'),
  'minerals': neon('#e8c9a0'),
  'plastics': neon('#ff6be0'),
  'ship-engines': neon('#ff5522'),
  'ship-kits': neon('#ffaa22'),
  'ship-parts': neon('#ffcc33'),
  'ship-shields': neon('#ffd34d'),
  'unit-prefabs': neon('#5a8c8c'),
  // Derived from the prun theme's text colours
  'agricultural-products': neon('#e54a4a'),
  'construction-parts': neon('#78b0e0'),
  'construction-prefabs': neon('#4868e0'),
  'consumable-bundles': neon('#c04058'),
  'consumables-basic': neon('#f08888'),
  'consumables-luxury': neon('#f86080'),
  'drones': neon('#ff8858'),
  'electronic-devices': neon('#b868ff'),
  'electronic-parts': neon('#c0a0ff'),
  'electronic-pieces': neon('#d8c8ff'),
  'energy-systems': neon('#60c090'),
  'gases': neon('#48ffff'),
  'infrastructure': neon('#5050b0'),
  'liquids': neon('#e8ffff'),
  'medical-equipment': neon('#c0ffc0'),
  'ores': neon('#b0b8c8'),
  'software-components': neon('#e8e090'),
  'software-systems': neon('#c8b040'),
  'software-tools': neon('#ffd058'),
  'textiles': neon('#c0d070'),
  'utility': neon('#f0e8e0'),
};

const DEFAULT_COLORS: CategoryColors = { bg: '#2a2a3c', text: '#808080' };

// An unknown category should still read as the active theme's style
const DRYDOCK_DEFAULT: CategoryColors = neon('#808080');

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

const PALETTES: Record<
  MaterialTheme,
  { colors: Record<string, CategoryColors>; fallback: CategoryColors }
> = {
  prun: { colors: PRUN_COLORS, fallback: DEFAULT_COLORS },
  rprun: { colors: RPRUN_COLORS, fallback: DEFAULT_COLORS },
  drydock: { colors: DRYDOCK_COLORS, fallback: DRYDOCK_DEFAULT },
};

/**
 * Returns the tile colors for a material category under the given theme.
 */
export function getCategoryColors(category: string, theme: MaterialTheme): CategoryColors {
  const slug = normalizeCategory(category);
  const palette = PALETTES[theme];
  return palette.colors[slug] ?? palette.fallback;
}
