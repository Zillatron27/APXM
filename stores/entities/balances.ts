import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type BalancesStore = EntityStore<PrunApi.CurrencyAmount>;

export const useBalancesStore = createEntityStore<PrunApi.CurrencyAmount>(
  'balances',
  (x) => x.currency
);
