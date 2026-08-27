import type { PrunApi } from '../types/prun-api';

export interface ScopedAlerts {
  /** Unread alerts in the player's own (COMPANY) context, newest first. */
  own: PrunApi.Alert[];
  /** Count of unread alerts in a reachable context that isn't the company's. */
  otherUnread: number;
  /** Count of unread alerts whose contextId isn't in the user's contexts at all. */
  dropped: number;
}

/**
 * Splits unread alerts by context so the panel can show "your" alerts
 * without corporation noise, while still surfacing that corp activity
 * exists.
 *
 * "Unread" is `read === false`, never `seen` — `seen` flips as soon as the
 * NOTS buffer is opened in APEX, `read` only when an alert is actually
 * opened. `read` is the number the panel has always shown, so it stays the
 * one definition of unread everywhere alert counts are derived.
 *
 * - own: unread AND contextId === companyContextId.
 * - other: unread AND contextId is one of the user's contexts, but not the
 *   company one (e.g. a corporation context).
 * - unreachable (dropped): contextId isn't in the user's contexts at all —
 *   APEX itself can't act on these for this user, so neither can APXM.
 *   Dropped means excluded from `own`, not counted in `otherUnread`.
 *
 * Degradation: until USER_DATA has arrived, `contexts` is empty and
 * `companyContextId` is undefined. Rather than reclassify everything as
 * "unreachable" (which would blank the panel the moment login data hasn't
 * landed yet), every unread alert is treated as own and no "other" is
 * counted — this matches pre-#92 behaviour, so nothing regresses while
 * data is still flowing in. The same fallback applies if contexts are
 * present but companyContextId couldn't be derived (no COMPANY-type entry
 * found) — without knowing which context is "ours", scoping can't safely
 * distinguish own from other, so we fall back the same way as empty
 * contexts rather than guessing.
 */
export function scopeAlerts(
  alerts: PrunApi.Alert[],
  contexts: PrunApi.UserContext[],
  companyContextId: string | undefined
): ScopedAlerts {
  const unread = alerts.filter((a) => !a.read);

  if (contexts.length === 0 || companyContextId === undefined) {
    return {
      own: [...unread].sort((a, b) => b.time.timestamp - a.time.timestamp),
      otherUnread: 0,
      dropped: 0,
    };
  }

  const reachableIds = new Set(contexts.map((c) => c.id));
  const own: PrunApi.Alert[] = [];
  let otherUnread = 0;
  let dropped = 0;

  for (const alert of unread) {
    if (alert.contextId === companyContextId) {
      own.push(alert);
    } else if (reachableIds.has(alert.contextId)) {
      otherUnread += 1;
    } else {
      dropped += 1;
    }
  }

  own.sort((a, b) => b.time.timestamp - a.time.timestamp);
  return { own, otherUnread, dropped };
}
