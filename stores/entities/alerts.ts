import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type AlertsStore = EntityStore<PrunApi.Alert>;

// Not persisted: the full alert list re-arrives with every login dump
// (ALERTS_ALERTS), and stale notifications are worse than none.
export const useAlertsStore = createEntityStore<PrunApi.Alert>('alerts', (a) => a.id);
