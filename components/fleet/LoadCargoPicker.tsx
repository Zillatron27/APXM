import { useMemo, useState } from 'react';
import { MaterialTile } from '../shared';
import { btnPrimary, btnSecondary } from '../shared/button';
import { runShipLoadCargo } from '../../lib/ship-actions';
import { useLoadableMaterials } from './useLoadableMaterials';
import { useMaterialsStore } from '../../stores/reference';

interface LoadCargoPickerProps {
  shipId: string;
  /** Back to the ship detail body (the picker is a sub-mode of the sheet). */
  onClose: () => void;
}

/**
 * Load-cargo picker: every material available at the ship's location with an
 * amount input + MAX per row, a live capacity footer, and one LOAD tap that
 * commits the whole batch (drives one transfer wizard per material, grouped
 * by source buffer). Amount rules mirror the engine: per-row cap is the
 * material's own fit; the combined batch must also fit — the footer shows the
 * remaining hold space as amounts change and LOAD gates on it.
 */
export function LoadCargoPicker({ shipId, onClose }: LoadCargoPickerProps) {
  const list = useLoadableMaterials(shipId);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedReport, setLoadedReport] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!list.available) return { weight: 0, volume: 0, any: false };
    let weight = 0;
    let volume = 0;
    let any = false;
    for (const m of list.materials) {
      const amount = amounts[m.ticker] ?? 0;
      if (amount <= 0) continue;
      const mat = useMaterialsStore.getState().getById(m.ticker);
      if (!mat) continue;
      any = true;
      weight += amount * mat.weight;
      volume += amount * mat.volume;
    }
    return { weight, volume, any };
  }, [list, amounts]);

  if (!list.available) {
    const reasonText: Record<string, string> = {
      'no-hold': 'Hold data unavailable',
      'hold-full': 'Hold is full',
      'nothing-loadable': 'Nothing loadable at this location',
      'no-reference-data': 'Material data loading',
    };
    return (
      <div className="space-y-3">
        <p className="text-sm text-apxm-muted">{reasonText[list.reason] ?? list.reason}</p>
        <button type="button" className={`${btnSecondary} w-full min-h-touch px-4 py-2`} onClick={onClose}>
          Back
        </button>
      </div>
    );
  }

  const overCapacity = totals.weight > list.freeWeight || totals.volume > list.freeVolume;

  const setAmount = (ticker: string, raw: string, maxUnits: number) => {
    const n = Math.floor(Number(raw));
    // NaN (empty/garbage input) is handled at the boundary: treated as 0.
    const clamped = Number.isFinite(n) ? Math.max(0, Math.min(n, maxUnits)) : 0;
    setAmounts((prev) => ({ ...prev, [ticker]: clamped }));
  };

  const handleLoad = async () => {
    if (running || !totals.any || overCapacity) return;
    setRunning(true);
    setError(null);
    setLoadedReport(null);
    const picks = Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([ticker, amount]) => ({ ticker, amount }));
    const result = await runShipLoadCargo(shipId, picks);
    setRunning(false);
    if (result.ok) {
      setAmounts({});
      setLoadedReport(`Loaded ${result.loaded.join(', ')}`);
      return;
    }
    setError(
      result.loaded.length > 0
        ? `Loaded ${result.loaded.join(', ')} — then failed: ${result.error}`
        : result.error
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {list.materials.map((m) => (
          <div key={m.ticker} className="flex items-center gap-2">
            <MaterialTile ticker={m.ticker} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-apxm-text/70 truncate">
                {m.sourceLabel} · <span className="font-mono tabular-nums">{m.stock}</span>
              </p>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={m.maxUnits}
              value={amounts[m.ticker] || ''}
              placeholder="0"
              onChange={(e) => setAmount(m.ticker, e.target.value, m.maxUnits)}
              className="w-20 min-h-touch bg-transparent border border-apxm-accent px-2 font-mono tabular-nums text-right text-apxm-text"
              aria-label={`${m.ticker} amount`}
            />
            <button
              type="button"
              className={`${btnSecondary} min-h-touch px-2 text-xs`}
              onClick={() => setAmounts((prev) => ({ ...prev, [m.ticker]: m.maxUnits }))}
            >
              MAX
            </button>
          </div>
        ))}
      </div>

      {/* Capacity footer: remaining space AFTER the current selection. */}
      <div className="flex items-center justify-between text-xs text-apxm-text/70">
        <span>Hold space left</span>
        <span className={`font-mono tabular-nums ${overCapacity ? 'text-status-critical' : ''}`}>
          {(list.freeWeight - totals.weight).toFixed(1)}t · {(list.freeVolume - totals.volume).toFixed(1)}m³
        </span>
      </div>
      {overCapacity && (
        <p className="text-xs text-status-critical">Selection exceeds the hold capacity</p>
      )}

      <div className="flex gap-2">
        <button type="button" className={`${btnSecondary} min-h-touch px-4 py-2`} onClick={onClose} disabled={running}>
          Back
        </button>
        <button
          type="button"
          className={`${btnPrimary} flex-1 min-h-touch px-4 py-2 disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed`}
          disabled={running || !totals.any || overCapacity}
          onClick={handleLoad}
        >
          Load selected
        </button>
      </div>
      {running && (
        <p className="text-xs text-apxm-muted animate-pulse">Working in APEX buffer...</p>
      )}
      {loadedReport && <p className="text-xs text-apxm-text/70">{loadedReport}</p>}
      {error && <p className="text-xs text-status-critical">{error}</p>}
    </div>
  );
}
