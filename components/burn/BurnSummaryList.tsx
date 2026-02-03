import { useSiteBurns, sortByUrgency } from './useSiteBurns';
import { SiteBurnCard } from './SiteBurnCard';
import { DataSourceBadge } from './DataSourceBadge';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useSettingsStore } from '../../stores/settings';

interface BurnSummaryListProps {
  /** Expand first card by default */
  expandFirst?: boolean;
}

/**
 * Full burn summary list showing all sites sorted by urgency.
 */
export function BurnSummaryList({ expandFirst = true }: BurnSummaryListProps) {
  const summaries = useSiteBurns();
  const sorted = sortByUrgency(summaries);

  // Get data source info for badge
  const dataSource = useWorkforceStore((s) => s.dataSource);
  const wsLastUpdated = useWorkforceStore((s) => s.lastUpdated);
  const fioLastFetch = useSettingsStore((s) => s.fio.lastFetch);

  // Use FIO timestamp when source is FIO, otherwise use WS timestamp
  const lastUpdated = dataSource === 'fio' ? fioLastFetch : wsLastUpdated;

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Burns</span>
          <DataSourceBadge source={dataSource} lastUpdated={lastUpdated} />
        </div>
        <div className="text-center py-4 text-apxm-text/50 text-sm">
          No sites loaded yet
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Burns</span>
        <DataSourceBadge source={dataSource} lastUpdated={lastUpdated} />
      </div>
      {sorted.map((summary, index) => (
        <SiteBurnCard
          key={summary.siteId}
          summary={summary}
          defaultExpanded={expandFirst && index === 0}
        />
      ))}
    </div>
  );
}

/**
 * Compact summary showing just the most critical items across all sites.
 */
export function BurnSummaryCompact() {
  const summaries = useSiteBurns();
  const sorted = sortByUrgency(summaries);

  // Collect all critical/warning items
  const urgentItems = sorted
    .flatMap((s) =>
      s.burns
        .filter((b) => b.urgency === 'critical' || b.urgency === 'warning')
        .map((b) => ({ ...b, siteName: s.siteName }))
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5);

  if (urgentItems.length === 0) {
    return (
      <div className="text-xs text-green-500">
        All supplies OK
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {urgentItems.map((item) => (
        <span
          key={`${item.siteName}-${item.materialTicker}`}
          className={`text-xs px-1.5 py-0.5 rounded ${
            item.urgency === 'critical'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}
          title={`${item.siteName}: ${item.daysRemaining.toFixed(1)} days`}
        >
          {item.materialTicker} {item.daysRemaining.toFixed(1)}d
        </span>
      ))}
    </div>
  );
}
