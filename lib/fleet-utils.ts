import type { PrunApi } from '../types/prun-api';
import { getEntityDisplayName } from './address';

/**
 * Extracts a human-readable destination name from an address.
 * Derives display names for unnamed planets in named systems.
 */
export function getDestinationName(address: PrunApi.Address): string {
  return getEntityDisplayName(address);
}

/**
 * Formats milliseconds ETA to human-readable string with local arrival time.
 * Shows duration remaining + local arrival time in parentheses.
 * Examples: "2h 20m (01:11)", "45m (22:56)", "2d 5h (Fri 14:30)"
 */
export function formatEta(etaMs: number): string {
  if (etaMs <= 0) return 'Arrived';

  const totalMinutes = Math.floor(etaMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);

  const minutes = totalMinutes % 60;
  const hours = totalHours % 24;

  // Format duration (minutes granularity)
  let duration: string;
  if (totalHours >= 24) {
    // Days + hours
    duration = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  } else if (totalHours >= 1) {
    // Hours + minutes
    duration = minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  } else {
    // Just minutes
    duration = totalMinutes < 1 ? '<1m' : `${totalMinutes}m`;
  }

  // Calculate local arrival time
  const arrivalTime = new Date(Date.now() + etaMs);
  const timeStr = arrivalTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // For arrivals > 24h away, include day name
  if (days >= 1) {
    const dayName = arrivalTime.toLocaleDateString('en-GB', { weekday: 'short' });
    return `${duration} (${dayName} ${timeStr})`;
  }

  return `${duration} (${timeStr})`;
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
