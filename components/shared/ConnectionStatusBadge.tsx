import { useDataStatus, type DataTone } from '../../hooks/useDataStatus';
import { useTick } from '../../hooks/useTick';
import { formatRelativeTime } from '../../lib/format-time';

const toneConfig: Record<DataTone, { color: string; pulse: boolean; description: string }> = {
  live: { color: 'bg-status-ok', pulse: false, description: 'Live data from the game connection' },
  fio: { color: 'bg-status-warning', pulse: false, description: 'FIO snapshot — no live game connection' },
  cached: { color: 'bg-apxm-muted', pulse: false, description: 'Cached data from a previous session' },
  connecting: { color: 'bg-status-critical', pulse: true, description: 'Waiting for game data' },
};

/**
 * Header indicator combining connection state and data freshness: a coloured
 * dot + source word (Live / FIO / Cached / Connecting) + the age of the
 * stalest on-screen data. Age is shown only once it reaches a minute — fresh
 * data reads as just the source word.
 */
export function ConnectionStatusBadge() {
  useTick(60000); // advance the age label even while no new data arrives
  const { tone, label, since } = useDataStatus();
  const { color, pulse, description } = toneConfig[tone];

  const age = since !== null ? formatRelativeTime(since) : null;
  const showAge = age !== null && age !== '<1m';

  const title = showAge ? `${description} · last update ${age} ago` : description;

  return (
    <div className="flex items-center gap-1.5" title={title}>
      <span
        className={`h-2 w-2 ${color} ${pulse ? 'animate-pulse' : ''}`}
        aria-label={label}
      />
      <span className="text-xs text-apxm-muted">
        {label}
        {showAge && ` · ${age}`}
      </span>
    </div>
  );
}
