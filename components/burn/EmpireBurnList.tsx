import type { BurnRate } from '../../core/burn';
import { BurnRow } from './BurnRow';
import { DataSourceBadge } from './DataSourceBadge';
import { SectionHeader } from '../shared';
import { useSettingsStore } from '../../stores/settings';
import {
  useSiteSourceStore,
  deriveWeakestSource,
  deriveOldestUpdate,
} from '../../stores/site-data-sources';

interface EmpireBurnListProps {
  rows: BurnRate[];
}

/**
 * Empire-wide material list: one row per material, aggregated across all
 * sites. The header carries a weakest-link staleness badge — the aggregate
 * is only as fresh as the stalest site feeding it.
 */
export function EmpireBurnList({ rows }: EmpireBurnListProps) {
  const siteEntries = useSiteSourceStore((s) => s.entries);
  const fioLastFetch = useSettingsStore((s) => s.fio.lastFetch);
  const source = deriveWeakestSource(siteEntries);
  const oldestUpdate = deriveOldestUpdate(siteEntries);
  const lastUpdated = source === 'fio' ? fioLastFetch : oldestUpdate;

  return (
    <div className="bg-apxm-surface p-3">
      <SectionHeader
        title="Empire"
        accessory={<DataSourceBadge source={source} lastUpdated={lastUpdated} />}
      />
      {rows.length === 0 ? (
        <p className="text-sm text-apxm-muted py-4 text-center">
          No materials match the selected filter
        </p>
      ) : (
        <div className="divide-y divide-apxm-bg/50">
          {/* Column headers — same layout as the per-site card rows */}
          <div className="flex items-center justify-between gap-1 py-1 text-[10px] text-apxm-text/40 uppercase tracking-wide">
            <span className="w-10">Mat</span>
            <div className="flex items-center">
              <span className="w-12 text-right">Inv</span>
              <span className="w-20 text-right">Rate</span>
              <span className="w-14 text-right">Days</span>
              <span className="w-12 text-right">Need</span>
            </div>
          </div>
          {rows.map((row) => (
            <BurnRow key={row.materialTicker} burn={row} />
          ))}
        </div>
      )}
    </div>
  );
}
