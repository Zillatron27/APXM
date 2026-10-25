import type { ReactNode } from 'react';
import { useShipsStore } from '../../stores/entities/ships';
import { Panel } from '../shared';
import { useGameState, type FleetFilter } from '../../stores/gameState';
import { useConnectionStore } from '../../stores/connection';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { formatEta } from '../../lib/fleet-utils';
import { useFleetDetails } from '../views/hooks/useFleetDetails';

// Module-level so useFleetDetails' memo (keyed on this Set) isn't rebuilt every render.
const ALL_SHIPS: ReadonlySet<FleetFilter> = new Set<FleetFilter>(['all']);

export function FleetMiniList({ handle }: { handle?: ReactNode }) {
  const { setActiveTab } = useGameState();
  const apexUnresponsive = useConnectionStore((s) => s.apexUnresponsive);
  const shipsFetched = useShipsStore((s) => s.fetched);
  const connectionStatus = useConnectionStatus();
  const topShips = useFleetDetails(ALL_SHIPS).ships.slice(0, 5);

  // Determine loading state for empty-state message
  const emptyMessage = !shipsFetched
    ? apexUnresponsive
      ? { text: 'APEX not responding', pulse: false }
      : connectionStatus === 'fio'
        ? { text: 'Waiting for APEX connection...', pulse: false }
        : { text: 'Loading fleet...', pulse: true }
    : { text: 'No ship data available', pulse: false };

  if (topShips.length === 0) {
    return (
      <Panel title="Fleet" code="FLT" onViewAll={() => setActiveTab('fleet')} handle={handle}>
        <p className={`text-xs ${apexUnresponsive && !shipsFetched ? 'text-status-critical' : 'text-apxm-muted'} ${emptyMessage.pulse ? 'animate-pulse' : ''}`}>
          {emptyMessage.text}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Fleet" code="FLT" onViewAll={() => setActiveTab('fleet')} handle={handle}>
      <div className="space-y-0">
        {topShips.map((ship) => (
          <div key={ship.id} className="flex items-center justify-between py-1">
            <div className="flex-1 min-w-0 mr-2">
              <div className="text-sm text-apxm-text truncate">{ship.name}</div>
              <div className="text-xs text-apxm-muted truncate">
                {ship.stationary ? ship.location : `${ship.location} → ${ship.destination}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-apxm-text/70">
                <span aria-hidden className="text-apxm-text">{ship.phase.icon}</span>
                {ship.phase.label}
              </span>
              {ship.etaMs !== null && (
                <span className="text-xs text-apxm-text/70 font-mono">
                  {formatEta(ship.etaMs)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
