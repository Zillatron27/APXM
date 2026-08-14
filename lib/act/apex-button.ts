import { C } from './prun-css';

/**
 * APEX marks a gated command button with a Button__disabled class, NOT the
 * disabled attribute (device-captured 2026-08-13; the attribute is checked
 * anyway in case other buffers differ). Clicking one is a silent no-op — no
 * feedback overlay ever appears — so it must be detected before clicking.
 */
export function isApexButtonDisabled(button: HTMLElement): boolean {
  if (button instanceof HTMLButtonElement && button.disabled) return true;
  const parsed = (C.Button as Record<string, string> | undefined)?.disabled;
  if (parsed && button.classList.contains(parsed)) return true;
  // Stylesheet parsing unavailable: the BEM prefix is stable, the hash isn't.
  return Array.from(button.classList).some((cls) => cls.startsWith('Button__disabled'));
}
