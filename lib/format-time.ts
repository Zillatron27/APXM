/**
 * Formats a timestamp as relative time (e.g., "5m", "2h", "1d").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Formats a forward-looking duration (milliseconds until something finishes)
 * as a compact two-unit countdown, e.g. "23h 43m", "1d 11h", "5m". Mirrors the
 * APEX production buffer's "in 23h 43m" ETA style. Non-positive input reads
 * "done" — the order has reached or passed its completion time.
 */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return 'done';

  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
