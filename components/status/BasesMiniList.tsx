import { useMemo } from 'react';
import {
  useSiteBurns,
  sortByUrgency,
  DataSourceBadge,
  useRepairStatus,
  useProdStatuses,
  RepairAgeBadge,
  ProdStatusBadge,
} from '../burn';
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
  const repairStatuses = useRepairStatus();
  const prodStatuses = useProdStatuses();

  const repairBySite = useMemo(
    () => new Map(repairStatuses.map((r) => [r.siteId, r])),
    [repairStatuses]
  );

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
    // Stopped production bubbles above burn urgency — it's the loudest alarm
    const sorted = [...sortByUrgency(siteBurns)].sort((a, b) => {
      const aStopped = prodStatuses.get(a.siteId) === false;
      const bStopped = prodStatuses.get(b.siteId) === false;
      if (aStopped !== bStopped) return aStopped ? -1 : 1;
      return 0; // stable: keep burn-urgency order within each group
    });
    return sorted.slice(0, 5);
  }, [siteBurns, prodStatuses]);

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
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_2.5rem] gap-x-2 items-center">
        {/* Column headers */}
        <span />
        <span className="text-[10px] text-apxm-text/40 uppercase tracking-wide text-center">Burn</span>
        <span className="text-[10px] text-apxm-text/40 uppercase tracking-wide text-center">Repair</span>
        <span className="text-[10px] text-apxm-text/40 uppercase tracking-wide text-center">Prod</span>

        {topBases.map((site) => (
          <div key={site.siteId} className="contents">
            <span className="text-sm text-apxm-text truncate py-1">{site.siteName}</span>
            <span className="text-center">
              {site.mostUrgent ? (
                <TimeBadge
                  daysRemaining={site.mostUrgent.daysRemaining}
                  urgency={site.mostUrgent.urgency}
                />
              ) : (
                <span className="text-xs text-apxm-muted">OK</span>
              )}
            </span>
            <span className="text-center">
              <RepairAgeBadge ageDays={repairBySite.get(site.siteId)?.oldestBuildingAgeDays ?? null} />
            </span>
            <span className="text-center">
              <ProdStatusBadge status={prodStatuses.get(site.siteId) ?? null} />
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
