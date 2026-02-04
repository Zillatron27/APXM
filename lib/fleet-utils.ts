import type { PrunApi } from '../types/prun-api';

/**
 * Extracts a human-readable destination name from an address.
 * Prefers planet name, falls back to station, then unknown.
 */
export function getDestinationName(address: PrunApi.Address): string {
  for (const line of address.lines) {
    if (line.type === 'PLANET' && line.entity) {
      return line.entity.name || line.entity.naturalId;
    }
    if (line.type === 'STATION' && line.entity) {
      return line.entity.name || line.entity.naturalId;
    }
  }
  return 'Unknown';
}

/**
 * Formats milliseconds ETA to human-readable string.
 * <1h, Xh, or Xd format.
 */
export function formatEta(etaMs: number): string {
  if (etaMs <= 0) return 'Arrived';
  const hours = Math.floor(etaMs / (1000 * 60 * 60));
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0 && days < 7) {
    return `${days}d ${remainingHours}h`;
  }
  return `${days}d`;
}

/**
 * Gets current location name for a ship.
 * Uses ship.address if present.
 */
export function getCurrentLocation(ship: PrunApi.Ship): string {
  if (!ship.address) return 'In Transit';
  return getDestinationName(ship.address);
}

/**
 * Formats a ship's condition as percentage.
 */
export function formatCondition(condition: number): string {
  return `${Math.round(condition * 100)}%`;
}
