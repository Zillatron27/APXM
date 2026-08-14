import { useState } from 'react';
import { ProgressBar } from '../shared';
import { btnSecondary } from '../shared/button';
import { formatEta, formatCondition } from '../../lib/fleet-utils';
import { runShipUnload } from '../../lib/ship-actions';
import { useShipDetail } from '../views/hooks';

interface ShipDetailViewProps {
  shipId: string;
}

/**
 * Ship drill-down: route + flight phase, ETA, cargo (weight + volume), fuel
 * (STL + FTL), condition, and the first ship action — UNLOAD (one tap drives
 * the FLT buffer's unload for this ship; the tap IS the commit, APEX shows no
 * confirmation). Fly / cargo / fuel passthrough still to come (#9/#25).
 */
export function ShipDetailView({ shipId }: ShipDetailViewProps) {
  const ship = useShipDetail(shipId);
  const [actionRunning, setActionRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // APEX said no (ship state the WS data doesn't expose). Session-scoped on
  // purpose: reopening the sheet retries, matching the contract sheet.
  const [gameDisabled, setGameDisabled] = useState(false);

  const handleUnload = async () => {
    if (actionRunning || !ship) return;
    setActionRunning(true);
    setActionError(null);
    const result = await runShipUnload(ship.registration);
    setActionRunning(false);
    if (result.ok) return; // STORAGE_CHANGE deltas update the cargo bars
    if (result.disabledInApex) {
      setGameDisabled(true);
    } else {
      setActionError(result.error);
    }
  };

  // The ship vanished (store cleared on reconnect). The sheet still has its
  // title from the payload; just say the live detail is gone.
  if (!ship) {
    return <p className="text-sm text-apxm-muted">Ship data unavailable.</p>;
  }

  const route = ship.stationary
    ? ship.location
    : `${ship.location} → ${ship.destination}`;

  return (
    <div className="space-y-3">
      {/* Route + current flight phase */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-apxm-text truncate">{route}</span>
        <span className="flex items-center gap-1 text-xs text-apxm-text/70 shrink-0">
          <span aria-hidden className="text-apxm-text">{ship.phase.icon}</span>
          {ship.phase.label}
        </span>
      </div>

      {/* ETA */}
      {ship.etaMs !== null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-apxm-text/70">ETA</span>
          <span className="font-mono text-apxm-text tabular-nums">{formatEta(ship.etaMs)}</span>
        </div>
      )}

      {/* Cargo: weight + volume */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40">Cargo</p>
        <ProgressBar label="Weight" current={ship.cargo.current} max={ship.cargo.max} color="orange" unit="t" />
        <ProgressBar label="Vol" current={ship.cargoVolume.current} max={ship.cargoVolume.max} color="orange" unit="m³" />
      </div>

      {/* Fuel: STL + FTL, whole units (fractional fuel adds noise here) */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40">Fuel</p>
        <ProgressBar label="SF" current={Math.floor(ship.stlFuel.current)} max={Math.floor(ship.stlFuel.max)} color="yellow" />
        <ProgressBar label="FF" current={Math.floor(ship.ftlFuel.current)} max={Math.floor(ship.ftlFuel.max)} color="blue" />
      </div>

      {/* Actions — client-side gating is UX only; the game's own gate is the
          disabled check at act time (#73 lesson: never derive actionability). */}
      <div className="space-y-1">
        <button
          type="button"
          className={`${btnSecondary} w-full min-h-touch px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={actionRunning || gameDisabled || !ship.stationary || ship.cargo.current === 0}
          onClick={handleUnload}
        >
          {gameDisabled ? 'Unload — pending' : 'Unload cargo'}
        </button>
        {actionRunning && (
          <p className="text-xs text-apxm-muted animate-pulse">Working in APEX buffer...</p>
        )}
        {actionError && <p className="text-xs text-status-critical">{actionError}</p>}
      </div>

      {/* Condition */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-apxm-text/70">Condition</span>
        <span
          className={`font-mono tabular-nums ${
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
