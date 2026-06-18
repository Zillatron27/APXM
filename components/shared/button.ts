/**
 * Button affordances for the Retro Terminal screen style. The press cue (hard
 * resting drop-shadow that depresses on tap) is the same physical idiom as the
 * keycap tiles (see keycap.ts) — the real touch feedback, since hover doesn't
 * exist on touch. Mono, uppercase, letter-spaced labels, square corners.
 *
 * `btnSecondary` is the bordered variant (e.g. SHOW APEX / Show APXM). Add a
 * filled `btnPrimary` here when a primary action surface needs one.
 */
const press =
  'shadow-[2px_2px_0_0_rgba(0,0,0,0.45)] ' +
  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ' +
  'transition-transform duration-75 motion-reduce:transition-none';

export const btnSecondary =
  'font-mono text-[11px] font-semibold tracking-wider uppercase ' +
  'text-apxm-text border border-apxm-accent ' +
  'hover:border-prun-yellow hover:text-prun-yellow ' +
  press;
