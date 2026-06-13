import type { BurnRate } from '../../core/burn';
import { BurnRow } from './BurnRow';
import { SectionHeader } from '../shared';

interface EmpireBurnListProps {
  rows: BurnRate[];
}

/**
 * Empire-wide material list: one row per material, aggregated across all
 * sites. Data freshness is shown by the global header indicator (the
 * aggregate is only as fresh as the stalest site feeding it).
 */
export function EmpireBurnList({ rows }: EmpireBurnListProps) {
  return (
    <div className="bg-apxm-surface p-3">
      <SectionHeader title="Empire" />
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
