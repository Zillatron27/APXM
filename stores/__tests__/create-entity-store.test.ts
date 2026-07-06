import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BUILD_VERSION } from '../../lib/constants';

// In-memory stand-in for browser.storage.local so the persistence path is
// exercised for real (what gets written/read), not stubbed out. vi.hoisted
// because vi.mock factories run before module-scope const declarations.
const storageMock = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    get: vi.fn(async (key: string) => {
      const value = data.get(key);
      return value === undefined ? {} : { [key]: value };
    }),
    set: vi.fn(async (items: Record<string, string>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, value);
    }),
    remove: vi.fn(async (key: string) => {
      data.delete(key);
    }),
  };
});

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: storageMock.get,
        set: storageMock.set,
        remove: storageMock.remove,
      },
    },
  },
}));

import { createEntityStore } from '../create-entity-store';

interface TestEntity {
  id: string;
  name: string;
  value: number;
}

describe('createEntityStore', () => {
  let store: ReturnType<typeof createEntityStore<TestEntity>>;

  beforeEach(() => {
    store = createEntityStore<TestEntity>('test', (item) => item.id);
  });

  describe('initial state', () => {
    it('starts with empty entities', () => {
      expect(store.getState().entities.size).toBe(0);
    });

    it('starts with fetched=false', () => {
      expect(store.getState().fetched).toBe(false);
    });

    it('starts with null lastUpdated', () => {
      expect(store.getState().lastUpdated).toBeNull();
    });

    it('starts with null dataSource', () => {
      expect(store.getState().dataSource).toBeNull();
    });
  });

  describe('setAll', () => {
    it('replaces all entities', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);

      expect(store.getState().entities.size).toBe(2);
      expect(store.getState().getById('1')?.name).toBe('one');
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('overwrites existing entities', () => {
      store.getState().setAll([{ id: '1', name: 'one', value: 1 }]);
      store.getState().setAll([{ id: '2', name: 'two', value: 2 }]);

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')).toBeUndefined();
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('updates lastUpdated timestamp', () => {
      const before = Date.now();
      store.getState().setAll([{ id: '1', name: 'one', value: 1 }]);
      const after = Date.now();

      const lastUpdated = store.getState().lastUpdated;
      expect(lastUpdated).not.toBeNull();
      expect(lastUpdated).toBeGreaterThanOrEqual(before);
      expect(lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe('setOne', () => {
    it('adds a new entity', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')?.name).toBe('one');
    });

    it('updates an existing entity', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setOne({ id: '1', name: 'updated', value: 2 });

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')?.name).toBe('updated');
      expect(store.getState().getById('1')?.value).toBe(2);
    });
  });

  describe('setMany', () => {
    it('adds multiple entities without clearing existing', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setMany([
        { id: '2', name: 'two', value: 2 },
        { id: '3', name: 'three', value: 3 },
      ]);

      expect(store.getState().entities.size).toBe(3);
    });

    it('updates existing entities while adding new', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setMany([
        { id: '1', name: 'updated', value: 10 },
        { id: '2', name: 'two', value: 2 },
      ]);

      expect(store.getState().entities.size).toBe(2);
      expect(store.getState().getById('1')?.name).toBe('updated');
    });
  });

  describe('removeOne', () => {
    it('removes an entity by id', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);
      store.getState().removeOne('1');

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')).toBeUndefined();
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('handles removing non-existent id gracefully', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().removeOne('nonexistent');

      expect(store.getState().entities.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all entities', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);
      store.getState().clear();

      expect(store.getState().entities.size).toBe(0);
    });

    it('resets fetched to false', () => {
      store.getState().setFetched('websocket');
      store.getState().clear();

      expect(store.getState().fetched).toBe(false);
    });

    it('resets lastUpdated to null', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().clear();

      expect(store.getState().lastUpdated).toBeNull();
    });

    it('resets dataSource to null', () => {
      store.getState().setFetched('fio');
      store.getState().clear();

      expect(store.getState().dataSource).toBeNull();
    });
  });

  describe('setFetched', () => {
    it('sets fetched=true and tracks source', () => {
      store.getState().setFetched('websocket');

      expect(store.getState().fetched).toBe(true);
      expect(store.getState().dataSource).toBe('websocket');
    });

    it('can update source from websocket to fio', () => {
      store.getState().setFetched('websocket');
      store.getState().setFetched('fio');

      expect(store.getState().dataSource).toBe('fio');
    });
  });

  describe('getAll', () => {
    it('returns all entities as an array', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);

      const all = store.getState().getAll();

      expect(all).toHaveLength(2);
      expect(all.map((e) => e.id).sort()).toEqual(['1', '2']);
    });

    it('returns empty array when no entities', () => {
      expect(store.getState().getAll()).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns entity when found', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });

      expect(store.getState().getById('1')).toEqual({
        id: '1',
        name: 'one',
        value: 1,
      });
    });

    it('returns undefined when not found', () => {
      expect(store.getState().getById('nonexistent')).toBeUndefined();
    });
  });

  describe('batch mode', () => {
    it('does not trigger Zustand set during batch', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.beginBatch();
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setOne({ id: '2', name: 'two', value: 2 });

      // Zustand subscriber should NOT have fired yet
      expect(listener).not.toHaveBeenCalled();
      // But Zustand's committed state should still be empty
      expect(store.getState().entities.size).toBe(0);

      store.endBatch();
    });

    it('flushes accumulated mutations on endBatch', () => {
      store.beginBatch();
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setMany([
        { id: '2', name: 'two', value: 2 },
        { id: '3', name: 'three', value: 3 },
      ]);
      store.endBatch();

      expect(store.getState().entities.size).toBe(3);
      expect(store.getState().getById('1')?.name).toBe('one');
      expect(store.getState().getById('3')?.name).toBe('three');
    });

    it('fires Zustand subscriber exactly once on endBatch', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.beginBatch();
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setOne({ id: '2', name: 'two', value: 2 });
      store.getState().setOne({ id: '3', name: 'three', value: 3 });
      store.endBatch();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('reads from shadow state during batch', () => {
      store.beginBatch();
      store.getState().setOne({ id: '1', name: 'one', value: 1 });

      // getById should read from shadow, not committed state
      expect(store.getState().getById('1')?.name).toBe('one');
      // getAll should also read from shadow
      expect(store.getState().getAll()).toHaveLength(1);

      store.endBatch();
    });

    it('endBatch is a no-op when no mutations occurred', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.beginBatch();
      store.endBatch();

      expect(listener).not.toHaveBeenCalled();
    });

    it('handles setAll during batch', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });

      store.beginBatch();
      store.getState().setAll([
        { id: '2', name: 'two', value: 2 },
        { id: '3', name: 'three', value: 3 },
      ]);
      store.endBatch();

      expect(store.getState().entities.size).toBe(2);
      expect(store.getState().getById('1')).toBeUndefined();
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('handles removeOne during batch', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);

      store.beginBatch();
      store.getState().removeOne('1');
      store.endBatch();

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')).toBeUndefined();
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('handles clear during batch', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);

      store.beginBatch();
      store.getState().clear();
      store.endBatch();

      expect(store.getState().entities.size).toBe(0);
      expect(store.getState().fetched).toBe(false);
      expect(store.getState().dataSource).toBeNull();
    });

    it('handles setFetched during batch', () => {
      store.beginBatch();
      store.getState().setFetched('websocket');
      store.endBatch();

      expect(store.getState().fetched).toBe(true);
      expect(store.getState().dataSource).toBe('websocket');
    });
  });

  describe('invalid entity ids', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('setAll skips entities with empty or missing ids and keeps valid ones', () => {
      store.getState().setAll([
        { id: '1', name: 'valid', value: 1 },
        { id: '', name: 'empty-id', value: 2 },
        { name: 'missing-id', value: 3 } as unknown as TestEntity,
      ]);

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')?.name).toBe('valid');
    });

    it('setMany skips entities with empty or missing ids and keeps valid ones', () => {
      store.getState().setMany([
        { id: '', name: 'empty-id', value: 1 },
        { id: '2', name: 'valid', value: 2 },
        { name: 'missing-id', value: 3 } as unknown as TestEntity,
      ]);

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('2')?.name).toBe('valid');
    });
  });

  describe('persistence', () => {
    // Hand-derived: source debounces saves by 2s, TTL default is 24h.
    const DEBOUNCE_MS = 2000;
    const HOUR_MS = 60 * 60 * 1000;

    function makeCacheEntry(cachedAt: number, version = BUILD_VERSION): string {
      return JSON.stringify({
        entities: { e1: { id: 'e1', name: 'cached', value: 42 } },
        lastUpdated: cachedAt,
        dataSource: 'websocket',
        cachedAt,
        version,
      });
    }

    beforeEach(() => {
      storageMock.data.clear();
      storageMock.get.mockClear();
      storageMock.set.mockClear();
      storageMock.remove.mockClear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debounces rapid mutations into a single storage write after 2s', async () => {
      vi.useFakeTimers();
      const pstore = createEntityStore<TestEntity>('p-debounce', (i) => i.id, {
        key: 'cache-debounce',
      });
      pstore.getState().setFetched('websocket');

      pstore.getState().setOne({ id: '1', name: 'one', value: 1 });
      pstore.getState().setOne({ id: '2', name: 'two', value: 2 });

      // Nothing written yet — the save is debounced
      expect(storageMock.set).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      // One write for the burst, carrying both entities and the build version
      expect(storageMock.set).toHaveBeenCalledTimes(1);
      const written = JSON.parse(storageMock.data.get('cache-debounce')!);
      expect(Object.keys(written.entities).sort()).toEqual(['1', '2']);
      expect(written.dataSource).toBe('websocket');
      expect(written.version).toBe(BUILD_VERSION);
    });

    it('rehydrate restores fresh cache and marks dataSource as cache', async () => {
      // 1 hour old — well within the 24h TTL
      storageMock.data.set('cache-fresh', makeCacheEntry(Date.now() - HOUR_MS));
      const pstore = createEntityStore<TestEntity>('p-fresh', (i) => i.id, {
        key: 'cache-fresh',
      });

      await expect(pstore.rehydrate()).resolves.toBe(true);

      expect(pstore.getState().getById('e1')?.name).toBe('cached');
      expect(pstore.getState().fetched).toBe(true);
      // Rehydrated data must be flagged cache so staleness UI can degrade it
      expect(pstore.getState().dataSource).toBe('cache');
    });

    it('rehydrate discards cache older than the 24h TTL', async () => {
      // 25 hours old — one hour past the TTL
      storageMock.data.set('cache-stale', makeCacheEntry(Date.now() - 25 * HOUR_MS));
      const pstore = createEntityStore<TestEntity>('p-stale', (i) => i.id, {
        key: 'cache-stale',
      });

      await expect(pstore.rehydrate()).resolves.toBe(false);

      expect(pstore.getState().entities.size).toBe(0);
      expect(pstore.getState().fetched).toBe(false);
      expect(pstore.getState().dataSource).toBeNull();
    });

    it('rehydrate discards cache from a different build version', async () => {
      storageMock.data.set(
        'cache-version',
        makeCacheEntry(Date.now() - HOUR_MS, 'v0.0.0-other')
      );
      const pstore = createEntityStore<TestEntity>('p-version', (i) => i.id, {
        key: 'cache-version',
      });

      await expect(pstore.rehydrate()).resolves.toBe(false);

      expect(pstore.getState().entities.size).toBe(0);
      expect(pstore.getState().dataSource).toBeNull();
    });

    it('clear() removes the cache key from storage', async () => {
      storageMock.data.set('cache-clear', makeCacheEntry(Date.now()));
      const pstore = createEntityStore<TestEntity>('p-clear', (i) => i.id, {
        key: 'cache-clear',
      });

      pstore.getState().clear();

      expect(storageMock.remove).toHaveBeenCalledWith('cache-clear');
      // The remove is fire-and-forget — let the mock's promise settle
      await Promise.resolve();
      expect(storageMock.data.has('cache-clear')).toBe(false);
    });
  });
});
