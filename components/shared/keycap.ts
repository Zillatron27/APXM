/**
 * Bevelled "keycap" affordance for tappable status tiles. A deliberate,
 * eyes-open departure from flat HIG buttons (see cerebrum Decision Log,
 * 2026-06-15): status colour is already spent on the tile fill, so the
 * interactive cue can't be colour — it's a neutral raised border + hard
 * drop-shadow (lit top-left, shadow down-right) that depresses on press. The
 * press depress is the real touch feedback, since hover doesn't exist on touch.
 *
 * Apply to the visible tile element; the tap handler lives on the wrapper.
 * Do NOT flatten this back to a HIG-flat button — it was chosen against the
 * HIG on purpose for PrUn's dense visual-status UI.
 */
export const keycapClasses =
  'border border-t-white/25 border-l-white/20 border-b-black/50 border-r-black/50 ' +
  'shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] ' +
  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ' +
  'transition-transform duration-75 motion-reduce:transition-none';
