import type { PrunApi } from '../types/prun-api';
import { getEntityDisplayName } from './address';
import { segmentStatus, STATIONARY, type ShipDisplayStatus } from './ship-status';

/**
 * A ship's current flight phase, mirroring PrUn's FLT "Status" column: the live
 * flight-segment phase while flying, STATIONARY when parked or already arrived.
 * `stationary` drives idle filtering/sorting; `phase` is what we display.
 * Shared by the fleet list, the ship detail sheet, and the status mini-list so
 * the three surfaces can't drift.
 */
export function shipPhase(flight: PrunApi.Flight | undefined): {
  phase: ShipDisplayStatus;
  stationary: boolean;
} {
  if (!flight) return { phase: STATIONARY, stationary: true };

  // Arrival already passed — the ship is parked at its destination.
  if (flight.arrival.timestamp - Date.now() <= 0) {
    return { phase: STATIONARY, stationary: true };
  }

  const segment = flight.segments[flight.currentSegmentIndex];
  return { phase: segment ? segmentStatus(segment.type) : STATIONARY, stationary: false };
}

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

  return `${duration} (${arrivalClock(etaMs)})`;
}

/**
 * Local wall-clock arrival label for a flight ending etaMs from now:
 * "01:11", or "Fri 14:30" when the arrival is a day or more away.
 * The bracketed half of formatEta, shared so the send-ship review's
 * Duration row shows the same arrival clock as the fleet list.
 */
export function arrivalClock(etaMs: number): string {
  const arrivalTime = new Date(Date.now() + etaMs);
  const timeStr = arrivalTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (etaMs >= 24 * 60 * 60 * 1000) {
    const dayName = arrivalTime.toLocaleDateString('en-GB', { weekday: 'short' });
    return `${dayName} ${timeStr}`;
  }

  return timeStr;
}

/**
 * Parses an APEX duration string ("2h 54m 25s", "1d 3h 10m") to milliseconds.
 * Returns null when no duration tokens are found — callers should omit the
 * arrival clock rather than show one derived from a misread.
 */
export function parseApexDuration(text: string): number | null {
  const unitMs: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };
  let total = 0;
  let matched = false;
  for (const [, count, unit] of text.matchAll(/(\d+)\s*([dhms])\b/g)) {
    total += Number(count) * unitMs[unit];
    matched = true;
  }
  return matched ? total : null;
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
