import { useRepairStatus } from './useRepairStatus';

interface RepairDetailViewProps {
  siteId: string;
}

function formatDays(days: number): string {
  return days < 1 ? '<1d' : `${Math.floor(days)}d`;
}

/**
 * Placeholder repair detail. For now it surfaces only the figure already on the
 * base card (the oldest production building's age since last repair) — the full
 * per-building breakdown and the "open BRA buffer" action are still to be
 * designed. Kept deliberately thin so it ships honestly rather than half-built.
 */
export function RepairDetailView({ siteId }: RepairDetailViewProps) {
  const status = useRepairStatus().find((r) => r.siteId === siteId);
  const ageDays = status?.oldestBuildingAgeDays ?? null;

  return (
    <div className="space-y-3">
      <div className="bg-apxm-surface p-4 text-center">
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40">
          Oldest building since last repair
        </p>
        <p className="mt-1 text-2xl font-semibold text-apxm-text">
          {ageDays === null ? '—' : formatDays(ageDays)}
        </p>
      </div>
      <p className="text-xs text-apxm-muted">
        Full per-building repair view is still to be designed — for now this mirrors the
        figure on the base card.
      </p>
    </div>
  );
}
