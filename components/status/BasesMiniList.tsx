import { useMemo } from 'react';
import { useSiteBurns, sortByUrgency, DataSourceBadge } from '../burn';
import { Card, SectionHeader, TimeBadge } from '../shared';
import { useGameState } from '../../stores/gameState';
import { useConnectionStore } from '../../stores/connection';
import { useSettingsStore } from '../../stores/settings';
import {
  useSiteSourceStore,
  deriveWeakestSource,
  deriveOldestUpdate,
} from '../../stores/site-data-sources';
import { useSitesStore } from '../../stores/entities/sites';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useProductionStore } from '../../stores/entities/production';
import { useStorageStore } from '../../stores/entities/storage';

export function BasesMiniList() {
  const { setActiveTab } = useGameState();
  const siteBurns = useSiteBurns();

  const apexUnresponsive = useConnectionStore((s) => s.apexUnresponsive);
  const sitesFetched = useSitesStore((s) => s.fetched);
  const workforceFetched = useWorkforceStore((s) => s.fetched);
  const productionFetched = useProductionStore((s) => s.fetched);
  const storageFetched = useStorageStore((s) => s.fetched);

  // Staleness signal for the displayed burn figures: weakest-link source and
  // oldest update across sites. Without this the mini-list shows burn days with
  // no indication of how fresh they are — acting on stale burn data is harmful.
  const siteEntries = useSiteSourceStore((s) => s.entries);
  const fioLastFetch = useSettingsStore((s) => s.fio.lastFetch);
  const source = deriveWeakestSource(siteEntries);
  const oldestUpdate = deriveOldestUpdate(siteEntries);
  const lastUpdated = source === 'fio' ? fioLastFetch : oldestUpdate;

  const topBases = useMemo(() => {
    const sorted = sortByUrgency(siteBurns);
    return sorted.slice(0, 5);
  }, [siteBurns]);

  // Determine loading state for empty-state message
  const emptyMessage = apexUnresponsive && !sitesFetched
    ? { text: 'APEX not responding', pulse: false }
    : !sitesFetched
      ? { text: 'Loading bases...', pulse: true }
      : !(workforceFetched && productionFetched && storageFetched)
        ? { text: 'Loading burn data...', pulse: true }
        : { text: 'No base data available', pulse: false };

  if (topBases.length === 0) {
    return (
      <Card>
        <SectionHeader title="Bases" onViewAll={() => setActiveTab('bases')} />
        <p className={`text-xs ${apexUnresponsive && !sitesFetched ? 'text-status-critical' : 'text-apxm-muted'} ${emptyMessage.pulse ? 'animate-pulse' : ''}`}>
          {emptyMessage.text}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader
        title="Bases"
        onViewAll={() => setActiveTab('bases')}
        accessory={<DataSourceBadge source={source} lastUpdated={lastUpdated} />}
      />
      <div className="space-y-0">
        {topBases.map((site) => (
          <div key={site.siteId} className="flex items-center justify-between py-1">
            <span className="text-sm text-apxm-text truncate flex-1 mr-2">{site.siteName}</span>
            {site.mostUrgent ? (
              <TimeBadge
                daysRemaining={site.mostUrgent.daysRemaining}
                urgency={site.mostUrgent.urgency}
              />
            ) : (
              <span className="text-xs text-apxm-muted">OK</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
