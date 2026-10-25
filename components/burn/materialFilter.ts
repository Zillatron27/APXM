import type { BurnRate, Urgency } from '../../core/burn';

export type MaterialFilter = Urgency | 'all';

/** Labels follow BasesView's RED/YELLOW/GREEN; INF is rPrun's BURN label for surplus. */
export const materialFilterLabels: Record<MaterialFilter, string> = {
  critical: 'RED',
  warning: 'YELLOW',
  ok: 'GREEN',
  surplus: 'INF',
  all: 'ALL',
};

export const materialFilterOrder: MaterialFilter[] = ['critical', 'warning', 'ok', 'surplus', 'all'];

export function countMaterialsByFilter(burns: BurnRate[]): Record<MaterialFilter, number> {
  const counts: Record<MaterialFilter, number> = {
    critical: 0,
    warning: 0,
    ok: 0,
    surplus: 0,
    all: burns.length,
  };
  for (const burn of burns) counts[burn.urgency]++;
  return counts;
}

/** Multi-select is a union of the chosen urgencies; ALL shows everything. */
export function filterMaterials(
  burns: BurnRate[],
  active: ReadonlySet<MaterialFilter>
): BurnRate[] {
  if (active.has('all')) return burns;
  return burns.filter((burn) => active.has(burn.urgency));
}
