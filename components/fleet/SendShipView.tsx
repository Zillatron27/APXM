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

/** MIN / 25% / 50% / 75% / MAX chips address POSITIONS across the slider's
 *  own range — ranges are per-ship/per-route (a reactor can span only
 *  97.5–100%), so absolute percents are often unsatisfiable. The row label
 *  shows the actual resulting value. */
const USAGE_CHIPS: { label: string; frac: number }[] = [
  { label: 'MIN', frac: 0 },
  { label: '25%', frac: 0.25 },
  { label: '50%', frac: 0.5 },
  { label: '75%', frac: 0.75 },
  { label: 'MAX', frac: 1 },
];

function usageChips(
  state: { posFrac: number } | null,
  busy: boolean,
  onPick: (frac: number) => void
) {
  const nearest =
    state === null
      ? null
      : USAGE_CHIPS.reduce((best, c) =>
          Math.abs(c.frac - state.posFrac) < Math.abs(best.frac - state.posFrac) ? c : best
        ).label;
  return USAGE_CHIPS.map((c) => (
    <button
      key={c.label}
      type="button"
      className={nearest === c.label ? chipActive : chip}
      disabled={busy}
      onClick={() => onPick(c.frac)}
    >
      {c.label}
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
                        <span key={i} className="block">
                          {part}
                        </span>
                      ))
                    : '—'}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-apxm-text/40">{snapshot?.segments.length} segments</p>
        </div>
      ) : (
        <p className="text-xs text-apxm-muted">No route computed</p>
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
              <span className="block font-mono tabular-nums text-apxm-text/70 normal-case">
                {snapshot.fuel.valuePct}%
              </span>
            )}
          </span>
          <div className="grid flex-1 grid-cols-5 gap-1">
            {usageChips(snapshot?.fuel ?? null, busy, (frac) =>
              drive(() => sessionRef.current!.setSliderFraction('fuel', frac))
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
            ).map(([label, active]) => (
              <button
                key={label}
                type="button"
                className={active ? chipActive : chip}
                disabled={busy}
                onClick={() => drive(() => sessionRef.current!.toggle(label))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {busy && <p className="text-xs text-apxm-muted animate-pulse">Recomputing route...</p>}
      {!valid && snapshot?.status && snapshot.status !== 'valid' && (
        <p className="text-xs text-status-warning">{snapshot.status}</p>
      )}
      {error && <p className="text-xs text-status-critical">{error}</p>}

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
