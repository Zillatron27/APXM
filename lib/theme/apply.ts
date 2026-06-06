/**
 * Applies an APXM theme by writing CSS custom properties to the document root.
 *
 * APXM renders inside a Shadow DOM, but custom properties set on
 * `document.documentElement` inherit across the shadow boundary, so the overlay
 * picks them up without any per-root wiring (same approach Helm uses).
 *
 * Each token is exposed twice: a CSS hex value (`--apxm-bg`) and an rgb channel
 * triple (`--apxm-bg-rgb`). The channel form is what Tailwind consumes via
 * `rgb(var(--apxm-bg-rgb) / <alpha-value>)`, which is required because many
 * components use colour-alpha modifiers (e.g. `text-apxm-text/70`).
 */

import { getPresetById, type ApxmThemeId, type ApxmThemeTokens } from './presets';

function hexToCssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// Space-separated channels — required by Tailwind's `rgb(var(--x) / <alpha>)`
// utilities. The comma form (`r, g, b`) is invalid in the slash-alpha syntax
// and the browser silently drops the whole declaration.
function hexToRgbChannels(hex: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `${r} ${g} ${b}`;
}

// Maps token keys to their CSS custom-property base names.
const VAR_NAMES: Record<keyof ApxmThemeTokens, string> = {
  bg: '--apxm-bg',
  surface: '--apxm-surface',
  accent: '--apxm-accent',
  text: '--apxm-text',
  muted: '--apxm-muted',
  highlight: '--apxm-highlight',
  statusCritical: '--apxm-status-critical',
  statusWarning: '--apxm-status-warning',
  statusOk: '--apxm-status-ok',
  statusSurplus: '--apxm-status-surplus',
};

// Tracks the applied id so the store subscription (which fires on every
// settings change) can short-circuit when the theme hasn't actually changed.
let appliedId: ApxmThemeId | null = null;

/** Writes the preset's tokens to documentElement as CSS custom properties. */
export function applyTheme(id: ApxmThemeId): void {
  if (id === appliedId) return;

  const { id: resolvedId, tokens } = getPresetById(id);
  const root = document.documentElement.style;

  for (const key of Object.keys(VAR_NAMES) as (keyof ApxmThemeTokens)[]) {
    const value = tokens[key];
    const name = VAR_NAMES[key];
    root.setProperty(name, hexToCssHex(value));
    root.setProperty(`${name}-rgb`, hexToRgbChannels(value));
  }

  appliedId = resolvedId;
}
