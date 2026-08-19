import { useEffect, useRef, useState } from 'react';
import { btnPrimary, btnSecondary } from '../shared/button';
import {
  openSendSession,
  type SendSession,
  type SfcSnapshot,
} from '../../lib/act/sfc-driver';
import type { SendDestination } from '../../core/send-ship';
import { arrivalClock, parseApexDuration } from '../../lib/fleet-utils';
import { useOwnDestinations } from './useOwnDestinations';

/** Appends the local arrival time to APEX's duration text, matching the
 *  fleet list's "2h 54m (17:38)" convention — no mental clock math. */
function withArrivalClock(duration: string | undefined): string | undefined {
  if (!duration) return duration;
  const ms = parseApexDuration(duration);
  return ms === null ? duration : `${duration} (${arrivalClock(ms)})`;
}

interface SendShipViewProps {
  shipId: string;
  registration: string;
  onClose: () => void;
}

const chip = `${btnSecondary} min-h-touch px-2 text-xs`;
const chipActive = `${chip} text-prun-yellow border-prun-yellow`;
const chipActiveCritical = `${chip} text-status-critical border-status-critical`;

/**
 * STL consumption as a percent of the tank, from APEX's totals text
 * ("1241 units STL fuel (54%)..."). Null when no STL figure is present.
 */
export function stlConsumptionPct(consumption: string | undefined): number | null {
  const match = consumption?.match(/STL[^(]*\((\d+(?:\.\d+)?)%\)/i);
  return match ? Number(match[1]) : null;
}

/** Chips address POSITIONS across the slider's own range — ranges are
 *  per-ship/per-route (a reactor can span only 97.5–100%), so absolute
 *  percents are often unsatisfiable. Labels show the real value each
 *  position resolves to (from the band endpoints), so the button says
 *  what it sets. */
const CHIP_FRACS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Labels for the five position chips: the actual percent each position
 * resolves to within [minPct, maxPct]. Whole percents normally; one decimal
 * when the band is so narrow that whole-percent labels would collide
 * (e.g. 97.5–100% → 97.5 / 98.1 / 98.8 / 99.4 / 100).
 */
export function usageChipLabels(minPct: number, maxPct: number): string[] {
  const pcts = CHIP_FRACS.map((f) => minPct + f * (maxPct - minPct));
  const whole = pcts.map((p) => `${Math.round(p)}%`);
  if (new Set(whole).size === whole.length) return whole;
  return pcts.map((p) => `${Math.round(p * 10) / 10}%`);
}

const FALLBACK_LABELS = ['MIN', '25%', '50%', '75%', 'MAX'];

/** Absolute fuel targets: the useful fuel decisions live in the low band —
 *  consumption grows steeply and >50% is the no-return zone — so chips bias
 *  low instead of spreading across the slider (user ruling 2026-08-19).
 *  Reactor keeps position chips: narrow bands (97.5–100%) live there. */
const FUEL_TARGETS = [2, 5, 10, 25];

export interface FuelChipSpec {
  label: string;
  frac: number;
  pct: number;
}

/**
 * Fuel chips for a ship's band: always five — MIN plus the four ladder
 * steps. On the common wide band (floor ~1%, ceiling ≥25%) the steps are
 * exactly 2/5/10/25%. When the band can't fit them, the ladder's low-biased
 * spacing is rescaled into the achievable window [floor, min(25%, ceiling)]
 * so every button stays a distinct, reachable value (user ruling
 * 2026-08-19: five buttons baseline, labels reflect what IS possible).
 */
export function fuelChipSpecs(minPct: number, maxPct: number): FuelChipSpec[] {
  const baselineFloor = 1;
  const baselineTop = FUEL_TARGETS[FUEL_TARGETS.length - 1];
  const top = Math.min(baselineTop, maxPct);
  const pcts = [
    minPct,
    ...FUEL_TARGETS.map((t) => {
      const ladderPos = (t - baselineFloor) / (baselineTop - baselineFloor);
      return minPct + ladderPos * (top - minPct);
    }),
  ];
  // Whole-percent labels; one decimal if a narrow window makes them collide.
  let rounded = pcts.map((p) => Math.round(p));
  if (new Set(rounded).size !== rounded.length) {
    rounded = pcts.map((p) => Math.round(p * 10) / 10);
  }
  return rounded.map((pct, i) => ({
    label: i === 0 ? 'MIN' : `${pct}%`,
    // frac from the labelled value, so the button does what it says.
    frac: Math.min(1, Math.max(0, (pct - minPct) / (maxPct - minPct))),
    pct,
  }));
}

function fuelUsageChips(
  state: { valuePct: number; minPct: number; maxPct: number } | null,
  busy: boolean,
  onPick: (frac: number) => void,
  critical: boolean
) {
  if (state === null) {
    return ['MIN', ...FUEL_TARGETS.map((t) => `${t}%`)].map((label) => (
      <button key={label} type="button" className={chip} disabled>
        {label}
      </button>
    ));
  }
  const specs = fuelChipSpecs(state.minPct, state.maxPct);
  const nearest = specs.reduce((best, s) =>
    Math.abs(s.pct - state.valuePct) < Math.abs(best.pct - state.valuePct) ? s : best
  );
  return specs.map((s, i) => (
    <button
      key={i}
      type="button"
      className={nearest === s ? (critical ? chipActiveCritical : chipActive) : chip}
      disabled={busy}
      onClick={() => onPick(s.frac)}
    >
      {s.label}
    </button>
  ));
}

function usageChips(
  state: { posFrac: number; minPct: number; maxPct: number } | null,
  busy: boolean,
  onPick: (frac: number) => void
) {
  const labels = state === null ? FALLBACK_LABELS : usageChipLabels(state.minPct, state.maxPct);
  const nearest =
    state === null
      ? null
      : CHIP_FRACS.reduce((best, f) =>
          Math.abs(f - state.posFrac) < Math.abs(best - state.posFrac) ? f : best
        );
  return CHIP_FRACS.map((f, i) => (
    <button
      key={f}
      type="button"
      className={nearest === f ? chipActive : chip}
      disabled={busy}
      onClick={() => onPick(f)}
    >
      {labels[i]}
    </button>
  ));
}

/**
 * Send-ship: destination list → a held hidden SFC session — APEX's computed
 * route surfaced natively (duration, distance, fees, fuel, damage) with the
 * flight controls (reactor/fuel marks, route preference, gateways, landing,
 * unload-on-arrival) — → the user's SEND tap commits START. The buffer and
 * the action lock stay held for the whole review; cancel/unmount ALWAYS
 * closes the session (an armed SFC form must never outlive this view — the
 * disarm rule).
 */
export function SendShipView({ shipId, registration, onClose }: SendShipViewProps) {
  const destinations = useOwnDestinations(shipId);
  const sessionRef = useRef<SendSession | null>(null);
  const [phase, setPhase] = useState<'pick' | 'opening' | 'review' | 'sending' | 'sent'>('pick');
  const [destination, setDestination] = useState<SendDestination | null>(null);
  const [snapshot, setSnapshot] = useState<SfcSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The unmount guard: whatever happens to this view, the hidden buffer is
  // closed and the lock freed.
  useEffect(() => {
    return () => {
      void sessionRef.current?.close();
    };
  }, []);

  const closeAndExit = async () => {
    await sessionRef.current?.close();
    sessionRef.current = null;
    onClose();
  };

  const pickDestination = async (dest: SendDestination) => {
    setError(null);
    setDestination(dest);
    setPhase('opening');
    const opened = await openSendSession(registration, shipId);
    if (!opened.ok) {
      setError(opened.error);
      setPhase('pick');
      return;
    }
    sessionRef.current = opened.session;
    const set = await opened.session.setDestination(dest);
    if (!set.ok) {
      setError(set.error);
      await opened.session.close();
      sessionRef.current = null;
      setPhase('pick');
      return;
    }
    setSnapshot(opened.session.readSnapshot());
    setPhase('review');
  };

  const drive = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    const session = sessionRef.current;
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    const result = await action();
    if (!result.ok && result.error) setError(result.error);
    setSnapshot(session.readSnapshot());
    setBusy(false);
  };

  const handleSend = async () => {
    const session = sessionRef.current;
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    setPhase('sending');
    const result = await session.commitStart();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setSnapshot(session.readSnapshot());
      setPhase('review');
      return;
    }
    await session.close();
    sessionRef.current = null;
    setPhase('sent');
  };

  // The list is spent the moment a destination is tapped — swap it for a
  // dedicated progress state instead of appending a status the user would
  // have to scroll a long list to see.
  if (phase === 'opening') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-apxm-text truncate">
          → <span className="font-mono">{destination?.label}</span>
        </p>
        <p className="text-xs text-apxm-muted animate-pulse">Computing route...</p>
      </div>
    );
  }

  if (phase === 'pick') {
    return (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40">Destination</p>
        {/* Errors sit above the list — a failed pick lands the user back here
            with the reason in view, not below the fold. */}
        {error && <p className="text-xs text-status-critical">{error}</p>}
        {destinations.length === 0 && (
          <p className="text-xs text-apxm-muted">No known destinations</p>
        )}
        <div className="space-y-1">
          {destinations.map((d) => (
            <button
              key={d.label}
              type="button"
              className={`${btnSecondary} w-full min-h-touch px-3 py-2 text-left`}
              onClick={() => pickDestination(d)}
            >
              <span className="font-mono">{d.label}</span>
              <span className="ml-2 text-xs text-apxm-text/50">{d.kind}</span>
            </button>
          ))}
        </div>
        <button type="button" className={`${btnSecondary} w-full min-h-touch px-4 py-2`} onClick={closeAndExit}>
          Back
        </button>
      </div>
    );
  }

  if (phase === 'sent') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-apxm-text">
          Underway to <span className="font-mono">{destination?.label}</span>.
        </p>
        <button type="button" className={`${btnSecondary} w-full min-h-touch px-4 py-2`} onClick={onClose}>
          Back
        </button>
      </div>
    );
  }

  const t = snapshot?.totals;
  const valid = snapshot?.status === 'valid' && snapshot.startEnabled;
  // Base-game behaviour: STL burn over half the tank means (in theory) no
  // fuel to fly back — APEX shows the figure red, so do we, plus the fuel
  // slider surfaces that set it. The percent itself stays visible either
  // way, so the colour is emphasis, not the sole signal (CVD rule).
  const stlPct = stlConsumptionPct(t?.consumption);
  const noReturnFuel = stlPct !== null && stlPct > 50;

  // Every transient message shares ONE slot on the always-present segments
  // line, so none of them reflow the controls when they come and go
  // (device feedback 2026-08-19). Priority: error > APEX status > busy.
  const statusSlot = error ? (
    <span className="text-right text-status-critical">{error}</span>
  ) : !valid && snapshot?.status && snapshot.status !== 'valid' ? (
    <span className="text-right text-status-warning">{snapshot.status}</span>
  ) : busy ? (
    <span className="text-apxm-muted animate-pulse">Recomputing route...</span>
  ) : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-apxm-text truncate">
        → <span className="font-mono">{destination?.label}</span>
      </p>

      {/* The route APEX computed — the review surface. Ledger layout: values
          sit next to their labels, not stretched to the far edge. */}
      {t ? (
        <div className="text-xs">
          <div className="space-y-1">
            {[
              ['Duration', withArrivalClock(t.duration)],
              // APEX mashes the km and parsec figures together ("…km4 parsecs");
              // keep only the km part — parsecs add nothing next to it.
              ['Distance', t.distance.replace(/(?<=km)\s*[\d.,]+\s*parsecs?.*$/, '')],
              ['Fees', t.fees],
              ['Fuel', t.consumption],
              ['Damage', t.damage],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[4rem_auto] gap-x-2">
                <span className="text-apxm-text/70">{label}</span>
                <span className="font-mono tabular-nums text-apxm-text">
                  {/* APEX renders STL and FTL consumption as sibling elements;
                      textContent mashes them ("...(2%)12 units..."). Break at
                      a ")" followed by a digit so each fuel reads on its own
                      line. No-op for single-part values. */}
                  {value
                    ? value.split(/(?<=\))\s*(?=\d)/).map((part, i) => (
                        <span
                          key={i}
                          className={
                            noReturnFuel && label === 'Fuel' && /STL/i.test(part)
                              ? 'block text-status-critical'
                              : 'block'
                          }
                        >
                          {part}
                        </span>
                      ))
                    : '—'}
                </span>
              </div>
            ))}
          </div>
          {/* The recompute indicator lives on this always-present line so its
              appearance never reflows the controls below (device feedback
              2026-08-19: the old bottom-of-panel line pushed every button up
              and back on each recompute). */}
          <p className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-apxm-text/40">
            <span className="shrink-0">{snapshot?.segments.length} segments</span>
            {statusSlot}
          </p>
        </div>
      ) : (
        <p className="flex items-baseline justify-between gap-2 text-xs text-apxm-muted">
          <span className="shrink-0">No route computed</span>
          {statusSlot}
        </p>
      )}

      {/* Flight controls — each drives the hidden form; APEX recomputes.
          Chips set the usage sliders to fixed percentages via rail-position
          clicks (MIN = the slider's floor, ~1%). The active chip is the one
          nearest APEX's current value. Reactor is absent on some ships. */}
      <div className="space-y-2">
        {snapshot?.reactor != null && (
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-apxm-text/40">
              Reactor
              <span className="block font-mono tabular-nums text-apxm-text/70 normal-case">
                {snapshot.reactor.valuePct}%
              </span>
            </span>
            <div className="grid flex-1 grid-cols-5 gap-1">
              {usageChips(snapshot.reactor, busy, (frac) =>
                drive(() => sessionRef.current!.setSliderFraction('reactor', frac))
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-apxm-text/40">
            Fuel
            {snapshot?.fuel && (
              <span
                className={`block font-mono tabular-nums normal-case ${
                  noReturnFuel ? 'text-status-critical' : 'text-apxm-text/70'
                }`}
              >
                {snapshot.fuel.valuePct}%
              </span>
            )}
          </span>
          <div className="grid flex-1 grid-cols-5 gap-1">
            {fuelUsageChips(
              snapshot?.fuel ?? null,
              busy,
              (frac) => drive(() => sessionRef.current!.setSliderFraction('fuel', frac)),
              noReturnFuel
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-apxm-text/40">
            Route
          </span>
          <div className="grid flex-1 grid-cols-2 gap-1">
            {(
              [
                ['LEAST_JUMPS', 'Least jumps'],
                ['SHORTEST_FTL', 'Shortest FTL'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={(snapshot?.routePref ?? 'LEAST_JUMPS') === value ? chipActive : chip}
                disabled={busy}
                onClick={() => drive(() => sessionRef.current!.setRoutePref(value))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-apxm-text/40 pt-2">
            Options
          </span>
          <div className="grid flex-1 grid-cols-2 gap-1">
            {(
              [
                ['Use gateways', snapshot?.useGateways],
                ['Surface landing', snapshot?.surfaceLanding],
                ['Unload on arrival', snapshot?.unloadOnArrival],
              ] as const
            ).map(([label, active], index, options) => {
              // A lone trailing option spans both columns and centres itself
              // at a single column's width (the SET theme-picker idiom).
              const isLoneLast = index === options.length - 1 && options.length % 2 === 1;
              return (
                <button
                  key={label}
                  type="button"
                  className={`${active ? chipActive : chip} ${
                    isLoneLast ? 'col-span-2 justify-self-center w-[calc(50%-0.125rem)]' : ''
                  }`}
                  disabled={busy}
                  onClick={() => drive(() => sessionRef.current!.toggle(label))}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>


      <div className="flex gap-2">
        <button
          type="button"
          className={`${btnSecondary} min-h-touch px-4 py-2`}
          disabled={phase === 'sending'}
          onClick={closeAndExit}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${btnPrimary} flex-1 min-h-touch px-4 py-2 disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed`}
          disabled={!valid || busy || phase === 'sending'}
          onClick={handleSend}
        >
          {phase === 'sending' ? 'Sending...' : 'Send ship'}
        </button>
      </div>
    </div>
  );
}
