import { useMemo } from 'react';
import { useShipsStore } from '../../stores/entities/ships';
import { getFlightByShipId } from '../../stores/entities/flights';
import { Card, SectionHeader, StateTile } from '../shared';
import { useGameState } from '../../stores/gameState';
import { formatEta } from '../../lib/fleet-utils';
import { useTick } from '../../lib/use-tick';
import type { PrunApi } from '../../types/prun-api';

type FleetStatus = 'idle' | 'arriving-soon' | 'in-transit';

// Map status to StateTile label (all neutral for fleet)
const statusTileLabels: Record<FleetStatus, string> = {
  idle: 'Idle',
  'arriving-soon': 'Arriving',
  'in-transit': 'Transit',
};

interface ShipSummary {
  id: string;
  name: string;
  status: FleetStatus;
  destination: string | null;
  etaMs: number | null;
}

function getDestinationName(address: PrunApi.Address): string {
  for (const line of address.lines) {
    if (line.type === 'PLANET' && line.entity) {
      return line.entity.name || line.entity.naturalId;
    }
    if (line.type === 'STATION' && line.entity) {
      return line.entity.name || line.entity.naturalId;
    }
  }
  return 'Unknown';
}


export function FleetMiniList() {
  const { setActiveTab } = useGameState();
  const shipsLastUpdated = useShipsStore((s) => s.lastUpdated);
  // Tick every minute to update ETAs
  const tick = useTick(60000);

  const topShips = useMemo(() => {
    const ships = useShipsStore.getState().getAll();
    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;

    const summaries: ShipSummary[] = ships.map((ship) => {
      const flight = getFlightByShipId(ship.id);

      if (!flight) {
        return {
          id: ship.id,
          name: ship.name || ship.registration,
          status: 'idle' as FleetStatus,
          destination: null,
          etaMs: null,
        };
      }

      const arrivalMs = flight.arrival.timestamp;
      const etaMs = arrivalMs - now;
      const destination = getDestinationName(flight.destination);

      if (etaMs <= twoHoursMs) {
        return {
          id: ship.id,
          name: ship.name || ship.registration,
          status: 'arriving-soon' as FleetStatus,
          destination,
          etaMs,
        };
      }

      return {
        id: ship.id,
        name: ship.name || ship.registration,
        status: 'in-transit' as FleetStatus,
        destination,
        etaMs,
      };
    });

    // Sort: idle first, then arriving-soon by ETA, then in-transit by ETA
    summaries.sort((a, b) => {
      const statusOrder: Record<FleetStatus, number> = { idle: 0, 'arriving-soon': 1, 'in-transit': 2 };
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;

      // Within same status, sort by ETA
      const etaA = a.etaMs ?? Infinity;
      const etaB = b.etaMs ?? Infinity;
      return etaA - etaB;
    });

    return summaries.slice(0, 5);
  }, [shipsLastUpdated, tick]);

  if (topShips.length === 0) {
    return (
      <Card>
        <SectionHeader title="Fleet" onViewAll={() => setActiveTab('fleet')} />
        <p className="text-xs text-apxm-muted">No ship data available</p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Fleet" onViewAll={() => setActiveTab('fleet')} />
      <div className="space-y-0">
        {topShips.map((ship) => (
          <div key={ship.id} className="flex items-center justify-between py-1">
            <div className="flex-1 min-w-0 mr-2">
              <div className="text-sm text-apxm-text truncate">{ship.name}</div>
              {ship.destination && (
                <div className="text-xs text-apxm-muted truncate">{ship.destination}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StateTile label={statusTileLabels[ship.status]} variant="neutral" />
              {ship.etaMs !== null && (
                <span className="text-xs text-apxm-text/70 font-mono">
                  {formatEta(ship.etaMs)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
