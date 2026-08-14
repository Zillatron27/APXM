import { useState } from 'react';
import { ProgressBar } from '../shared';
import { btnSecondary } from '../shared/button';
import { formatEta, formatCondition } from '../../lib/fleet-utils';
import { runShipUnload, runShipRefuel, type ShipActionResult } from '../../lib/ship-actions';
import type { FuelTank } from '../../core/refuel';
import { useRefuelPlan } from './useRefuelPlan';
import { useLoadableMaterials } from './useLoadableMaterials';
import { LoadCargoPicker } from './LoadCargoPicker';
import { useShipDetail } from '../views/hooks';

interface ShipDetailViewProps {
  shipId: string;
}

type RunningAction = 'unload' | FuelTank | null;

const actionBtn = `${btnSecondary} w-full min-h-touch px-4 py-2 disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed`;

/**
 * Ship drill-down: route + flight phase, ETA, cargo (weight + volume), fuel
 * (STL + FTL), condition, and the ship actions — UNLOAD and REFUEL SF/FF.
 * One tap drives the APEX buffer off-screen; the tap IS the commit (neither
 * action shows an APEX confirmation). Load cargo / send ship still to come
 * (#9/#25, the v1.2.0 ship-actions wave).
 */
export function ShipDetailView({ shipId }: ShipDetailViewProps) {
  const ship = useShipDetail(shipId);
  const stlPlan = useRefuelPlan(shipId, 'stl');
  const ftlPlan = useRefuelPlan(shipId, 'ftl');
  const loadable = useLoadableMaterials(shipId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [running, setRunning] = useState<RunningAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // APEX said no (ship state the WS data doesn't expose). Session-scoped on
  // purpose: reopening the sheet retries, matching the contract sheet.
  const [unloadGameDisabled, setUnloadGameDisabled] = useState(false);

  const runAction = async (action: Exclude<RunningAction, null>, go: () => Promise<ShipActionResult>) => {
    if (running || !ship) return;
    setRunning(action);
    setActionError(null);
    const result = await go();
    setRunning(null);
    if (result.ok) return; // STORAGE_CHANGE deltas update the bars
    if (result.disabledInApex && action === 'unload') {
      setUnloadGameDisabled(true);
    } else {
      setActionError(result.error);
    }
  };

  // The ship vanished (store cleared on reconnect). The sheet still has its
  // title from the payload; just say the live detail is gone.
  if (!ship) {
    return <p className="text-sm text-apxm-muted">Ship data unavailable.</p>;
  }

  // Picker sub-mode: the sheet body swaps to the load-cargo picker (no new
  // navigation mechanism — same detailView, same sheet).
  if (pickerOpen) {
    return <LoadCargoPicker shipId={shipId} onClose={() => setPickerOpen(false)} />;
  }

  const route = ship.stationary
    ? ship.location
    : `${ship.location} → ${ship.destination}`;

  const refuelReasonText: Record<string, string> = {
    'tank-full': 'Tank is full',
    'no-fuel-here': 'None at this location',
    'no-reference-data': 'Material data loading',
    'no-tank': 'Tank data unavailable',
  };

  // Client-side gating is UX only; the game's own gate is the act-time check
  // (#73 lesson: never derive actionability). A gated button always says WHY
  // (silent-failure rule): a bare disabled button read as tappable-but-dead
  // on device (2026-08-14).
  const refuelRow = (tank: FuelTank, view: ReturnType<typeof useRefuelPlan>) => {
    const enabled = ship.stationary && view.plan.available && running === null;
    return (
      <div key={tank} className="space-y-1">
        <button
          type="button"
          className={actionBtn}
          disabled={!enabled}
          onClick={() =>
            runAction(tank, () => runShipRefuel(shipId, tank))
          }
        >
          Refuel {view.ticker}
        </button>
        {ship.stationary && view.plan.available && (
          <p className="text-xs text-apxm-muted">
            <span className="font-mono tabular-nums">{view.plan.units}</span> {view.ticker} from{' '}
            {view.sourceLabel}
          </p>
        )}
        {ship.stationary && !view.plan.available && (
          <p className="text-xs text-apxm-muted">
            {refuelReasonText[view.plan.reason] ?? view.plan.reason}
          </p>
        )}
      </div>
    );
  };

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

      {/* Actions */}
      <div className="space-y-2">
        <div className="space-y-1">
          <button
            type="button"
            className={actionBtn}
            disabled={
              running !== null || unloadGameDisabled || !ship.stationary || ship.cargo.current === 0
            }
            onClick={() => runAction('unload', () => runShipUnload(ship.registration))}
          >
            {unloadGameDisabled ? 'Unload — pending' : 'Unload cargo'}
          </button>
          {ship.stationary && ship.cargo.current === 0 && running === null && (
            <p className="text-xs text-apxm-muted">Hold is empty</p>
          )}
        </div>

        <div className="space-y-1">
          <button
            type="button"
            className={actionBtn}
            disabled={running !== null || !ship.stationary || !loadable.available}
            onClick={() => setPickerOpen(true)}
          >
            Load cargo
          </button>
          {ship.stationary && !loadable.available && (
            <p className="text-xs text-apxm-muted">
              {loadable.reason === 'hold-full'
                ? 'Hold is full'
                : loadable.reason === 'nothing-loadable'
                  ? 'Nothing loadable at this location'
                  : loadable.reason === 'no-reference-data'
                    ? 'Material data loading'
                    : 'Hold data unavailable'}
            </p>
          )}
        </div>

        {refuelRow('stl', stlPlan)}
        {refuelRow('ftl', ftlPlan)}

        {!ship.stationary && (
          <p className="text-xs text-apxm-muted">In transit — dock for ship actions</p>
        )}
        {running !== null && (
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
