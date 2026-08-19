import type { DataSource } from '../../stores/create-entity-store';
import { formatRelativeTime } from '../../lib/format-time';

interface DataSourceBadgeProps {
  source: DataSource;
  lastUpdated: number | null;
}

/**
 * Small badge showing data source (WS/FIO) with age indicator.
 *
 * - WS (status-ok): real-time WebSocket data
 * - FIO (status-info): snapshot data from FIO REST API
 */
export function DataSourceBadge({ source, lastUpdated }: DataSourceBadgeProps) {
  if (!source) {
    return null;
  }

  const isWebSocket = source === 'websocket';
  const label = isWebSocket ? 'WS' : 'FIO';
  const age = lastUpdated ? formatRelativeTime(lastUpdated) : '';

  const colorClass = isWebSocket
    ? 'bg-status-ok/20 text-status-ok'
    : 'bg-status-info/20 text-status-info';

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
