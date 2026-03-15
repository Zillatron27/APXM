/**
 * Shared utilities for shell UI panels.
 */

import { getSystemByNaturalId, getCxForSystem, getActiveThemeId } from '@27bit/helm';
import type { MaterialTheme } from './material-colors';

/** HTML-escapes text for safe injection into innerHTML. */
export function esc(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Returns a display-friendly system name (CX code if available, otherwise naturalId). */
export function systemDisplayName(naturalId: string | null): string {
  if (!naturalId) return '???';
  const sys = getSystemByNaturalId(naturalId);
  if (!sys) return naturalId;
  const cx = getCxForSystem(sys.id);
  return cx ? cx.ComexCode : sys.naturalId;
}

/** Returns the active material color theme based on Helm's current theme. */
export function getTheme(): MaterialTheme {
  return getActiveThemeId() === 'prun-classic' ? 'prun' : 'rprun';
}
