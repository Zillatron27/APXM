import { useMemo, useState } from 'react';
import { FilterBar, MaterialTile, ProgressBar } from '../shared';
import { btnPrimary, btnSecondary } from '../shared/button';
import { runShipLoadCargo } from '../../lib/ship-actions';
import { useLoadableMaterials } from './useLoadableMaterials';
import { useMaterialsStore } from '../../stores/reference';
import { getMaterialCategory } from '../../lib/material-lookup';

type CategoryFilter = 'all' | 'consumables' | 'other';

const isConsumable = (ticker: string) => getMaterialCategory(ticker).startsWith('consumable');

/** Quick-add denominations, scaled to the row's cap like the desktop drop
 *  dialog: the two largest powers of ten that fit, e.g. cap 5110 → +100/+1000,
 *  cap 186 → +10/+100. Taps are additive (repeated drops), clamped to cap. */
function quickAmounts(maxUnits: number): number[] {
  const fitting = [1, 10, 100, 1000].filter((n) => n < maxUnits);
  return fitting.slice(-2);
}

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
  const [filter, setFilter] = useState<CategoryFilter>('all');
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

  // Dynamic per-row cap: the row's own fit, shrunk by the space the REST of
  // the selection already claims. Every control clamps to this, so the
  // selection can never exceed the hold — no warning state to undo.
  const effectiveCap = (ticker: string, rowMax: number): number => {
    const mat = useMaterialsStore.getState().getById(ticker);
    if (!mat) return rowMax;
    const current = amounts[ticker] ?? 0;
    // Space left with this row's own contribution excluded.
    const remWeight = list.freeWeight - totals.weight + current * mat.weight;
    const remVolume = list.freeVolume - totals.volume + current * mat.volume;
    const fits = Math.floor(
      Math.min(
        mat.weight > 0 ? remWeight / mat.weight : Infinity,
        mat.volume > 0 ? remVolume / mat.volume : Infinity
      )
    );
    return Math.max(0, Math.min(rowMax, fits));
  };

  const consumableCount = list.materials.filter((m) => isConsumable(m.ticker)).length;
  const visible = list.materials.filter(
    (m) =>
      filter === 'all' ||
      (filter === 'consumables' ? isConsumable(m.ticker) : !isConsumable(m.ticker))
  );

  const addAmount = (ticker: string, add: number, maxUnits: number) => {
    setAmounts((prev) => ({
      ...prev,
      [ticker]: Math.min((prev[ticker] ?? 0) + add, maxUnits),
    }));
  };

  return (
    <div className="space-y-3">
      {/* Capacity header, pinned while the list scrolls: selection vs the
          hold's free space, same bar idiom as the ship card. -m/p-4 counters
          the sheet's padding so the pinned strip spans edge to edge. */}
      <div className="sticky -top-4 z-10 -mx-4 space-y-1 border-b border-apxm-surface bg-apxm-bg px-4 pb-2 pt-4 -mt-4">
        <ProgressBar label="Weight" current={totals.weight} max={list.freeWeight} color="orange" unit="t" />
        <ProgressBar label="Vol" current={totals.volume} max={list.freeVolume} color="orange" unit="m³" />
      </div>
      <FilterBar<CategoryFilter>
        options={[
          { id: 'all', label: 'ALL', count: list.materials.length },
          { id: 'consumables', label: 'CONS', count: consumableCount },
          { id: 'other', label: 'OTHER', count: list.materials.length - consumableCount },
        ]}
        activeFilters={new Set([filter])}
        onChange={setFilter}
      />
      <div className="space-y-1">
        {visible.map((m) => {
          const chips = quickAmounts(m.maxUnits);
          const cap = effectiveCap(m.ticker, m.maxUnits);
          const atCap = (amounts[m.ticker] ?? 0) >= cap;
          return (
            <div key={m.ticker} className="flex items-center gap-2">
              {/* Tile + stock stacked, same idiom as the hold preview */}
              <div className="flex w-12 shrink-0 flex-col items-center">
                <MaterialTile ticker={m.ticker} size="sm" />
                <span className="text-[10px] font-mono text-apxm-text/70 tabular-nums">
                  {m.stock.toLocaleString()}
                </span>
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-apxm-text/70">{m.sourceLabel}</p>
              {/* Fixed 4-column control grid so every row's buttons align;
                  rows with fewer chips leave leading cells empty. */}
              <div className="grid w-52 shrink-0 grid-cols-4 gap-1">
                {Array.from({ length: 2 - chips.length }, (_, i) => (
                  <span key={`pad-${i}`} aria-hidden />
                ))}
                {chips.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${btnSecondary} min-h-touch px-1 text-xs tabular-nums disabled:opacity-30 disabled:shadow-none`}
                    disabled={atCap}
                    onClick={() => addAmount(m.ticker, n, cap)}
                  >
                    +{n}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${btnSecondary} min-h-touch px-1 text-xs disabled:opacity-30 disabled:shadow-none`}
                  disabled={atCap}
                  onClick={() => setAmounts((prev) => ({ ...prev, [m.ticker]: cap }))}
                >
                  MAX
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={cap}
                  value={amounts[m.ticker] || ''}
                  placeholder="0"
                  onChange={(e) => setAmount(m.ticker, e.target.value, cap)}
                  className="min-h-touch w-full bg-transparent border border-apxm-accent px-1 font-mono tabular-nums text-right text-apxm-text"
                  aria-label={`${m.ticker} amount`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action footer, pinned opposite the capacity header so LOAD is
          always in view while amounts are being set. */}
      <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 space-y-2 border-t border-apxm-surface bg-apxm-bg px-4 py-3">
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
    </div>
  );
}
