import { useMemo } from 'react';
import {
  useProductionStore,
  useProductionLoadedStore,
  getProductionBySiteId,
} from '../../stores/entities/production';
import { classifyProdStatus } from '../../core/prod';
import { useSiteStaleness } from '../../hooks/useSiteStaleness';
import { useTick } from '../../hooks/useTick';
import { ProductionLineSection } from './ProductionLineSection';

interface ProductionViewProps {
  siteId: string;
  siteName: string;
}

/**
 * Read-only production status for a single base: every production building and
 * its current orders. Mirrors the APEX PROD buffer, stacked vertically for a
 * phone. Idle/stopped buildings sort to the top — wasted capacity is exactly
 * what this screen exists to surface. Live ETAs and progress tick on a shared
 * 30s interval (a multi-hour order's progress doesn't need finer resolution).
 */
export function ProductionView({ siteId, siteName }: ProductionViewProps) {
  // A tick drives the shared `now`, keeping ETAs and progress bars current.
  useTick(30_000);
  const nowMs = Date.now();

  // Recompute when production data changes (mirrors useProdStatuses).
  const lastUpdated = useProductionStore((s) => s.lastUpdated);
  const loaded = useProductionLoadedStore((s) => s.loadedSiteIds.has(siteId));

  const lines = useMemo(() => {
    const all = getProductionBySiteId(siteId);
    // Most-idle building first (active/capacity ascending); empty lines (no
    // buildings) sink to the bottom so they never top a base with real idle.
    return [...all].sort((a, b) => {
      const ratio = (l: typeof a) => {
        const { active, capacity } = classifyProdStatus([l]);
        return capacity === 0 ? Infinity : active / capacity;
      };
      return ratio(a) - ratio(b);
    });
    // lastUpdated is the recompute trigger; data is read from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, lastUpdated]);

  const { text: stalenessText, colorClass: stalenessColor } = useSiteStaleness(siteId);

  if (lines.length === 0) {
    // A site with no lines is ambiguous: data not yet received, or genuinely
    // no production buildings. The load marker disambiguates so we never imply
    // "no production" when we simply haven't heard.
    return (
      <p className="px-1 py-4 text-sm text-apxm-muted">
        {loaded
          ? 'No production buildings at this base.'
          : 'Production data not loaded yet — open this base in APEX or refresh it from the Bases tab.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className={`text-[11px] ${stalenessColor}`}>{stalenessText}</p>
      {lines.map((line) => (
        <ProductionLineSection key={line.id} line={line} nowMs={nowMs} />
      ))}
    </div>
  );
}
