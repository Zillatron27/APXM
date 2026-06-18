import { useState, type ReactNode } from 'react';
import { Panel } from '../shared';
import { EmpireBurnList } from '../burn/EmpireBurnList';
import { useEmpireBurn, type BurnFilter } from '../views/hooks';

// The Status-tab rollup shows the whole empire, unfiltered.
const ALL_FILTER: ReadonlySet<BurnFilter> = new Set(['all']);

/**
 * Empire-wide burn rollup as a collapsible Status-tab panel. Defaults to
 * collapsed (session-scoped) — it's a drill-when-needed overview, not a primary
 * glance — and is drag-reorderable like the other Status panels. Migrated here
 * from the BASE tab's SITES/EMPIRE toggle.
 */
export function EmpireBurnPanel({ handle }: { handle?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const empire = useEmpireBurn(ALL_FILTER);

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
      <EmpireBurnList rows={empire.rows} />
    </Panel>
  );
}
