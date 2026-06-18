import { useMemo } from 'react';
import { useShipsStore } from '../../stores/entities/ships';
import { getFlightByShipId } from '../../stores/entities/flights';
import { Panel } from '../shared';
import { useGameState } from '../../stores/gameState';
import { useConnectionStore } from '../../stores/connection';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { formatEta, getDestinationName, getCurrentLocation, shipPhase } from '../../lib/fleet-utils';
import type { ShipDisplayStatus } from '../../lib/ship-status';
import { useTick } from '../../lib/use-tick';

interface ShipSummary {
  id: string;
  name: string;
  phase: ShipDisplayStatus;
  stationary: boolean;
  location: string;
  destination: string | null;
  etaMs: number | null;
}

export function FleetMiniList() {
  const { setActiveTab } = useGameState();
  const apexUnresponsive = useConnectionStore((s) => s.apexUnresponsive);
  const shipsLastUpdated = useShipsStore((s) => s.lastUpdated);
  const shipsFetched = useShipsStore((s) => s.fetched);
  const connectionStatus = useConnectionStatus();
  // Tick every minute to update ETAs
  const tick = useTick(60000);

  const topShips = useMemo(() => {
    const ships = useShipsStore.getState().getAll();
    const now = Date.now();

    const summaries: ShipSummary[] = ships.map((ship) => {
      const flight = getFlightByShipId(ship.id);
      const { phase, stationary } = shipPhase(flight);
      const etaMs = flight ? flight.arrival.timestamp - now : null;

      return {
        id: ship.id,
        name: ship.name || ship.registration,
        phase,
        stationary,
        location: flight ? getDestinationName(flight.origin) : getCurrentLocation(ship),
        destination: flight ? getDestinationName(flight.destination) : null,
        etaMs: etaMs && etaMs > 0 ? etaMs : null,
      };
    });

    // Sort: stationary (idle) first, then by ETA (soonest first)
    summaries.sort((a, b) => {
      if (a.stationary && !b.stationary) return -1;
      if (!a.stationary && b.stationary) return 1;
      return (a.etaMs ?? Infinity) - (b.etaMs ?? Infinity);
    });

    return summaries.slice(0, 5);
  }, [shipsLastUpdated, tick]);

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
      <Panel title="Fleet" code="FLT" onViewAll={() => setActiveTab('fleet')}>
        <p className={`text-xs ${apexUnresponsive && !shipsFetched ? 'text-status-critical' : 'text-apxm-muted'} ${emptyMessage.pulse ? 'animate-pulse' : ''}`}>
          {emptyMessage.text}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Fleet" code="FLT" onViewAll={() => setActiveTab('fleet')}>
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
