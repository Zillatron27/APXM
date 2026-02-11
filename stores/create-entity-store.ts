import { create } from 'zustand';
import { useStore, type StoreApi } from 'zustand';
import { browser } from 'wxt/browser';
import { BUILD_VERSION } from '../lib/constants';
import { warn } from '../lib/debug/logger';

export type DataSource = 'websocket' | 'fio' | 'cache' | null;

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

export interface PersistConfig {
  key: string;
  ttlMs?: number;
}

interface StoreCacheEntry<T> {
  entities: Record<string, T>;
  lastUpdated: number;
  dataSource: DataSource;
  cachedAt: number;
  version: string;
}

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
  beginBatch: () => void;
  endBatch: () => void;
  rehydrate: () => Promise<boolean>;
};

/** Default cache TTL: 24 hours */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Registry of all persisted stores — used by cache coordination module */
export const persistedStores: Array<{ key: string; rehydrate: () => Promise<boolean> }> = [];

function isContextInvalidated(error: unknown): boolean {
  return String(error).includes('Extension context invalidated');
}

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof browser !== 'undefined' && browser?.storage?.local !== undefined;
  } catch {
    return false;
  }
}

/**
 * Creates a Zustand store for managing a collection of entities by ID.
 *
 * @param name - Store name for debugging (not currently used but reserved for devtools)
 * @param selectId - Function to extract the unique ID from an entity
 * @param persist - Optional config for caching store state to browser.storage.local
 * @returns A Zustand store hook with CRUD operations and metadata tracking
 */
export function createEntityStore<T>(
  _name: string,
  selectId: (item: T) => string,
  persist?: PersistConfig
): EntityStoreHook<T> {
  // Shadow state for batch mode. During a batch, mutations accumulate
  // here instead of calling Zustand's set(). This prevents synchronous
  // React re-renders via useSyncExternalStore — the cause of error #185
  // during PrUn's login burst. One set() call at endBatch() flushes
  // the final state, yielding one render per store instead of dozens.
  let shadow: {
    entities: Map<string, T>;
    fetched: boolean;
    dataSource: DataSource;
  } | null = null;
  let shadowDirty = false;

  const store = create<EntityStore<T>>((set, get) => ({
    // State
    entities: new Map<string, T>(),
    fetched: false,
    lastUpdated: null,
    dataSource: null,

    // Queries — read from shadow state when batching
    getById: (id: string) => (shadow?.entities ?? get().entities).get(id),

    getAll: () => Array.from((shadow?.entities ?? get().entities).values()),

    // Mutations — write to shadow state when batching, Zustand set() otherwise
    setAll: (items: T[]) => {
      const entities = new Map<string, T>();
      for (const item of items) {
        entities.set(selectId(item), item);
      }
      if (shadow) {
        shadow.entities = entities;
        shadowDirty = true;
      } else {
        set({ entities, lastUpdated: Date.now() });
      }
    },

    setOne: (item: T) => {
      if (shadow) {
        shadow.entities.set(selectId(item), item);
        shadowDirty = true;
      } else {
        const entities = new Map(get().entities);
        entities.set(selectId(item), item);
        set({ entities, lastUpdated: Date.now() });
      }
    },

    setMany: (items: T[]) => {
      if (shadow) {
        for (const item of items) {
          shadow.entities.set(selectId(item), item);
        }
        shadowDirty = true;
      } else {
        const entities = new Map(get().entities);
        for (const item of items) {
          entities.set(selectId(item), item);
        }
        set({ entities, lastUpdated: Date.now() });
      }
    },

    removeOne: (id: string) => {
      if (shadow) {
        shadow.entities.delete(id);
        shadowDirty = true;
      } else {
        const entities = new Map(get().entities);
        entities.delete(id);
        set({ entities, lastUpdated: Date.now() });
      }
    },

    clear: () => {
      if (shadow) {
        shadow.entities = new Map<string, T>();
        shadow.fetched = false;
        shadow.dataSource = null;
        shadowDirty = true;
      } else {
        set({
          entities: new Map<string, T>(),
          fetched: false,
          lastUpdated: null,
          dataSource: null,
        });
      }
      // Also clear persisted cache when in-memory state is cleared
      if (persist && isBrowserStorageAvailable()) {
        browser.storage.local.remove(persist.key).catch((err) => {
          if (!isContextInvalidated(err)) {
            warn('Failed to clear cache key:', persist.key, err);
          }
        });
      }
    },

    setFetched: (source: DataSource) => {
      if (shadow) {
        shadow.fetched = true;
        shadow.dataSource = source;
        shadowDirty = true;
      } else {
        set({ fetched: true, dataSource: source });
      }
    },
  }));

  // Debounced persistence via store.subscribe()
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  if (persist) {
    const persistKey = persist.key;
    store.subscribe(() => {
      if (saveTimer !== null) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        const state = store.getState();
        // Only persist if store has data
        if (!state.fetched || state.dataSource === null) return;
        // Don't persist cache-sourced data back to cache (no-op cycle)
        if (state.dataSource === 'cache') return;

        const entry: StoreCacheEntry<T> = {
          entities: Object.fromEntries(state.entities),
          lastUpdated: state.lastUpdated ?? Date.now(),
          dataSource: state.dataSource,
          cachedAt: Date.now(),
          version: BUILD_VERSION,
        };

        if (!isBrowserStorageAvailable()) return;
        browser.storage.local.set({ [persistKey]: JSON.stringify(entry) }).catch((err) => {
          if (!isContextInvalidated(err)) {
            warn('Failed to persist cache:', persistKey, err);
          }
        });
      }, 2000);
    });
  }

  function beginBatch(): void {
    const state = store.getState();
    shadow = {
      entities: new Map(state.entities),
      fetched: state.fetched,
      dataSource: state.dataSource,
    };
    shadowDirty = false;
  }

  function endBatch(): void {
    if (!shadow) return;
    const s = shadow;
    const dirty = shadowDirty;
    shadow = null;
    shadowDirty = false;
    if (dirty) {
      store.setState({
        entities: s.entities,
        fetched: s.fetched,
        dataSource: s.dataSource,
        lastUpdated: Date.now(),
      });
    }
  }

  async function rehydrate(): Promise<boolean> {
    if (!persist || !isBrowserStorageAvailable()) return false;

    try {
      const result = await browser.storage.local.get(persist.key);
      const raw = result[persist.key];
      if (!raw) return false;

      const entry: StoreCacheEntry<T> = typeof raw === 'string' ? JSON.parse(raw) : raw;

      // Version mismatch — discard stale cache from older build
      if (entry.version !== BUILD_VERSION) return false;

      // TTL check — discard if cache is too old
      const ttl = persist.ttlMs ?? CACHE_TTL_MS;
      if (Date.now() - entry.cachedAt > ttl) return false;

      // Rehydrate into store
      const entities = new Map<string, T>(Object.entries(entry.entities));
      store.setState({
        entities,
        fetched: true,
        lastUpdated: entry.lastUpdated,
        dataSource: 'cache',
      });

      return true;
    } catch (err) {
      if (!isContextInvalidated(err)) {
        warn('Failed to rehydrate cache:', persist.key, err);
      }
      return false;
    }
  }

  // Register in persisted stores list for coordination
  if (persist) {
    persistedStores.push({ key: persist.key, rehydrate });
  }

  // Create a hook that can also be used with selectors
  const hook = (<U>(selector?: (state: EntityStore<T>) => U) => {
    return useStore(store, selector as (state: EntityStore<T>) => U);
  }) as EntityStoreHook<T>;

  // Attach store methods for non-React access
  hook.getState = store.getState;
  hook.setState = store.setState;
  hook.subscribe = store.subscribe;
  hook.beginBatch = beginBatch;
  hook.endBatch = endBatch;
  hook.rehydrate = rehydrate;

  return hook;
}
