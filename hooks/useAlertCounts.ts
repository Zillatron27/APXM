import { useMemo } from 'react';
import { useAlertsStore } from '../stores/entities';
import { useUserStore } from '../stores/user';
import { scopeAlerts } from '../lib/alert-scope';

export interface AlertCounts {
  /** Unread alerts in the player's own (COMPANY) context. */
  ownUnread: number;
  /** Unread alerts in a reachable non-company context (e.g. corporation). */
  otherUnread: number;
}

/**
 * THE single source of unread alert counts. Anything in APXM that shows an
 * unread badge (the NOTS panel, and future badges elsewhere — nav, tab
 * icons, etc) should read from this hook rather than re-deriving counts
 * from the alerts store directly, so "unread" has exactly one definition
 * app-wide (see lib/alert-scope.ts).
 */
export function useAlertCounts(): AlertCounts {
  // Plain selectors: the stores replace these references only on a real
  // update, so reference equality is the right (and cheapest) change signal.
  const entities = useAlertsStore((s) => s.entities);
  const contexts = useUserStore((s) => s.contexts);
  const companyContextId = useUserStore((s) => s.companyContextId);

  return useMemo(() => {
    const alerts = Array.from(entities.values());
    const { own, otherUnread } = scopeAlerts(alerts, contexts, companyContextId);
    return { ownUnread: own.length, otherUnread };
  }, [entities, contexts, companyContextId]);
}
