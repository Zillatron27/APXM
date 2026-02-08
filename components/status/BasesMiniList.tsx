import { useMemo } from 'react';
import { useSiteBurns, sortByUrgency } from '../burn';
import { Card, SectionHeader, TimeBadge } from '../shared';
import { useGameState } from '../../stores/gameState';
import { useSitesStore } from '../../stores/entities/sites';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useProductionStore } from '../../stores/entities/production';
import { useStorageStore } from '../../stores/entities/storage';

export function BasesMiniList() {
  const { setActiveTab } = useGameState();
  const siteBurns = useSiteBurns();

  const sitesFetched = useSitesStore((s) => s.fetched);
  const workforceFetched = useWorkforceStore((s) => s.fetched);
  const productionFetched = useProductionStore((s) => s.fetched);
  const storageFetched = useStorageStore((s) => s.fetched);

  const topBases = useMemo(() => {
    const sorted = sortByUrgency(siteBurns);
    return sorted.slice(0, 5);
  }, [siteBurns]);

  // Determine loading state for empty-state message
  const emptyMessage = !sitesFetched
    ? { text: 'Loading bases...', pulse: true }
    : !(workforceFetched && productionFetched && storageFetched)
      ? { text: 'Loading burn data...', pulse: true }
      : { text: 'No base data available', pulse: false };

  if (topBases.length === 0) {
    return (
      <Card>
        <SectionHeader title="Bases" onViewAll={() => setActiveTab('bases')} />
        <p className={`text-xs text-apxm-muted ${emptyMessage.pulse ? 'animate-pulse' : ''}`}>
          {emptyMessage.text}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Bases" onViewAll={() => setActiveTab('bases')} />
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
