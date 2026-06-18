import { useMemo, useState, type ReactNode } from 'react';
import { Panel } from '../shared';
import { EmpireBurnList } from '../burn/EmpireBurnList';
import { useEmpireBurn, type BurnFilter } from '../views/hooks';
import { MATERIAL_CATEGORIES } from '../../lib/material-categories';
import type { BurnRate } from '../../core/burn';

// The Status-tab rollup shows the whole empire, unfiltered.
const ALL_FILTER: ReadonlySet<BurnFilter> = new Set(['all']);

type SortMode = 'type' | 'status' | 'az' | 'za';

const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'type', label: 'Type' },
  { id: 'status', label: 'Status' },
  { id: 'az', label: 'A–Z' },
  { id: 'za', label: 'Z–A' },
];

/**
 * Re-sorts the (already active-filtered) empire rows. 'status' keeps the hook's
 * order (consuming-first by days remaining); 'type' groups by material category
 * then ticker; A–Z / Z–A are by ticker. Unknown-category tickers sort last.
 */
function sortRows(rows: BurnRate[], mode: SortMode): BurnRate[] {
  switch (mode) {
    case 'status':
      return rows;
    case 'az':
      return [...rows].sort((a, b) => a.materialTicker.localeCompare(b.materialTicker));
    case 'za':
      return [...rows].sort((a, b) => b.materialTicker.localeCompare(a.materialTicker));
    case 'type':
      return [...rows].sort((a, b) => {
        const ca = MATERIAL_CATEGORIES[a.materialTicker] ?? '~';
        const cb = MATERIAL_CATEGORIES[b.materialTicker] ?? '~';
        return ca.localeCompare(cb) || a.materialTicker.localeCompare(b.materialTicker);
      });
  }
}

/**
 * Empire-wide burn rollup as a collapsible Status-tab panel. Defaults to
 * collapsed (session-scoped) — a drill-when-needed overview, not a primary
 * glance — and is drag-reorderable like the other Status panels. A sort row
 * switches between by-type (default), by-status, and ticker A–Z / Z–A.
 * Migrated here from the BASE tab's SITES/EMPIRE toggle.
 */
export function EmpireBurnPanel({ handle }: { handle?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('type');
  const empire = useEmpireBurn(ALL_FILTER);
  const rows = useMemo(() => sortRows(empire.rows, sortMode), [empire.rows, sortMode]);

  return (
    <Panel
      title="Empire"
      code="Burn"
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      summary={`${empire.rows.length} mats`}
      handle={handle}
    >
      {empire.rows.length > 0 && (
        <div className="flex gap-3 mb-2 font-mono text-[10px] uppercase tracking-wide">
          {SORT_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setSortMode(m.id)}
              className={`pb-0.5 ${
                sortMode === m.id
                  ? 'text-prun-yellow border-b border-prun-yellow'
                  : 'text-apxm-text/60 hover:text-apxm-text'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <EmpireBurnList rows={rows} />
    </Panel>
  );
}
