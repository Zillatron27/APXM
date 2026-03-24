/**
 * Shared utilities for shell UI panels.
 */

import { getSystemByNaturalId, getCxForSystem, search as helmSearch, getActiveThemeId } from '@27bit/helm';
import type { MaterialTheme } from './material-colors';
import type { ShipSummary } from '../types/bridge';

/** HTML-escapes text for safe injection into innerHTML. */
export function esc(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Returns a display-friendly system name (CX NaturalId if available, otherwise system naturalId). */
export function systemDisplayName(naturalId: string | null): string {
  if (!naturalId) return '???';
  const sys = getSystemByNaturalId(naturalId);
  if (!sys) return naturalId;
  const cx = getCxForSystem(sys.id);
  return cx ? cx.NaturalId : sys.naturalId;
}

/**
 * Returns a display-friendly location name for an idle ship.
 *
 * Ships at CX stations have no PLANET address line, so locationPlanetNaturalId is null.
 * They fall through to systemDisplayName which resolves CX systems to their NaturalId (e.g. "ANT").
 *
 * Ships at planets use Helm's search index (populated from FIO /planet/allplanets on init)
 * to resolve the planet natural ID to a friendly name.
 */
export function shipLocationName(ship: ShipSummary): string {
  if (!ship.locationPlanetNaturalId) {
    return systemDisplayName(ship.locationSystemNaturalId);
  }

  // Helm search index: exact match on planet natural ID → planet name
  const results = helmSearch(ship.locationPlanetNaturalId, 1);
  if (results.length > 0 && results[0].naturalId === ship.locationPlanetNaturalId) {
    return results[0].name;
  }

  // Fallback to raw planet natural ID
  return ship.locationPlanetNaturalId;
}

/** Returns the active material color theme based on Helm's current theme. */
export function getTheme(): MaterialTheme {
  return getActiveThemeId() === 'prun-classic' ? 'prun' : 'rprun';
}
