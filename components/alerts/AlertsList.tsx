import { useMemo, useState } from 'react';
import { btnSecondary } from '../shared';
import { useAlertsStore } from '../../stores/entities';
import { useUserStore } from '../../stores/user';
import { scopeAlerts } from '../../lib/alert-scope';
import { markAllAlertsRead } from '../../lib/alert-actions';
import { AlertRow } from './AlertRow';

/**
 * The unread alerts list body of the Notifications view: rows, empty
 * states, and MARK ALL READ.
 *
 * Unread only: the login snapshot carries the full NOTS history, which is
 * several screens of already-read noise. Read alerts live in APEX's NOTS
 * buffer; this is the "what needs my attention" list. Other-context (corp)
 * unread is reported as a count, never interleaved — the row set is the
 * player's own context only (see lib/alert-scope.ts).
 */
export function AlertsList() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useAlertsStore((s) => s.fetched);
  const entities = useAlertsStore((s) => s.entities);
  const contexts = useUserStore((s) => s.contexts);
  const companyContextId = useUserStore((s) => s.companyContextId);

  const { own, otherUnread, dropped } = useMemo(
    () => scopeAlerts(Array.from(entities.values()), contexts, companyContextId),
    [entities, contexts, companyContextId]
  );

  async function handleMarkAllRead(): Promise<void> {
    if (running) return;
    setRunning(true);
    setError(null);
    const result = await markAllAlertsRead();
    setRunning(false);
    // Success needs no local update: the store clears via APEX's
    // ALERTS_ALERTS confirmation (see lib/alert-actions.ts).
    if (!result.ok) setError(result.error);
  }

  return (
    <>
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={running || own.length === 0}
          className={`min-h-touch px-3 text-xs ${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {running ? 'Working…' : 'MARK ALL READ'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-status-critical pb-1">
          <span aria-hidden>! </span>
          {error}
        </p>
      )}
      {!fetched ? (
        <p className="text-xs text-apxm-muted">Waiting for game data...</p>
      ) : own.length === 0 ? (
        <p className="text-xs text-apxm-muted">No unread notifications</p>
      ) : (
        <div className="space-y-1">
          {own.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}
      {fetched && otherUnread > 0 && (
        <p className="text-[10px] text-apxm-muted pt-1">
          {otherUnread} corp unread — see NOTS in APEX
        </p>
      )}
      {/* Dev-only visibility into the unreachable-context filter — outside
          the list branch so it still shows when the filter removed
          everything, which is the case worth seeing. Never shown to users:
          there is nothing they can act on for these alerts. */}
      {__DEV__ && fetched && dropped > 0 && (
        <p className="text-[10px] text-apxm-muted pt-1">
          {dropped} from unreachable contexts hidden
        </p>
      )}
    </>
  );
}
