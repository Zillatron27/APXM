import { ProgressBar } from '../shared';
import { formatEta, formatCondition } from '../../lib/fleet-utils';
import { useShipDetail } from '../views/hooks';

interface ShipDetailViewProps {
  shipId: string;
}

/**
 * Read-only ship drill-down: route + flight phase, ETA, cargo (weight + volume),
 * fuel (STL + FTL), and condition. The action passthrough (fly / cargo / fuel /
 * unload, mirroring the FLT buffer's command column) is deferred to part 2,
 * same as the base REPAIR/PROD buffer actions.
 */
export function ShipDetailView({ shipId }: ShipDetailViewProps) {
  const ship = useShipDetail(shipId);

  // The ship vanished (store cleared on reconnect). The sheet still has its
  // title from the payload; just say the live detail is gone.
  if (!ship) {
    return <p className="text-sm text-apxm-muted">Ship data unavailable.</p>;
  }

  const route = ship.stationary
    ? ship.location
    : `${ship.location} → ${ship.destination}`;

  return (
    <div className="space-y-4">
      {/* Route + current flight phase */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-apxm-text/80 truncate">{route}</span>
        <span className="flex items-center gap-1 text-xs text-apxm-text/70 shrink-0">
          <span aria-hidden className="text-apxm-text">{ship.phase.icon}</span>
          {ship.phase.label}
        </span>
      </div>

      {/* ETA */}
      {ship.etaMs !== null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-apxm-text/70">ETA</span>
          <span className="font-mono text-apxm-text">{formatEta(ship.etaMs)}</span>
        </div>
      )}

      {/* Cargo: weight + volume */}
      <div className="space-y-1">
        <ProgressBar label="Cargo" current={ship.cargo.current} max={ship.cargo.max} color="orange" />
        <ProgressBar current={ship.cargoVolume.current} max={ship.cargoVolume.max} color="orange" />
      </div>

      {/* Fuel: STL + FTL */}
      <div className="space-y-1">
        <ProgressBar label="SF" current={ship.stlFuel.current} max={ship.stlFuel.max} color="yellow" />
        <ProgressBar label="FF" current={ship.ftlFuel.current} max={ship.ftlFuel.max} color="blue" />
      </div>

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
  );
}
