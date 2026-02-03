import type { DataSource } from '../../stores/create-entity-store';

interface DataSourceBadgeProps {
  source: DataSource;
  lastUpdated: number | null;
}

/**
 * Formats a timestamp as relative time (e.g., "5m", "2h", "1d").
 */
function formatRelativeTime(timestamp: number): string {
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
 * Small badge showing data source (WS/FIO) with age indicator.
 *
 * - WS (green): Real-time WebSocket data
 * - FIO (blue): Snapshot data from FIO REST API
 */
export function DataSourceBadge({ source, lastUpdated }: DataSourceBadgeProps) {
  if (!source) {
    return null;
  }

  const isWebSocket = source === 'websocket';
  const label = isWebSocket ? 'WS' : 'FIO';
  const age = lastUpdated ? formatRelativeTime(lastUpdated) : '';

  const colorClass = isWebSocket
    ? 'bg-green-600/20 text-green-400'
    : 'bg-blue-600/20 text-blue-400';

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-mono ${colorClass}`}
      title={
        isWebSocket
          ? `Live WebSocket data${lastUpdated ? `, updated ${age} ago` : ''}`
          : `FIO snapshot data${lastUpdated ? `, fetched ${age} ago` : ''}`
      }
    >
      {label}
      {age && ` ${age}`}
    </span>
  );
}
