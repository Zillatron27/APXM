import type { PrunApi } from '../types/prun-api';

/**
 * Derives a display name from an address.
 * For unnamed planets in named systems, replaces the system naturalId prefix
 * with the system name (e.g. "LS-014b" in system "Metis" → "Metis b").
 */
export function getEntityDisplayName(address: PrunApi.Address): string {
  const planet = address.lines.find(
    (l): l is PrunApi.PlanetAddressLine => l.type === 'PLANET' && !!l.entity
  );

  if (planet) {
    const { name, naturalId } = planet.entity;

    // Named planet — name differs from naturalId
    if (name && name !== naturalId) return name;

    // Unnamed planet — check if system is named
    const system = address.lines.find(
      (l): l is PrunApi.SystemAddressLine => l.type === 'SYSTEM' && !!l.entity
    );

    if (system && system.entity.name && system.entity.name !== system.entity.naturalId) {
      return naturalId.replace(system.entity.naturalId, system.entity.name + ' ');
    }

    return name || naturalId;
  }

  // Station fallback (CX / orbital)
  const station = address.lines.find(
    (l): l is PrunApi.StationAddressLine => l.type === 'STATION' && !!l.entity
  );
  if (station) return station.entity.name || station.entity.naturalId;

  return 'Unknown';
}

export function extractPlanetNaturalId(address: PrunApi.Address): string | null {
  for (const line of address.lines) {
    if (line.type === 'PLANET' && line.entity) return line.entity.naturalId;
  }
  return null;
}

export function extractSystemNaturalId(address: PrunApi.Address): string | null {
  for (const line of address.lines) {
    if (line.type === 'SYSTEM' && line.entity) return line.entity.naturalId;
  }
  return null;
}
