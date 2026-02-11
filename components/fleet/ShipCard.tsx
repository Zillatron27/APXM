import { useState } from 'react';
import { StateTile, ProgressBar } from '../shared';
import { formatEta, formatCondition } from '../../lib/fleet-utils';
import type { ShipDetail, FlightState } from '../views/hooks';

interface ShipCardProps {
  ship: ShipDetail;
  defaultExpanded?: boolean;
}

// Flight states are all neutral/grey - informational only
const stateLabels: Record<FlightState, string> = {
  IDL: 'Idle',
  ARR: 'Arriving',
  TRN: 'Transit',
  DEP: 'Departing',
  ORB: 'Orbiting',
};

/**
 * Collapsible card showing ship status and details.
 * Collapsed: name, location/dest, state tile, ETA
 * Expanded: cargo, fuel bars, condition
 */
export function ShipCard({ ship, defaultExpanded = false }: ShipCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const statusText =
    ship.state === 'IDL'
      ? ship.location
      : `${ship.location} → ${ship.destination}`;

  return (
    <div className="bg-apxm-surface overflow-hidden">
      {/* Header - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-apxm-accent/30 min-h-[44px]"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Expand/collapse indicator */}
          <span className="text-apxm-text/50 text-xs w-4 shrink-0">
            {expanded ? '▼' : '▶'}
          </span>

          {/* Ship name */}
          <span className="font-semibold text-apxm-text truncate">
            {ship.name}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Location/destination preview */}
          <span className="text-xs text-apxm-text/70 hidden sm:inline truncate max-w-[100px]">
            {ship.destination || ship.location}
          </span>

          {/* State tile */}
          <StateTile label={stateLabels[ship.state]} variant="neutral" />

          {/* ETA */}
          {ship.etaMs && (
            <span className="text-xs text-apxm-text/70 font-mono">
              {formatEta(ship.etaMs)}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-apxm-bg space-y-2">
          {/* Status line */}
          <div className="text-xs text-apxm-text/70 pt-2">{statusText}</div>

          {/* Cargo weight bar */}
          <ProgressBar
            label="Cargo"
            current={ship.cargo.current}
            max={ship.cargo.max}
            color="orange"
          />

          {/* Cargo volume bar */}
          <ProgressBar
            label=""
            current={ship.cargoVolume.current}
            max={ship.cargoVolume.max}
            color="orange"
          />

          {/* STL fuel bar */}
          <ProgressBar
            label="SF"
            current={ship.stlFuel.current}
            max={ship.stlFuel.max}
            color="yellow"
          />

          {/* FTL fuel bar */}
          <ProgressBar
            label="FF"
            current={ship.ftlFuel.current}
            max={ship.ftlFuel.max}
            color="blue"
          />

          {/* Condition */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-apxm-text/70">Condition</span>
            <span
              className={`font-mono ${
                ship.condition < 0.5
                  ? 'text-status-critical'
                  : ship.condition < 0.8
                    ? 'text-status-warning'
                    : 'text-apxm-text'
              }`}
            >
              {formatCondition(ship.condition)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
