/**
 * APXM UI theme presets.
 *
 * These are Helm's themes (issue #22) *translated into APXM's visual identity*,
 * not Helm's raw values copied over. Helm is a map app whose chrome recedes, so
 * its bg/surface/tertiary sit in a near-identical dark band. APXM is an
 * information-dense panel UI whose identity is contrast: a near-black
 * background, a distinctly *raised* card surface, and a clearly visible accent
 * tone for borders and dividers.
 *
 * So every preset preserves APXM's structural separation (bg → lighter surface
 * → brighter accent) and takes only each Helm theme's *character* — its
 * highlight hue and colour temperature. PrUn is the default and is APXM's
 * original navy/gold identity verbatim.
 *
 * `highlight` is the interactive accent (the old `prun-yellow`). The four-level
 * burn-status palette is APXM's own (Helm has only positive/negative); the
 * Colorblind preset swaps it for CVD-safe Okabe-Ito values so burn indicators
 * stay legible for the ~8% of users with red-green colour vision deficiency.
 *
 * Colours are 24-bit hex numbers; the apply step converts them to CSS hex + rgb
 * channel strings.
 */

export type ApxmThemeId = 'drydock' | 'crt' | 'prun' | 'vivid' | 'colorblind';

export interface ApxmThemeTokens {
  /** Page/host background (Helm bgPrimary). */
  bg: number;
  /** Card/panel surface (Helm bgSecondary). */
  surface: number;
  /** Tertiary surface — used as both subtle fill and divider/border (Helm bgTertiary). */
  accent: number;
  /** Primary text (Helm textPrimary). */
  text: number;
  /** Secondary/muted text (Helm textSecondary). */
  muted: number;
  /** Interactive highlight — buttons, active states, focus (Helm accent). */
  highlight: number;
  /** Burn status: out of supply imminently. */
  statusCritical: number;
  /** Burn status: running low. */
  statusWarning: number;
  /** Burn status: healthy. */
  statusOk: number;
  /** Burn status: producing more than consumed. */
  statusSurplus: number;
}

// Standard burn-status palette (Tailwind 500-level). Matches the existing
// `status.*` Tailwind tokens, so anything already using them is unchanged.
const STATUS_STANDARD = {
  statusCritical: 0xef4444, // red-500
  statusWarning: 0xf59e0b, // amber-500
  statusOk: 0x22c55e, // green-500
  statusSurplus: 0x3b82f6, // blue-500
} as const;

// PrUn — APXM's original navy/gold identity, verbatim. The reference for the
// bg → surface → accent contrast every other preset echoes.
const prun: ApxmThemeTokens = {
  bg: 0x0a0a1a,
  surface: 0x16213e,
  accent: 0x0f3460,
  text: 0xe4e4e4,
  muted: 0x808080,
  highlight: 0xf7a600,
  ...STATUS_STANDARD,
};

// DryDock — Helm's neutral greyscale with an orange highlight. APXM contrast
// applied in neutral grey: black bg, clearly lighter surface, visible grey border.
const drydock: ApxmThemeTokens = {
  bg: 0x0a0a0a,
  surface: 0x1c1c1c,
  accent: 0x363636,
  text: 0xe0e0e0,
  muted: 0x8a8a8a,
  highlight: 0xff8c00,
  ...STATUS_STANDARD,
};

// CRT — green phosphor. Dark-green bg, a raised green panel, a bright green
// border line, vivid phosphor highlight.
const crt: ApxmThemeTokens = {
  bg: 0x050a05,
  surface: 0x102610,
  accent: 0x1f4a1f,
  text: 0xccffcc,
  muted: 0x5f9f5f,
  highlight: 0x33ff33,
  ...STATUS_STANDARD,
};

// Vivid — cool blue-purple structure with a hot red-orange highlight.
const vivid: ApxmThemeTokens = {
  bg: 0x08080f,
  surface: 0x18182a,
  accent: 0x2c2c4a,
  text: 0xf0f0f0,
  muted: 0x9090b0,
  highlight: 0xff6644,
  ...STATUS_STANDARD,
};

// Colorblind — neutral structure with a blue highlight and a CVD-safe burn
// palette (Okabe-Ito): four mutually distinct hues that survive
// deuteranopia/protanopia. Burn UI also pairs these with text/labels.
const colorblind: ApxmThemeTokens = {
  bg: 0x0a0a0a,
  surface: 0x1c1c1c,
  accent: 0x36363e,
  text: 0xe0e0e0,
  muted: 0x909090,
  highlight: 0x0088ff, // sky blue
  statusCritical: 0xd55e00, // vermillion
  statusWarning: 0xf0e442, // yellow
  statusOk: 0x009e73, // bluish green
  statusSurplus: 0x56b4e9, // sky blue
};

export interface ApxmThemePreset {
  id: ApxmThemeId;
  name: string;
  tokens: ApxmThemeTokens;
}

/** Presets in selector display order. PrUn is the APXM default. */
export const themePresets: ApxmThemePreset[] = [
  { id: 'prun', name: 'PrUn', tokens: prun },
  { id: 'drydock', name: 'DryDock', tokens: drydock },
  { id: 'crt', name: 'CRT', tokens: crt },
  { id: 'vivid', name: 'Vivid', tokens: vivid },
  { id: 'colorblind', name: 'Colorblind', tokens: colorblind },
];

export const DEFAULT_THEME_ID: ApxmThemeId = 'prun';

const presetMap = new Map<string, ApxmThemePreset>(
  themePresets.map((p) => [p.id, p])
);

/** Returns the preset for an id, falling back to the default for unknown ids. */
export function getPresetById(id: string): ApxmThemePreset {
  return presetMap.get(id) ?? presetMap.get(DEFAULT_THEME_ID)!;
}
