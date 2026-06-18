/**
 * Button affordances for the Retro Terminal screen style.
 *
 * `btnPress` is the style guide's `.apxm-btn` press: a soft resting shadow that
 * LIFTS on hover and DEPRESSES (translateY + small shadow) on active, animating
 * both transform and shadow. Distinct from the dense-tile keycap (keycap.ts),
 * whose hard pixel-shadow + diagonal snap fits inline status chips; this is the
 * idiom for actual buttons. Use on surfaces that own their border and fill
 * (e.g. the tier-tinted attention tiles).
 *
 * `btnSecondary` is the bordered text variant (e.g. SHOW APEX / Show APXM). Add
 * a filled `btnPrimary` here when a primary action surface needs one.
 */
export const btnPress =
  'shadow-[0_2px_4px_rgba(0,0,0,0.5)] ' +
  'hover:shadow-[0_5px_11px_rgba(0,0,0,0.6)] ' +
  'active:translate-y-[2px] active:shadow-[0_1px_2px_rgba(0,0,0,0.45)] ' +
  'transition-[transform,box-shadow] duration-100 motion-reduce:transition-none';

export const btnSecondary =
  'font-mono text-[11px] font-semibold tracking-wider uppercase ' +
  'text-apxm-text border border-apxm-accent ' +
  'hover:border-prun-yellow hover:text-prun-yellow ' +
  btnPress;
