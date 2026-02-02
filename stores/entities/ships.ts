import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type ShipsStore = EntityStore<PrunApi.Ship>;

export const useShipsStore = createEntityStore<PrunApi.Ship>(
  'ships',
  (ship) => ship.id
);
