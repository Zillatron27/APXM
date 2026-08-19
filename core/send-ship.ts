// Send-ship planning: the destinations the user actually flies to — own
// bases and CX stations — with the labels APEX's AddressSelector suggestions
// render (selection is by exact suggestion-label match, so these strings
// must mirror APEX's own formatting, verified in the 2026-08-14 capture:
// bases render "Antares I - Bober (ZV-307b)", stations "Antares Station
// (Antares I)").

import type { PrunApi } from '../types/prun-api';

export interface SendDestination {
  /** Exact suggestion label to match in APEX's dropdown. */
  label: string;
  /** What gets typed into the selector (the name part — typing the
   *  parenthesised suffix can defeat the search). */
  query: string;
  kind: 'base' | 'station';
  /** Planet/station naturalId, used to exclude the ship's current location. */
  naturalId: string;
}

/** The CX stations — fixed game constants (one per exchange), labels as the
 *  AddressSelector renders them. */
export const CX_STATIONS: SendDestination[] = [
  { label: 'Antares Station (Antares I)', query: 'Antares Station', kind: 'station', naturalId: 'ANT' },
  { label: 'Arclight Station (Arclight)', query: 'Arclight Station', kind: 'station', naturalId: 'ARC' },
  { label: 'Benten Station (Benten)', query: 'Benten Station', kind: 'station', naturalId: 'BEN' },
  { label: 'Hortus Station (Hortus)', query: 'Hortus Station', kind: 'station', naturalId: 'HRT' },
  { label: 'Hubur Station (Hubur)', query: 'Hubur Station', kind: 'station', naturalId: 'HUB' },
  { label: 'Moria Station (Moria)', query: 'Moria Station', kind: 'station', naturalId: 'MOR' },
];

function planetLine(
  address: PrunApi.Address | null | undefined
): { naturalId: string; name: string } | undefined {
  const line = address?.lines.find((l) => l.type === 'PLANET') as
    | { entity?: { naturalId: string; name: string } }
    | undefined;
  return line?.entity;
}

function stationLine(address: PrunApi.Address | null | undefined): { naturalId: string } | undefined {
  const line = address?.lines.find((l) => l.type === 'STATION') as
    | { entity?: { naturalId: string } }
    | undefined;
  return line?.entity;
}

/**
 * Own bases + the CX stations, minus wherever the ship currently is.
 * Bases first, A–Z within each group.
 */
export function listOwnDestinations(
  ship: PrunApi.Ship,
  sites: PrunApi.Site[]
): SendDestination[] {
  const herePlanet = planetLine(ship.address)?.naturalId;
  const hereStation = stationLine(ship.address)?.naturalId;

  const bases: SendDestination[] = [];
  for (const site of sites) {
    const planet = planetLine(site.address);
    if (!planet || planet.naturalId === herePlanet) continue;
    bases.push({
      label: `${planet.name} (${planet.naturalId})`,
      query: planet.name,
      kind: 'base',
      naturalId: planet.naturalId,
    });
  }
  bases.sort((a, b) => a.label.localeCompare(b.label));

  const stations = CX_STATIONS.filter((s) => s.naturalId !== hereStation);
  return [...bases, ...stations];
}
