import { useMemo } from 'react';
import { useSiteBurns, sortByUrgency } from '../burn';
import { Card, SectionHeader, TimeBadge } from '../shared';
import { useGameState } from '../../stores/gameState';

export function BasesMiniList() {
  const { setActiveTab } = useGameState();
  const siteBurns = useSiteBurns();

  const topBases = useMemo(() => {
    const sorted = sortByUrgency(siteBurns);
    return sorted.slice(0, 5);
  }, [siteBurns]);

  if (topBases.length === 0) {
    return (
      <Card>
        <SectionHeader title="Bases" onViewAll={() => setActiveTab('bases')} />
        <p className="text-xs text-apxm-muted">No base data available</p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Bases" onViewAll={() => setActiveTab('bases')} />
      <div className="space-y-2">
        {topBases.map((site) => (
          <div key={site.siteId} className="flex items-center justify-between min-h-touch">
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
