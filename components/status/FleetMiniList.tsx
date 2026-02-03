import { useMemo } from 'react';
import { useShipsStore } from '../../stores/entities/ships';
import { getFlightByShipId } from '../../stores/entities/flights';
import { Card, SectionHeader } from '../shared';
import { useGameState } from '../../stores/gameState';
import type { PrunApi } from '../../types/prun-api';

type FleetStatus = 'idle' | 'arriving-soon' | 'in-transit';

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

function formatEta(etaMs: number): string {
  const hours = Math.floor(etaMs / (1000 * 60 * 60));
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function FleetMiniList() {
  const { setActiveTab } = useGameState();
  const shipsLastUpdated = useShipsStore((s) => s.lastUpdated);

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
  }, [shipsLastUpdated]);

  if (topShips.length === 0) {
    return (
      <Card>
        <SectionHeader title="Fleet" onViewAll={() => setActiveTab('fleet')} />
        <p className="text-xs text-apxm-muted">No ship data available</p>
      </Card>
    );
  }

  const statusColors: Record<FleetStatus, string> = {
    idle: 'text-apxm-muted',
    'arriving-soon': 'text-status-warning',
    'in-transit': 'text-status-ok',
  };

  const statusLabels: Record<FleetStatus, string> = {
    idle: 'Idle',
    'arriving-soon': 'Arriving',
    'in-transit': 'In Transit',
  };

  return (
    <Card>
      <SectionHeader title="Fleet" onViewAll={() => setActiveTab('fleet')} />
      <div className="space-y-1">
        {topShips.map((ship) => (
          <div key={ship.id} className="flex items-center justify-between min-h-touch">
            <div className="flex-1 min-w-0 mr-2">
              <div className="text-sm text-apxm-text truncate">{ship.name}</div>
              {ship.destination && (
                <div className="text-xs text-apxm-muted truncate">{ship.destination}</div>
              )}
            </div>
            <div className={`text-xs whitespace-nowrap ${statusColors[ship.status]}`}>
              {ship.status === 'idle'
                ? statusLabels.idle
                : `${statusLabels[ship.status]} ${ship.etaMs !== null ? formatEta(ship.etaMs) : ''}`}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
