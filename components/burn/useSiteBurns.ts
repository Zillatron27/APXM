import { useMemo } from 'react';
import { useSitesStore } from '../../stores/entities/sites';
import { useProductionStore } from '../../stores/entities/production';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useStorageStore } from '../../stores/entities/storage';
import { calculateAllBurns, type SiteBurnSummary } from '../../core/burn';

/**
 * Hook that calculates burn summaries for all sites.
 * Re-calculates when any relevant store data changes.
 */
export function useSiteBurns(): SiteBurnSummary[] {
  // Subscribe to store updates to trigger recalculation
  const sitesLastUpdated = useSitesStore((s) => s.lastUpdated);
  const productionLastUpdated = useProductionStore((s) => s.lastUpdated);
  const workforceLastUpdated = useWorkforceStore((s) => s.lastUpdated);
  const storageLastUpdated = useStorageStore((s) => s.lastUpdated);

  return useMemo(() => {
    return calculateAllBurns();
  }, [sitesLastUpdated, productionLastUpdated, workforceLastUpdated, storageLastUpdated]);
}

/**
 * Sorts burn summaries by urgency (most urgent first).
 */
export function sortByUrgency(summaries: SiteBurnSummary[]): SiteBurnSummary[] {
  return [...summaries].sort((a, b) => {
    const aDays = a.mostUrgent?.daysRemaining ?? Infinity;
    const bDays = b.mostUrgent?.daysRemaining ?? Infinity;
    return aDays - bDays;
  });
}
