import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from '../apply';
import { getPresetById, themePresets, DEFAULT_THEME_ID } from '../presets';

function readVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name).trim();
}

describe('getPresetById', () => {
  it('returns the requested preset', () => {
    expect(getPresetById('crt').id).toBe('crt');
    expect(getPresetById('vivid').name).toBe('Vivid');
  });

  it('falls back to the default for an unknown id', () => {
    expect(getPresetById('does-not-exist').id).toBe(DEFAULT_THEME_ID);
  });

  it('default id resolves to a real preset', () => {
    expect(themePresets.some((p) => p.id === DEFAULT_THEME_ID)).toBe(true);
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    // Clear any vars left by a previous test so the no-op guard starts fresh.
    document.documentElement.removeAttribute('style');
  });

  it('writes hex and rgb-channel custom properties to documentElement', () => {
    // crt bg = 0x050a05 → "#050a05" / "5 10 5" (space-separated for Tailwind).
    applyTheme('crt');
    expect(readVar('--apxm-bg')).toBe('#050a05');
    expect(readVar('--apxm-bg-rgb')).toBe('5 10 5');
    // Status tokens are present too.
    expect(readVar('--apxm-status-critical')).toBe('#ef4444');
    expect(readVar('--apxm-status-surplus-rgb')).toBe('59 130 246');
  });

  it('updates the vars when switching themes', () => {
    applyTheme('crt');
    applyTheme('vivid');
    // vivid highlight = 0xff6644
    expect(readVar('--apxm-highlight')).toBe('#ff6644');
  });

  it('Colorblind preset uses CVD-safe status colours', () => {
    applyTheme('colorblind');
    expect(readVar('--apxm-status-ok')).toBe('#009e73'); // bluish green, not green-500
    expect(readVar('--apxm-status-critical')).toBe('#d55e00'); // vermillion
  });

  it('re-applying the same theme is a no-op (guard)', () => {
    // Self-contained regardless of prior appliedId: land on 'drydock', wipe the
    // vars, then re-apply 'drydock' — the guard must skip the rewrite.
    applyTheme('crt');
    applyTheme('drydock');
    document.documentElement.removeAttribute('style');
    applyTheme('drydock');
    expect(readVar('--apxm-bg')).toBe('');
  });
});

/**
 * Regression guard for the comma-vs-space channel bug.
 *
 * The components colour themselves with Tailwind utilities that expand to
 * `rgb(var(--apxm-x-rgb) / <opacity>)`. That syntax ONLY accepts space-separated
 * channels — e.g. `rgb(22 33 62 / 1)`. If the `-rgb` custom property is instead
 * comma-separated (`22, 33, 62`), the result `rgb(22, 33, 62 / 1)` is invalid
 * CSS, the browser throws the whole declaration away, and the theme silently
 * fails to paint — which is exactly what happened.
 *
 * These tests check the *format requirement* against every theme, not a single
 * hand-typed colour, so any preset that emits the wrong shape fails the build.
 */
describe('rgb channel format (Tailwind contract)', () => {
  // Matches three 0–255 numbers separated by single spaces: "22 33 62".
  const SPACE_CHANNELS = /^\d{1,3} \d{1,3} \d{1,3}$/;
  // The modern rgb() form Tailwind produces, e.g. "rgb(22 33 62 / 1)".
  const VALID_RGB = /^rgb\(\d{1,3} \d{1,3} \d{1,3} \/ [\d.]+\)$/;

  /** Every `--apxm-*-rgb` custom property currently on the document root. */
  function rgbChannelVars(): { name: string; value: string }[] {
    const style = document.documentElement.style;
    const out: { name: string; value: string }[] = [];
    for (let i = 0; i < style.length; i++) {
      const name = style.item(i);
      if (name.endsWith('-rgb')) {
        out.push({ name, value: style.getPropertyValue(name).trim() });
      }
    }
    return out;
  }

  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  for (const preset of themePresets) {
    it(`${preset.name}: every channel var is space-separated and valid in rgb()`, () => {
      // Defeat applyTheme's no-op guard regardless of prior test state: land on
      // a different theme first, clear the DOM, then apply the real one.
      applyTheme(preset.id === 'prun' ? 'crt' : 'prun');
      document.documentElement.removeAttribute('style');
      applyTheme(preset.id);
      const vars = rgbChannelVars();

      // Sanity: the theme actually wrote channel vars (so an empty loop can't
      // make this pass by doing nothing).
      expect(vars.length).toBeGreaterThan(0);

      for (const { name, value } of vars) {
        expect(value, `${name} must be space-separated, got "${value}"`).toMatch(
          SPACE_CHANNELS
        );
        expect(value, `${name} must not use commas`).not.toContain(',');
        // The decisive check: drop it into Tailwind's syntax and confirm the
        // resulting declaration is a valid modern rgb() colour.
        expect(`rgb(${value} / 1)`).toMatch(VALID_RGB);
      }
    });
  }
});
