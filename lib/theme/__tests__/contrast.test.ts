import { describe, it, expect } from 'vitest';
import {
  criticalBadgeText,
  themePresets,
  getPresetById,
  type ApxmThemeTokens,
} from '../presets';

// Requirement tests for #27: every preset must keep APXM's text readable
// (WCAG 2.x AA, 4.5:1 — almost all APXM text is 10–13px, so no large-text
// exemption), and the Colorblind preset's burn colours must stay distinct
// under colour-vision deficiency.

const AA_NORMAL_TEXT = 4.5;

/** Dimmest text opacity the UI uses for readable text (`text-apxm-text/55`).
 *  The off state of the BURN sheet's inbound rocket (/30) is deliberately dim
 *  and not text. */
const MIN_TEXT_OPACITY = 0.55;

/** Tint behind critical badges (`bg-status-critical/20`). */
const CRITICAL_BADGE_TINT = 0.2;

type Rgb = [number, number, number];

function channels(hex: number): Rgb {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

/** Alpha-blends fg over bg per sRGB channel — how `rgb(... / a)` paints. */
function blend(fg: number, bg: number, alpha: number): number {
  const f = channels(fg);
  const b = channels(bg);
  const mixed = f.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]));
  return (mixed[0] << 16) | (mixed[1] << 8) | mixed[2];
}

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminanceOfLinear([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const la = luminanceOfLinear(channels(a).map(toLinear) as Rgb);
  const lb = luminanceOfLinear(channels(b).map(toLinear) as Rgb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text tokens painted at full strength on bg and surface. */
const TEXT_TOKENS: (keyof ApxmThemeTokens)[] = [
  'text',
  'muted',
  'highlight',
  'statusCritical',
  'statusWarning',
  'statusOk',
  'statusSurplus',
  'statusInfo',
];

describe.each(themePresets.map((p) => [p.name, p.tokens] as const))(
  '%s preset contrast',
  (_name, t) => {
    const backgrounds = [
      ['bg', t.bg],
      ['surface', t.surface],
    ] as const;

    it.each(TEXT_TOKENS)('%s reads at 4.5:1 on bg and surface', (token) => {
      for (const [, bg] of backgrounds) {
        expect(contrast(t[token], bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    });

    it('the dimmest text opacity still reads at 4.5:1', () => {
      for (const [, bg] of backgrounds) {
        expect(contrast(blend(t.text, bg, MIN_TEXT_OPACITY), bg)).toBeGreaterThanOrEqual(
          AA_NORMAL_TEXT
        );
      }
    });

    it('critical badge text reads at 4.5:1 on its own tint', () => {
      const badgeText = criticalBadgeText(t.statusCritical);
      for (const [, bg] of backgrounds) {
        const tint = blend(t.statusCritical, bg, CRITICAL_BADGE_TINT);
        expect(contrast(badgeText, tint)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    });
  }
);

// Machado, Oliveira & Fernandes (2009) dichromacy matrices (severity 1.0),
// applied in linear RGB.
const CVD_SIMULATIONS: Record<string, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(hex: number, matrix: number[][]): Rgb {
  const lin = channels(hex).map(toLinear);
  return matrix.map((row) =>
    Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))
  ) as Rgb;
}

/** Linear sRGB → CIE L*a*b* (D65). */
function toLab([r, g, b]: Rgb): Rgb {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** CIE76 ΔE. ~2.3 is one just-noticeable difference; 15 keeps the burn
 *  colours obviously different at a glance, not merely distinguishable. */
const MIN_STATUS_DELTA_E = 15;

describe('Colorblind preset under colour-vision deficiency', () => {
  const t = getPresetById('colorblind').tokens;
  const statuses = {
    critical: t.statusCritical,
    warning: t.statusWarning,
    ok: t.statusOk,
    surplus: t.statusSurplus,
  };
  const names = Object.keys(statuses) as (keyof typeof statuses)[];

  it.each(Object.entries(CVD_SIMULATIONS))(
    'burn statuses stay distinct under %s',
    (_kind, matrix) => {
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = toLab(simulate(statuses[names[i]], matrix));
          const b = toLab(simulate(statuses[names[j]], matrix));
          expect(
            deltaE(a, b),
            `${names[i]} vs ${names[j]}`
          ).toBeGreaterThanOrEqual(MIN_STATUS_DELTA_E);
        }
      }
    }
  );
});
