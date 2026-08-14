import { useEffect, useRef, useState } from 'react';
import { btnPrimary, btnSecondary } from '../shared/button';
import {
  openSendSession,
  type SendSession,
  type SfcSnapshot,
} from '../../lib/act/sfc-driver';
import type { SendDestination } from '../../core/send-ship';
import { useOwnDestinations } from './useOwnDestinations';

interface SendShipViewProps {
  shipId: string;
  registration: string;
  onClose: () => void;
}

const chip = `${btnSecondary} min-h-touch px-2 text-xs`;
const chipActive = `${chip} text-prun-yellow border-prun-yellow`;

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

  if (phase === 'pick' || phase === 'opening') {
    return (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40">Destination</p>
        {destinations.length === 0 && (
          <p className="text-xs text-apxm-muted">No known destinations</p>
        )}
        <div className="space-y-1">
          {destinations.map((d) => (
            <button
              key={d.label}
              type="button"
              className={`${btnSecondary} w-full min-h-touch px-3 py-2 text-left disabled:opacity-30`}
              disabled={phase === 'opening'}
              onClick={() => pickDestination(d)}
            >
              <span className="font-mono">{d.label}</span>
              <span className="ml-2 text-xs text-apxm-text/50">{d.kind}</span>
            </button>
          ))}
        </div>
        {phase === 'opening' && (
          <p className="text-xs text-apxm-muted animate-pulse">
            Computing route to {destination?.label}...
          </p>
        )}
        {error && <p className="text-xs text-status-critical">{error}</p>}
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

      {/* The route APEX computed — the review surface. */}
      {t ? (
        <div className="space-y-1 text-xs">
          {[
            ['Duration', t.duration],
            ['Distance', t.distance],
            ['Fees', t.fees],
            ['Fuel', t.consumption],
            ['Damage', t.damage],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-apxm-text/70">{label}</span>
              <span className="font-mono tabular-nums text-apxm-text text-right">{value || '—'}</span>
            </div>
          ))}
          <p className="text-[10px] text-apxm-text/40">{snapshot?.segments.length} segments</p>
        </div>
      ) : (
        <p className="text-xs text-apxm-muted">No route computed</p>
      )}

      {/* Flight controls — each drives the hidden form; APEX recomputes. */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-apxm-text/40 w-14">Reactor</span>
          {['MIN', '29%', '53%', '76%', '100%'].map((mark) => (
            <button
              key={mark}
              type="button"
              className={snapshot?.reactorMark === mark ? chipActive : chip}
              disabled={busy}
              onClick={() => drive(() => sessionRef.current!.setReactorMark(mark))}
            >
              {mark}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-apxm-text/40 w-14">Fuel</span>
          {['MIN', 'MAX'].map((mark) => (
            <button
              key={mark}
              type="button"
              className={snapshot?.fuelMark === mark ? chipActive : chip}
              disabled={busy}
              onClick={() => drive(() => sessionRef.current!.setFuelMark(mark))}
            >
              {mark}
            </button>
          ))}
          <select
            className="ml-auto bg-transparent border border-apxm-accent text-xs font-mono min-h-touch px-1 text-apxm-text"
            value={snapshot?.routePref ?? 'LEAST_JUMPS'}
            disabled={busy}
            onChange={(e) => drive(() => sessionRef.current!.setRoutePref(e.target.value))}
            aria-label="Route preference"
          >
            <option value="LEAST_JUMPS">least jumps</option>
            <option value="SHORTEST_FTL">shortest FTL</option>
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
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
