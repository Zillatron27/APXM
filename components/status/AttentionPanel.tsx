import { useMemo } from 'react';
import { Panel, btnPress } from '../shared';
import { useSiteBurns, useProdStatuses } from '../burn';
import { useShipsStore } from '../../stores/entities/ships';
import { getFlightByShipId } from '../../stores/entities/flights';
import { shipPhase } from '../../lib/fleet-utils';
import { useGameState, type TabId } from '../../stores/gameState';

type Tier = 'critical' | 'warning' | 'transit' | 'idle';

const tierClasses: Record<Tier, string> = {
  critical: 'bg-status-critical/10 border-status-critical/40 text-status-critical',
  warning: 'bg-status-warning/10 border-status-warning/40 text-status-warning',
  transit: 'bg-status-surplus/10 border-status-surplus/40 text-status-surplus',
  idle: 'bg-apxm-bg border-apxm-accent text-apxm-muted',
};

interface AttentionTileProps {
  count: number;
  label: string;
  /** Tier when count > 0; a zero count always renders idle/muted. */
  tier: Exclude<Tier, 'idle'>;
  onClick: () => void;
}

function AttentionTile({ count, label, tier, onClick }: AttentionTileProps) {
  const resolved: Tier = count > 0 ? tier : 'idle';
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col gap-1 px-2.5 py-2 border ${tierClasses[resolved]} ${btnPress}`}
    >
      <span className="font-mono text-lg font-semibold leading-none">{count}</span>
      <span className="font-mono text-[10px] tracking-wide leading-none">{label}</span>
    </button>
  );
}

/**
 * Pinned at-a-glance attention bar (style guide's attention box). Summarises the
 * loud signals across the empire as tier-tinted, tappable counts:
 *   BURN — bases out of supply imminently (critical burn)
 *   PROD — bases with stopped or partial production (idle CapEx / halted output)
 *   IN TRANSIT — ships currently in flight
 * Each tile drills to the relevant tab. Counts duplicate the detail panels below
 * by design — this is the glance, those are the detail.
 */
export function AttentionPanel() {
  const { setActiveTab } = useGameState();
  const siteBurns = useSiteBurns();
  const prodStatuses = useProdStatuses();
  const shipsLastUpdated = useShipsStore((s) => s.lastUpdated);

  const burnCount = useMemo(
    () => siteBurns.filter((s) => s.mostUrgent?.urgency === 'critical').length,
    [siteBurns]
  );

  // Stopped output is the alarm (red); partial is wasted capacity (yellow).
  const prod = useMemo(() => {
    let stopped = 0;
    let partial = 0;
    for (const status of prodStatuses.values()) {
      if (status?.tier === 'stopped') stopped++;
      else if (status?.tier === 'partial') partial++;
    }
    return { count: stopped + partial, tier: stopped > 0 ? 'critical' : 'warning' } as const;
  }, [prodStatuses]);

  const transitCount = useMemo(() => {
    return useShipsStore
      .getState()
      .getAll()
      .filter((ship) => !shipPhase(getFlightByShipId(ship.id)).stationary).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipsLastUpdated]);

  const go = (tab: TabId) => () => setActiveTab(tab);

  return (
    <Panel title="Status" code="OVERVIEW">
      <div className="flex gap-2">
        <AttentionTile count={burnCount} label="BURN" tier="critical" onClick={go('bases')} />
        <AttentionTile count={prod.count} label="PROD" tier={prod.tier} onClick={go('bases')} />
        <AttentionTile count={transitCount} label="IN TRANSIT" tier="transit" onClick={go('fleet')} />
      </div>
    </Panel>
  );
}
