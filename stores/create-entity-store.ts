import { create } from 'zustand';
import { useStore, type StoreApi } from 'zustand';

export type DataSource = 'websocket' | 'fio' | null;

export interface EntityStoreState<T> {
  entities: Map<string, T>;
  fetched: boolean;
  lastUpdated: number | null;
  dataSource: DataSource;
}

export interface EntityStoreActions<T> {
  getById: (id: string) => T | undefined;
  getAll: () => T[];
  setAll: (items: T[]) => void;
  setOne: (item: T) => void;
  setMany: (items: T[]) => void;
  removeOne: (id: string) => void;
  clear: () => void;
  setFetched: (source: DataSource) => void;
}

export type EntityStore<T> = EntityStoreState<T> & EntityStoreActions<T>;

/**
 * Extended store type that can be used both as a hook (for React components)
 * and accessed directly via getState() (for message handlers).
 */
export type EntityStoreHook<T> = {
  (): EntityStore<T>;
  <U>(selector: (state: EntityStore<T>) => U): U;
  getState: () => EntityStore<T>;
  setState: StoreApi<EntityStore<T>>['setState'];
  subscribe: StoreApi<EntityStore<T>>['subscribe'];
};

/**
 * Creates a Zustand store for managing a collection of entities by ID.
 *
 * @param name - Store name for debugging (not currently used but reserved for devtools)
 * @param selectId - Function to extract the unique ID from an entity
 * @returns A Zustand store hook with CRUD operations and metadata tracking
 */
export function createEntityStore<T>(
  _name: string,
  selectId: (item: T) => string
): EntityStoreHook<T> {
  const store = create<EntityStore<T>>((set, get) => ({
    // State
    entities: new Map<string, T>(),
    fetched: false,
    lastUpdated: null,
    dataSource: null,

    // Queries
    getById: (id: string) => get().entities.get(id),

    getAll: () => Array.from(get().entities.values()),

    // Mutations
    setAll: (items: T[]) => {
      const entities = new Map<string, T>();
      for (const item of items) {
        entities.set(selectId(item), item);
      }
      set({ entities, lastUpdated: Date.now() });
    },

    setOne: (item: T) => {
      const entities = new Map(get().entities);
      entities.set(selectId(item), item);
      set({ entities, lastUpdated: Date.now() });
    },

    setMany: (items: T[]) => {
      const entities = new Map(get().entities);
      for (const item of items) {
        entities.set(selectId(item), item);
      }
      set({ entities, lastUpdated: Date.now() });
    },

    removeOne: (id: string) => {
      const entities = new Map(get().entities);
      entities.delete(id);
      set({ entities, lastUpdated: Date.now() });
    },

    clear: () => {
      set({
        entities: new Map<string, T>(),
        fetched: false,
        lastUpdated: null,
        dataSource: null,
      });
    },

    setFetched: (source: DataSource) => {
      set({ fetched: true, dataSource: source });
    },
  }));

  // Create a hook that can also be used with selectors
  const hook = (<U>(selector?: (state: EntityStore<T>) => U) => {
    return useStore(store, selector as (state: EntityStore<T>) => U);
  }) as EntityStoreHook<T>;

  // Attach store methods for non-React access
  hook.getState = store.getState;
  hook.setState = store.setState;
  hook.subscribe = store.subscribe;

  return hook;
}
